# ml/pipelines/inference/multi_gw.py
"""
Multi-horizon prediction pipeline (FF-9c).

Generates per-player predictions for GW+1 through GW+N using:
  - GW+1: Config D stacked ensemble (production model)
  - GW+2: CatBoost Tweedie vp1.8
  - GW+3: CatBoost Tweedie vp1.2
  - GW+4+: GW+3 predictions reused with FDR adjustment (projected, not validated)

Usage:
    from ml.pipelines.inference.multi_gw import predict_multi_gw, load_horizon_models
"""

from pathlib import Path

import joblib
import numpy as np
import pandas as pd

from ml.config.eval_config import CAT_COLS, DROP_COLS
from ml.pipelines.inference.predict import align_features, get_model_features

# ---------------------------------------------------------------------------
# Model paths (selected via comprehensive 11-metric evaluation)
# ---------------------------------------------------------------------------
HORIZON_MODEL_PATHS = {
    # GW+1: Config D: avg rank 2.82/13, MAE=1.016, ρ=0.684
    # Already loaded as the main production model in api/main.py
    # GW+2: CatBoost Tweedie vp1.8 : avg rank 2.82/7, MAE=1.060, ρ=0.638
    2: Path("outputs/experiments/multi_horizon/gw2/catboost_tweedie_vp1.8/model.joblib"),
    # GW+3: CatBoost Tweedie vp1.2 : avg rank 3.09/7, MAE=1.104, ρ=0.628
    3: Path("outputs/experiments/multi_horizon/gw3/catboost_tweedie_vp1.2/model.joblib"),
}


def load_horizon_models() -> dict:
    """Load GW+2 and GW+3 models. GW+1 uses the main production model."""
    models = {}
    for horizon, path in HORIZON_MODEL_PATHS.items():
        if path.exists():
            models[horizon] = joblib.load(path)
            print(f"GW+{horizon} model loaded: {type(models[horizon]).__name__} from {path}")
        else:
            print(f"  WARNING: GW+{horizon} model not found at {path}")
    return models


def _get_features(model) -> list[str]:
    """Extract feature names from a model (CatBoost or LightGBM)."""
    if hasattr(model, "feature_names_"):
        return list(model.feature_names_)
    if hasattr(model, "feature_name_"):
        return list(model.feature_name_)
    return get_model_features(model)


def _prepare_and_predict(model, live_df: pd.DataFrame) -> np.ndarray:
    """Align features and run prediction for a single model."""
    features = _get_features(model)
    drop = set(DROP_COLS)
    X = live_df.drop(columns=[c for c in drop if c in live_df.columns], errors="ignore")
    X = align_features(X, features)

    # Convert categoricals
    for c in CAT_COLS:
        if c in X.columns:
            X[c] = X[c].astype("category")

    # Fill NaN
    numeric_cols = X.select_dtypes(include=[np.number]).columns
    X[numeric_cols] = X[numeric_cols].fillna(0)

    preds = model.predict(X)
    return np.clip(preds, 0, None)


def _get_player_fdr(element_id: int, gw_offset: int, fixtures_data: dict) -> int:
    """Get FDR for a player's team at a specific GW offset.

    Args:
        element_id: Player element ID.
        gw_offset: 0-indexed offset from current GW (0 = next GW).
        fixtures_data: Fixture grid from fetch_fixtures().

    Returns:
        FDR value (1-5), or 3 as neutral default if unavailable.
    """
    teams = fixtures_data.get("teams", [])
    for team in teams:
        players = team.get("players", [])
        if element_id in players:
            gws = team.get("fixtures", [])
            if gw_offset < len(gws):
                return gws[gw_offset].get("difficulty", 3)
    return 3


def _get_team_fdr_list(team_name: str, num_gws: int, fixtures_data: dict) -> list[int]:
    """Get FDR list for a team across next N gameweeks."""
    teams = fixtures_data.get("teams", [])
    for team in teams:
        if team.get("name") == team_name or team.get("short_name") == team_name:
            gws = team.get("fixtures", [])
            fdrs = []
            for i in range(num_gws):
                if i < len(gws):
                    fdrs.append(gws[i].get("difficulty", 3))
                else:
                    fdrs.append(3)
            return fdrs
    return [3] * num_gws


def _get_team_opponents(team_name: str, num_gws: int, fixtures_data: dict) -> list[str]:
    """Get opponent short names for a team across next N gameweeks."""
    teams = fixtures_data.get("teams", [])
    for team in teams:
        if team.get("name") == team_name or team.get("short_name") == team_name:
            gws = team.get("fixtures", [])
            opponents = []
            for i in range(num_gws):
                if i < len(gws):
                    opp = gws[i].get("opponent", "???")
                    venue = gws[i].get("venue", "")
                    suffix = " (H)" if venue == "H" else " (A)" if venue == "A" else ""
                    opponents.append(f"{opp}{suffix}")
                else:
                    opponents.append("???")
            return opponents
    return ["???"] * num_gws


def predict_multi_gw(
    gw1_predictions: pd.DataFrame,
    feature_matrix: pd.DataFrame,
    horizon_models: dict,
    fixtures_data: dict,
    horizon: int = 6,
) -> list[dict]:
    """Generate multi-horizon predictions for all players.

    Args:
        gw1_predictions: Single-GW predictions from predict.py (with player info).
        feature_matrix: Live feature matrix from fetch_current_gw_data().
        horizon_models: Dict of {2: model_gw2, 3: model_gw3} from load_horizon_models().
        fixtures_data: Fixture grid from fetch_fixtures().
        horizon: Number of gameweeks to predict (1-8).

    Returns:
        List of dicts, one per player, matching the frontend's expected format.
    """
    n_players = len(gw1_predictions)
    gw1_preds = gw1_predictions["predicted_points"].values

    # GW+2 predictions (direct model)
    gw2_preds = np.full(n_players, 0.0)
    if horizon >= 2 and 2 in horizon_models:
        gw2_preds = _prepare_and_predict(horizon_models[2], feature_matrix)
        # Align to same player order as gw1_predictions
        if len(gw2_preds) == n_players:
            pass  # Already aligned (same feature_matrix rows)
        else:
            gw2_preds = np.full(n_players, np.mean(gw2_preds))

    # GW+3 predictions (direct model)
    gw3_preds = np.full(n_players, 0.0)
    if horizon >= 3 and 3 in horizon_models:
        gw3_preds = _prepare_and_predict(horizon_models[3], feature_matrix)
        if len(gw3_preds) != n_players:
            gw3_preds = np.full(n_players, np.mean(gw3_preds))

    # GW+4 through GW+N: reuse GW+3 predictions with FDR adjustment
    # This is a projection, not a validated prediction.
    extended_preds = [gw1_preds, gw2_preds, gw3_preds]
    for _k in range(4, horizon + 1):
        extended_preds.append(gw3_preds.copy())  # base = GW+3 prediction

    # Build per-player output
    results = []
    for i, row in gw1_predictions.iterrows():
        team_name = row.get("team_name", "")
        element_id = int(row.get("element", 0))

        # Get FDR and opponents for this player's team
        fdr_list = _get_team_fdr_list(team_name, horizon, fixtures_data)
        opponents = _get_team_opponents(team_name, horizon, fixtures_data)

        # Apply FDR adjustment for GW+4+
        # Higher FDR = harder fixture = lower expected points
        # Neutral FDR = 3, so adjustment = 3 / actual_fdr
        predicted = []
        for gw_idx in range(min(horizon, len(extended_preds))):
            base_pred = float(extended_preds[gw_idx][i])
            if gw_idx >= 3:  # GW+4+
                fdr = fdr_list[gw_idx] if gw_idx < len(fdr_list) else 3
                fdr_adjustment = 3.0 / max(fdr, 1)  # easier fixture → higher prediction
                base_pred = base_pred * fdr_adjustment
                base_pred = max(base_pred, 0)
            predicted.append(round(base_pred, 2))

        predicted_total = round(sum(predicted), 2)
        fdr_avg = round(np.mean(fdr_list[:horizon]), 2) if fdr_list else 3.0

        results.append(
            {
                "element": element_id,
                "web_name": row.get("web_name", ""),
                "position": row.get("position", ""),
                "team_name": team_name,
                "value": row.get("value", 0),
                "status": row.get("status", "a"),
                "form": row.get("form", 0),
                "predicted": predicted,
                "fdr": fdr_list[:horizon],
                "opponents": opponents[:horizon],
                "predicted_total": predicted_total,
                "fdr_avg": fdr_avg,
            }
        )

    # Sort by predicted_total descending
    results.sort(key=lambda x: x["predicted_total"], reverse=True)

    return results
