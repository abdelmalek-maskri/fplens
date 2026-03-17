# ml/pipelines/inference/multi_gw.py
"""
Multi-horizon prediction pipeline (FF-9c).

Generates per-player predictions for GW+1 through GW+3 using:
  - GW+1: Config D stacked ensemble (production model)
  - GW+2: CatBoost Tweedie vp1.8
  - GW+3: CatBoost Tweedie vp1.2

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


def _add_future_fixture_features(df: pd.DataFrame, fixtures_data: dict) -> pd.DataFrame:
    """Add future fixture features (opponent_gw2/3, fdr_gw2/3, was_home_gw2/3).

    The GW+2/3 models were trained with these columns. Without them,
    predictions default to conservative estimates.
    """
    df = df.copy()
    fixture_map = fixtures_data.get("fixtures", {})
    team_full = fixtures_data.get("team_full", {})

    # Build reverse map: full name -> short name
    full_to_short = {v: k for k, v in team_full.items()}

    # Build short name -> FPL team ID map for numeric opponent encoding
    try:
        from ml.pipelines.inference.fetch_live_data import get_bootstrap_data

        bootstrap = get_bootstrap_data()
        short_to_id = {t["short_name"]: t["id"] for t in bootstrap["teams"]}
    except Exception:
        short_to_id = {}

    for horizon_offset in [1, 2]:  # gw2 = offset 1, gw3 = offset 2
        gw_label = horizon_offset + 1  # gw2, gw3
        opp_col = f"opponent_gw{gw_label}"
        home_col = f"was_home_gw{gw_label}"
        fdr_col = f"fdr_gw{gw_label}"
        fdr_atk_col = f"fdr_attack_gw{gw_label}"
        fdr_def_col = f"fdr_defence_gw{gw_label}"

        opp_vals, home_vals, fdr_vals, fdr_atk_vals, fdr_def_vals = [], [], [], [], []

        for _, row in df.iterrows():
            team_name = row.get("team_name", "")
            short = full_to_short.get(team_name, team_name)
            gws = fixture_map.get(short, [])

            if horizon_offset < len(gws):
                fix = gws[horizon_offset]
                opp_short = fix.get("opponent", "")
                opp_vals.append(short_to_id.get(opp_short, 0))
                home_vals.append(1 if fix.get("home") else 0)
                atk = fix.get("atkFdr", 3)
                dfn = fix.get("defFdr", 3)
                fdr_vals.append(round((atk + dfn) / 2))
                fdr_atk_vals.append(atk)
                fdr_def_vals.append(dfn)
            else:
                opp_vals.append(0)
                home_vals.append(0)
                fdr_vals.append(3)
                fdr_atk_vals.append(3)
                fdr_def_vals.append(3)

        df[opp_col] = opp_vals
        df[home_col] = home_vals
        df[fdr_col] = fdr_vals
        df[fdr_atk_col] = fdr_atk_vals
        df[fdr_def_col] = fdr_def_vals

    return df


def _prepare_and_predict(model, live_df: pd.DataFrame, fixtures_data: dict | None = None) -> np.ndarray:
    """Align features and run prediction for a single model."""
    features = _get_features(model)

    # Add future fixture features if available and needed
    if fixtures_data is not None:
        missing = [
            f
            for f in features
            if f not in live_df.columns
            and f.startswith(("opponent_gw", "was_home_gw", "fdr_gw", "fdr_attack_gw", "fdr_defence_gw"))
        ]
        if missing:
            live_df = _add_future_fixture_features(live_df, fixtures_data)

    drop = set(DROP_COLS)
    X = live_df.drop(columns=[c for c in drop if c in live_df.columns], errors="ignore")
    X = align_features(X, features)

    # Convert categoricals — CatBoost requires string categories, not numeric.
    # Column may already be category dtype from upstream, so convert to str first.
    # Only convert the 4 standard CAT_COLS that were declared as cat_features during training.
    for c in CAT_COLS:
        if c in X.columns:
            X[c] = X[c].astype(str).replace("nan", "missing").astype("category")

    # opponent_gw* columns are numeric in training (team IDs, not strings).
    # Encode them as numeric codes if present as strings.
    for c in X.columns:
        if c.startswith("opponent_gw") and X[c].dtype == object:
            X[c] = pd.Categorical(X[c]).codes.astype(float)

    # Fill NaN
    numeric_cols = X.select_dtypes(include=[np.number]).columns
    X[numeric_cols] = X[numeric_cols].fillna(0)

    preds = model.predict(X)
    return np.clip(preds, 0, None)


def _resolve_team_short(team_name: str, fixtures_data: dict) -> str | None:
    """Resolve a team name (full or short) to the short name used in fixtures_data."""
    team_full = fixtures_data.get("team_full", {})  # {short: full_name}
    fixture_keys = fixtures_data.get("fixtures", {})

    # Already a short name?
    if team_name in fixture_keys:
        return team_name

    # Try matching full name
    for short, full in team_full.items():
        if full == team_name:
            return short

    return None


def _get_team_fdr_list(team_name: str, num_gws: int, fixtures_data: dict) -> list[int]:
    """Get FDR list for a team across next N gameweeks."""
    short = _resolve_team_short(team_name, fixtures_data)
    if short is None:
        return [3] * num_gws

    gws = fixtures_data.get("fixtures", {}).get(short, [])
    fdrs = []
    for i in range(num_gws):
        if i < len(gws):
            # Average of atkFdr and defFdr for overall difficulty
            atk = gws[i].get("atkFdr", 3)
            dfn = gws[i].get("defFdr", 3)
            fdrs.append(round((atk + dfn) / 2))
        else:
            fdrs.append(3)
    return fdrs


def _get_team_opponents(team_name: str, num_gws: int, fixtures_data: dict) -> list[str]:
    """Get opponent short names for a team across next N gameweeks."""
    short = _resolve_team_short(team_name, fixtures_data)
    if short is None:
        return ["???"] * num_gws

    gws = fixtures_data.get("fixtures", {}).get(short, [])
    opponents = []
    for i in range(num_gws):
        if i < len(gws):
            opp = gws[i].get("opponent", "???")
            home = gws[i].get("home", None)
            suffix = " (H)" if home is True else " (A)" if home is False else ""
            opponents.append(f"{opp}{suffix}")
        else:
            opponents.append("???")
    return opponents


def predict_multi_gw(
    gw1_predictions: pd.DataFrame,
    feature_matrix: pd.DataFrame,
    horizon_models: dict,
    fixtures_data: dict,
    horizon: int = 3,
) -> list[dict]:
    """Generate multi-horizon predictions for all players.

    Args:
        gw1_predictions: Single-GW predictions from predict.py (with player info).
        feature_matrix: Live feature matrix from fetch_current_gw_data().
        horizon_models: Dict of {2: model_gw2, 3: model_gw3} from load_horizon_models().
        fixtures_data: Fixture grid from fetch_fixtures().
        horizon: Number of gameweeks to predict (1-3, backed by trained models).

    Returns:
        List of dicts, one per player, matching the frontend's expected format.
    """
    horizon = min(horizon, 3)  # Only GW+1/2/3 have trained models

    # feature_matrix is in original API order; gw1_predictions is sorted by
    # predicted_points. Build element_id-indexed maps for GW+2/3 so predictions
    # align correctly regardless of row order.
    fm_elements = feature_matrix["element"].values if "element" in feature_matrix.columns else []

    # GW+2 predictions keyed by element
    gw2_map: dict[int, float] = {}
    if horizon >= 2 and 2 in horizon_models:
        raw = _prepare_and_predict(horizon_models[2], feature_matrix, fixtures_data)
        for idx, pred in enumerate(raw):
            if idx < len(fm_elements):
                gw2_map[int(fm_elements[idx])] = float(pred)

    # GW+3 predictions keyed by element
    gw3_map: dict[int, float] = {}
    if horizon >= 3 and 3 in horizon_models:
        raw = _prepare_and_predict(horizon_models[3], feature_matrix, fixtures_data)
        for idx, pred in enumerate(raw):
            if idx < len(fm_elements):
                gw3_map[int(fm_elements[idx])] = float(pred)

    # Build per-player output (iterating gw1_predictions which is sorted)
    results = []
    for _, row in gw1_predictions.iterrows():
        team_name = row.get("team_name", "")
        element_id = int(row.get("element", 0))

        fdr_list = _get_team_fdr_list(team_name, horizon, fixtures_data)
        opponents = _get_team_opponents(team_name, horizon, fixtures_data)

        gw_preds = [
            round(float(row.get("predicted_points", 0)), 2),
            round(gw2_map.get(element_id, 0.0), 2),
            round(gw3_map.get(element_id, 0.0), 2),
        ]
        predicted = gw_preds[:horizon]

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
