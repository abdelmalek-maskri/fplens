"""
Run inference on live FPL data using trained model.
This module loads a trained model and generates predictions for the current
gameweek, handling feature alignment between live data and training format.
Usage:
    python -m ml.pipelines.inference.predict
    python -m ml.pipelines.inference.predict --model outputs/experiments/ablation_injury/config_D/model.joblib
"""

from datetime import datetime
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

from ml.config.eval_config import CAT_COLS, DROP_COLS, TARGET_COL
from ml.pipelines.inference.fetch_live_data import fetch_current_gw_data

# Default paths
DEFAULT_MODEL = Path("outputs/experiments/ablation_injury/config_D/model.joblib")
OUTPUT_DIR = Path("data/inference")


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
        X[c] = X[c].astype("category")

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
    result["predicted_range_low"] = np.clip(predictions - 1.5 * uncertainty, 0, None).round(2)
    result["predicted_range_high"] = (predictions + 1.5 * uncertainty).round(2)

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
        result["captain_pct"] = (result["selected_by_percent"] * 0.15).round(1)

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


def run(model_path: Path | None = None, model=None, save_output: bool = True, include_history: bool = True):
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
    live_df = fetch_current_gw_data(include_history=include_history)

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
    budget_picks = predictions[predictions["value"] <= 7.0].nlargest(10, "value_score")
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
    args = parser.parse_args()

    result = run(model_path=args.model, save_output=not args.no_save, include_history=not args.no_history)
    print(f"\nPredicted {len(result['predictions'])} players")
