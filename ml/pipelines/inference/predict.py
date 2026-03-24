"""
Run inference on live FPL data using trained model.
This module loads a trained model and generates predictions for the current
gameweek, handling feature alignment between live data and training format.
Usage:
    python -m ml.pipelines.inference.predict
    python -m ml.pipelines.inference.predict --model outputs/experiments/stacked_ensemble/model.joblib
"""

from datetime import datetime
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

from ml.config.eval_config import CAT_COLS, DROP_COLS, TARGET_COL
from ml.pipelines.inference.fetch_live_data import fetch_current_gw_data

# Default paths
DEFAULT_MODEL = Path("outputs/experiments/stacked_ensemble/model.joblib")
OUTPUT_DIR = Path("data/inference")

# Prediction constants
UNCERTAINTY_MULTIPLIER = 1.5  # predicted_range = prediction ± N × uncertainty
CAPTAIN_OWNERSHIP_FACTOR = 0.15  # captain_pct ≈ selected_by_percent × factor
BUDGET_THRESHOLD = 7.0  # max price (£m) for "budget pick" summary


def load_model(model_path: Path = DEFAULT_MODEL):
    # Load a trained model from the specified path. Supports both plain LightGBM and StackedEnsemble models.

    print(f"Loading model from {model_path}...")
    model = joblib.load(model_path)
    print(f"Model loaded: {type(model).__name__}")
    return model


def get_model_features(model) -> list[str]:
    # Extract the feature list from a trained model object.
    # Stacked ensemble: dig into the first LightGBM base learner
    if hasattr(model, "base_models"):
        for name in getattr(model, "base_names", model.base_models.keys()):
            m, ltype = model.base_models[name]
            if hasattr(m, "feature_name_"):
                return m.feature_name_

    # Plain LightGBM / XGBoost
    if hasattr(model, "feature_name_"):
        return model.feature_name_

    # CatBoost
    if hasattr(model, "feature_names_"):
        return list(model.feature_names_)

    # Scikit-learn estimators (RF, Ridge) after fit
    if hasattr(model, "feature_names_in_"):
        return list(model.feature_names_in_)

    raise ValueError(
        f"Cannot extract feature names from {type(model).__name__}. Ensure the model was trained with named features."
    )


def align_features(
    live_df: pd.DataFrame,
    expected_features: list[str],
) -> pd.DataFrame:
    """
    Align live data features to match what the model expects.
    - Adds missing columns with default values (0)
    - Removes extra columns not in training
    - Reorders columns to match training order
    """
    df = live_df.copy()

    # Track what we're doing
    live_cols = set(df.columns)
    expected_cols = set(expected_features)

    missing = expected_cols - live_cols
    extra = live_cols - expected_cols - set(DROP_COLS) - {TARGET_COL, "GW"}

    if missing:
        print(f"Adding {len(missing)} missing columns with default 0")
        for col in missing:
            df[col] = 0

    if extra:
        print(f"Ignoring {len(extra)} extra columns not in training")

    # Select and order features
    df = df[expected_features].copy()

    return df


def prepare_features(
    df: pd.DataFrame,
    model_features: list[str],
) -> pd.DataFrame:
    """
    Prepare features for prediction.
    - Align columns
    - Convert categoricals
    - Fill NaN values
    """
    print("Preparing features...")

    # Align features
    X = align_features(df, model_features)

    # Convert categorical columns
    cat_cols = [c for c in CAT_COLS if c in X.columns]
    for c in cat_cols:
        X[c] = X[c].fillna(0).astype("category")

    # Fill NaN in numeric columns
    numeric_cols = X.select_dtypes(include=[np.number]).columns
    X[numeric_cols] = X[numeric_cols].fillna(0)

    print(f"Final feature shape: {X.shape}")

    return X


def predict(
    model,
    X: pd.DataFrame,
    player_info: pd.DataFrame,
) -> pd.DataFrame:

    # Generate predictions and create enriched output dataframe.
    print("Generating predictions...")

    # CatBoost needs string categories, not numeric codes
    if type(model).__name__ == "CatBoostRegressor":
        for c in CAT_COLS:
            if c in X.columns:
                X[c] = X[c].astype(str).replace("nan", "missing").astype("category")

    # Predict — stacked ensembles return (pred, base_preds_dict)
    raw = model.predict(X)
    if isinstance(raw, tuple):
        predictions, base_preds = raw
    else:
        predictions, base_preds = raw, None

    # Uncertainty from ensemble disagreement
    if base_preds is not None:
        # Use regressor base learners only (exclude classifier and derived keys)
        skip = {"played_prob", "mean", "median", "stacked"}
        regressor_preds = np.array([v for k, v in base_preds.items() if k not in skip])
        uncertainty = np.std(regressor_preds, axis=0)
    else:
        uncertainty = np.zeros(len(predictions))

    # Clip negative predictions (FPL points can't be negative in practice)
    predictions = np.clip(predictions, 0, None)

    # Start from all player info columns
    result = player_info.copy()
    result["predicted_points"] = np.round(predictions, 2)
    result["uncertainty"] = np.round(uncertainty, 3)
    result["predicted_range_low"] = np.clip(predictions - UNCERTAINTY_MULTIPLIER * uncertainty, 0, None).round(2)
    result["predicted_range_high"] = (predictions + UNCERTAINTY_MULTIPLIER * uncertainty).round(2)

    # Rename columns to match frontend field names
    rename_map = {
        "chance_this_round": "chance_of_playing",
        "goals_scored": "goals",
        "expected_goals": "xG",
        "expected_assists": "xA",
        "transfers_in_event": "transfers_in",
        "transfers_out_event": "transfers_out",
    }
    result.rename(columns={k: v for k, v in rename_map.items() if k in result.columns}, inplace=True)

    # Derived fields
    if "transfers_in" in result.columns and "transfers_out" in result.columns:
        result["price_trend"] = np.where(
            result["transfers_in"] > result["transfers_out"],
            "rise",
            np.where(result["transfers_in"] < result["transfers_out"], "fall", "stable"),
        )

    if "selected_by_percent" in result.columns:
        result["captain_pct"] = (result["selected_by_percent"] * CAPTAIN_OWNERSHIP_FACTOR).round(1)

    # Fill NaN in numeric output columns
    fill_zero = [
        "goals",
        "xG",
        "assists",
        "xA",
        "minutes",
        "bonus",
        "bps",
        "clean_sheets",
        "selected_by_percent",
        "transfers_in",
        "transfers_out",
    ]
    for col in fill_zero:
        if col in result.columns:
            result[col] = result[col].fillna(0)

    # Rank by predicted points
    result = result.sort_values("predicted_points", ascending=False).reset_index(drop=True)
    result["rank"] = result.index + 1

    return result


# Human-readable feature names for SHAP display
FEATURE_DISPLAY_NAMES = {
    "minutes_lag1": "Minutes (last GW)",
    "total_points_lag1": "Points (last GW)",
    "total_points_season_avg": "Points (season avg)",
    "total_points_roll3": "Points (last 3 GW avg)",
    "total_points_roll5": "Points (last 5 GW avg)",
    "total_points_roll10": "Points (last 10 GW avg)",
    "value": "Price (£m)",
    "form": "Form",
    "bps_lag1": "BPS (last GW)",
    "bps_roll3": "BPS (last 3 GW avg)",
    "ict_index_lag1": "ICT Index (last GW)",
    "ict_index_roll3": "ICT Index (last 3 GW avg)",
    "us_xg_lag1": "xG (last GW)",
    "us_xg_roll3": "xG (last 3 GW avg)",
    "us_xa_lag1": "xA (last GW)",
    "us_xa_roll3": "xA (last 3 GW avg)",
    "us_npxg_lag1": "npxG (last GW)",
    "us_xgchain_lag1": "xG Chain (last GW)",
    "us_xgbuildup_lag1": "xG Buildup (last GW)",
    "us_shots_lag1": "Shots (last GW)",
    "us_key_passes_lag1": "Key passes (last GW)",
    "us_time_lag1": "Minutes (Understat, last GW)",
    "bonus_lag1": "Bonus (last GW)",
    "bonus_roll3": "Bonus (last 3 GW avg)",
    "clean_sheets_lag1": "Clean sheets (last GW)",
    "goals_scored_lag1": "Goals (last GW)",
    "assists_lag1": "Assists (last GW)",
    "was_home": "Home game",
    "opponent_strength": "Opponent strength",
    "played_lag1": "Played (last GW)",
    "consecutive_starts": "Consecutive starts",
    "minutes_trend": "Minutes trend",
    "points_momentum": "Points momentum",
    "chance_this_round": "Chance of playing",
    "status_encoded": "Availability status",
    "selected_by_percent": "Ownership %",
}


def _get_lgbm_from_model(model):
    """Extract the primary LightGBM model for SHAP explainer."""
    if hasattr(model, "base_models"):
        base_models = model.base_models
        if not base_models:
            return model
        if "lgbm" in base_models:
            return base_models["lgbm"][0]
        first_name = list(base_models.keys())[0]
        return base_models[first_name][0]
    return model


def compute_player_shap(model, X: pd.DataFrame, element_ids, top_n: int = 5) -> dict:
    """Compute per-player SHAP feature importances.

    Args:
        model: Trained model or ensemble containing a LightGBM estimator.
        X (pd.DataFrame): Feature matrix aligned with the model's training features.
        element_ids: Iterable of player element IDs corresponding to the rows of ``X``.
        top_n (int): Number of top features to return per player.

    Returns:
        dict: Mapping ``element_id -> list`` of feature impact dicts, where each dict
            has keys ``"feature"``, ``"display"``, ``"value"``, and ``"impact"``.
            Returns an empty dict if SHAP is unavailable or computation fails.
    """
    if top_n <= 0:
        return {}

    try:
        import shap
    except ImportError:
        print("SHAP not installed, skipping per-player SHAP computation")
        return {}

    try:
        lgbm = _get_lgbm_from_model(model)
        explainer = shap.TreeExplainer(lgbm)
        raw_shap = explainer.shap_values(X)
        # Normalize to 2D numpy array: handle list (multi-class), Explanation, or ndarray
        if isinstance(raw_shap, list):
            shap_values = np.array(raw_shap[0])
        elif hasattr(raw_shap, "values"):
            shap_values = np.array(raw_shap.values)
        else:
            shap_values = np.array(raw_shap)
    except Exception as e:
        print(f"SHAP computation failed: {e}")
        return {}

    result = {}
    for i, eid in enumerate(element_ids):
        player_shap = shap_values[i]
        top_indices = np.argsort(np.abs(player_shap))[-top_n:][::-1]
        result[int(eid)] = [
            {
                "feature": X.columns[j],
                "display": FEATURE_DISPLAY_NAMES.get(X.columns[j], X.columns[j].replace("_", " ").title()),
                "value": round(float(X.iloc[i, j]), 3),
                "impact": round(float(player_shap[j]), 3),
            }
            for j in top_indices
        ]
    return result


def get_top_picks(predictions: pd.DataFrame, n: int = 15) -> pd.DataFrame:
    # Get top N picks by position for team selection.
    picks = []

    # Get best by position
    for pos, count in [("GK", 2), ("DEF", 5), ("MID", 5), ("FWD", 3)]:
        pos_df = predictions[predictions["position"] == pos].head(count)
        picks.append(pos_df)

    picks_df = pd.concat(picks, ignore_index=True)
    picks_df = picks_df.sort_values("predicted_points", ascending=False)

    return picks_df


def run(
    model_path: Path | None = None,
    model=None,
    save_output: bool = True,
    include_history: bool = True,
    include_understat: bool = True,
):
    # Main inference pipeline
    print("=" * 60)
    print("FPL PREDICTION INFERENCE")
    print("=" * 60)
    print(f"Timestamp: {datetime.now().isoformat()}")

    # Use pre-loaded model (from API) or load from disk
    if model is None:
        if model_path is None:
            model_path = DEFAULT_MODEL
        model = load_model(model_path)
    else:
        print(f"Using pre-loaded model: {type(model).__name__}")
    model_features = get_model_features(model)
    print(f"Model expects {len(model_features)} features")

    # Fetch live data
    print()
    live_df = fetch_current_gw_data(include_history=include_history, include_understat=include_understat)

    # Keep player info for output — pass through all fields the frontend needs
    keep_cols = [
        "element",
        "web_name",
        "name",
        "team_name",
        "position",
        "value",
        "status",
        "form",
        "total_points",
        "chance_this_round",
        "news",
        "opponent_name",
        "selected_by_percent",
        "goals_scored",
        "expected_goals",
        "assists",
        "expected_assists",
        "transfers_in_event",
        "transfers_out_event",
        "ict_index",
        "minutes",
        "bonus",
        "bps",
        "clean_sheets",
        "goals_conceded" if "goals_conceded" in live_df.columns else None,
    ]
    keep_cols = [c for c in keep_cols if c is not None and c in live_df.columns]
    player_info = live_df[keep_cols].copy()

    # Prepare features
    print()
    X = prepare_features(live_df, model_features)

    # Predict
    print()
    predictions = predict(model, X, player_info)

    # Save output
    if save_output:
        OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
        output_file = OUTPUT_DIR / "predictions.csv"
        predictions.to_csv(output_file, index=False)
        print(f"\nSaved predictions to {output_file}")

    # Print summary
    print()
    print("=" * 60)
    print("PREDICTION SUMMARY")
    print("=" * 60)

    current_gw = live_df["GW"].iloc[0]
    print(f"\nGameweek: {current_gw}")
    print(f"Players predicted: {len(predictions)}")

    print("\n--- TOP 20 OVERALL ---")
    top20 = predictions.head(20)
    print(
        top20[["rank", "web_name", "team_name", "position", "value", "predicted_points", "form", "status"]].to_string(
            index=False
        )
    )

    print("\n--- TOP PICKS BY POSITION ---")
    top_picks = get_top_picks(predictions)
    print(top_picks[["web_name", "team_name", "position", "value", "predicted_points", "form"]].to_string(index=False))

    print("\n--- INJURY ALERTS (doubtful/injured with high prediction) ---")
    injury_alerts = predictions[
        (predictions["status"].isin(["d", "i"]))
        & (predictions["predicted_points"] > predictions["predicted_points"].median())
    ].head(10)
    if len(injury_alerts) > 0:
        print(
            injury_alerts[["web_name", "team_name", "status", "predicted_points", "chance_of_playing"]].to_string(
                index=False
            )
        )
    else:
        print("No high-value injured players")

    # Price efficiency
    print("\n--- BEST VALUE (points per £m) ---")
    predictions["value_score"] = predictions["predicted_points"] / predictions["value"]
    budget_picks = predictions[predictions["value"] <= BUDGET_THRESHOLD].nlargest(10, "value_score")
    print(
        budget_picks[["web_name", "team_name", "position", "value", "predicted_points", "value_score"]].to_string(
            index=False
        )
    )

    return {
        "predictions": predictions,
        "feature_matrix": X,
        "element_ids": list(player_info["element"]) if "element" in player_info.columns else [],
    }


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Generate FPL predictions")
    parser.add_argument("--model", type=Path, default=DEFAULT_MODEL, help="Path to trained model file")
    parser.add_argument("--no-save", action="store_true", help="Don't save predictions to file")
    parser.add_argument(
        "--no-history", action="store_true", help="Skip per-player history fetch (faster, less accurate)"
    )
    parser.add_argument("--no-understat", action="store_true", help="Skip Understat enrichment (for A/B comparison)")
    args = parser.parse_args()

    result = run(
        model_path=args.model,
        save_output=not args.no_save,
        include_history=not args.no_history,
        include_understat=not args.no_understat,
    )
    print(f"\nPredicted {len(result['predictions'])} players")
