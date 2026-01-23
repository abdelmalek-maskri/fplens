# ml/pipelines/train/train_twohead_model.py
"""
Experiment 005: Two-Head Model

Architecture:
  Head 1: LGBMClassifier → P(will play)
  Head 2: LGBMRegressor → E[points | played] (trained only on played samples)

Final prediction: P(play) × E[points | played]

Based on SHAP insight: 25% of model importance is availability prediction.
This architecture explicitly separates the two sub-problems.
"""

import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from lightgbm import LGBMClassifier, LGBMRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, roc_auc_score

# Paths
IN_PATH = Path("data/features/extended_features.csv")
OUT_DIR = Path("outputs/experiments/twohead_v1")
BASELINE_METRICS = Path("outputs/metrics/baseline_v1.json")
EXTENDED_METRICS = Path("outputs/experiments/extended_v1/summary.json")

# Configuration
TEST_SEASON = "2023-24"
DROP_COLS = ["name", "element", "points_next_gw", "will_play_next"]
CAT_COLS = ["season", "position", "team", "opponent_team"]


def rmse(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    return float(np.sqrt(mean_squared_error(y_true, y_pred)))


def prepare_xy(df: pd.DataFrame):
    y = df["points_next_gw"].values
    drop = set(DROP_COLS)
    X = df.drop(columns=[c for c in drop if c in df.columns])
    return X, y


class TwoHeadModel:
    """
    Two-head architecture for FPL prediction.

    Head 1 (Classifier): Predicts P(player will play)
    Head 2 (Regressor): Predicts E[points | player plays]

    Final: P(play) × E[points | play]
    """

    def __init__(self):
        self.classifier = None
        self.regressor = None
        self.played_threshold = 0.5

    def fit(self, X: pd.DataFrame, y: np.ndarray, cat_cols: list):
        """Train both heads."""

        # Binary target for classifier
        y_played = (y > 0).astype(int)

        # Head 1: Classifier (all samples)
        print("  Training Head 1 (Classifier)...")
        self.classifier = LGBMClassifier(
            n_estimators=500,
            learning_rate=0.05,
            num_leaves=31,
            subsample=0.8,
            colsample_bytree=0.8,
            random_state=42,
            n_jobs=-1,
            verbose=-1,
        )
        self.classifier.fit(X, y_played, categorical_feature=cat_cols)

        # Head 2: Regressor (only played samples)
        print("  Training Head 2 (Regressor on played samples)...")
        played_mask = y > 0
        X_played = X[played_mask]
        y_played_points = y[played_mask]

        self.regressor = LGBMRegressor(
            n_estimators=800,
            learning_rate=0.05,
            num_leaves=63,
            subsample=0.8,
            colsample_bytree=0.8,
            random_state=42,
            n_jobs=-1,
            verbose=-1,
        )
        self.regressor.fit(X_played, y_played_points, categorical_feature=cat_cols)

        # Report classifier performance
        train_probs = self.classifier.predict_proba(X)[:, 1]
        train_auc = roc_auc_score(y > 0, train_probs)
        print(f"  Classifier train AUC: {train_auc:.4f}")

        return self

    def predict(self, X: pd.DataFrame) -> dict:
        """Generate predictions using multiple combination strategies."""

        # Get probabilities and conditional points
        play_prob = self.classifier.predict_proba(X)[:, 1]
        points_if_play = self.regressor.predict(X)

        predictions = {
            # Strategy 1: Soft combination (P × E[points|play])
            "soft": play_prob * points_if_play,

            # Strategy 2: Hard threshold (if P > 0.5, predict points, else 0)
            "hard": np.where(play_prob > self.played_threshold, points_if_play, 0),

            # Strategy 3: Calibrated soft (adjust for bias)
            "calibrated": play_prob * points_if_play * 1.0,  # Can tune multiplier

            # Component predictions for analysis
            "play_prob": play_prob,
            "points_if_play": points_if_play,
        }

        return predictions


def evaluate_predictions(
    y_true: np.ndarray,
    predictions: dict,
    baseline_mae: float,
    extended_mae: float,
    positions: np.ndarray = None,
) -> dict:
    """Comprehensive evaluation."""

    results = {}

    for name, preds in predictions.items():
        if name in ["play_prob", "points_if_play"]:
            continue  # Skip component predictions

        mae = float(mean_absolute_error(y_true, preds))
        rmse_val = rmse(y_true, preds)

        # Stratified
        played_mask = y_true > 0
        mae_played = float(mean_absolute_error(y_true[played_mask], preds[played_mask]))
        mae_not_played = float(mean_absolute_error(y_true[~played_mask], preds[~played_mask]))

        # High-return
        high_mask = y_true >= 5
        mae_high = float(mean_absolute_error(y_true[high_mask], preds[high_mask])) if high_mask.sum() > 0 else None

        results[name] = {
            "mae": mae,
            "rmse": rmse_val,
            "mae_played": mae_played,
            "mae_not_played": mae_not_played,
            "mae_high_return": mae_high,
            "delta_vs_baseline": mae - baseline_mae,
            "delta_vs_extended": mae - extended_mae,
            "pct_vs_baseline": (baseline_mae - mae) / baseline_mae * 100,
        }

        # Position breakdown
        if positions is not None:
            for pos in ["GK", "DEF", "MID", "FWD"]:
                mask = positions == pos
                if mask.sum() > 0:
                    results[name][f"mae_{pos.lower()}"] = float(mean_absolute_error(y_true[mask], preds[mask]))

    return results


def run():
    """Main entry point."""
    print("=" * 60)
    print("Experiment 005: Two-Head Model")
    print("=" * 60)

    # Load data
    print("\nLoading extended features...")
    df = pd.read_csv(IN_PATH, low_memory=False)

    for c in CAT_COLS:
        if c in df.columns:
            df[c] = df[c].astype("category")

    seasons = sorted(df["season"].dropna().unique().tolist())
    print(f"Seasons: {seasons}")
    print(f"Total rows: {len(df):,}")

    # Split
    train_seasons = [s for s in seasons if s != TEST_SEASON]
    train_df = df[df["season"].isin(train_seasons)]
    test_df = df[df["season"] == TEST_SEASON]

    X_train, y_train = prepare_xy(train_df)
    X_test, y_test = prepare_xy(test_df)
    X_test = X_test[X_train.columns]

    for c in CAT_COLS:
        if c in X_train.columns:
            X_train[c] = X_train[c].astype("category")
            X_test[c] = X_test[c].astype("category")

    cat_cols = [c for c in CAT_COLS if c in X_train.columns]
    positions = test_df["position"].values if "position" in test_df.columns else None

    print(f"\nTrain: {len(train_df):,} samples")
    print(f"Test: {len(test_df):,} samples")
    print(f"Played in test: {(y_test > 0).sum():,} ({(y_test > 0).mean()*100:.1f}%)")

    # Train two-head model
    print("\nTraining two-head model...")
    model = TwoHeadModel()
    model.fit(X_train, y_train, cat_cols)

    # Predict
    print("\nGenerating predictions...")
    predictions = model.predict(X_test)

    # Evaluate classifier
    test_auc = roc_auc_score(y_test > 0, predictions["play_prob"])
    print(f"Classifier test AUC: {test_auc:.4f}")

    # Load comparison metrics
    baseline_mae = 0.999  # Default
    if BASELINE_METRICS.exists():
        baseline = json.loads(BASELINE_METRICS.read_text())
        baseline_mae = baseline["mae"]

    extended_mae = 0.9875  # Default
    if EXTENDED_METRICS.exists():
        extended = json.loads(EXTENDED_METRICS.read_text())
        extended_mae = extended["holdout"]["all_results"]["stacked"]["mae"]

    # Evaluate
    results = evaluate_predictions(y_test, predictions, baseline_mae, extended_mae, positions)

    # Find best
    best_method = min(results.keys(), key=lambda k: results[k]["mae"])
    best_mae = results[best_method]["mae"]

    # Print results
    print(f"\n{'='*60}")
    print(f"RESULTS")
    print(f"  Baseline MAE:  {baseline_mae:.4f}")
    print(f"  Extended MAE:  {extended_mae:.4f}")
    print(f"{'='*60}")
    print(f"\n{'Method':<15} {'MAE':<10} {'vs Base':<10} {'vs Ext':<10} {'Played':<10} {'Not-Played':<10}")
    print("-" * 65)

    for method in sorted(results.keys(), key=lambda x: results[x]["mae"]):
        r = results[method]
        print(f"{method:<15} {r['mae']:.4f}     {r['delta_vs_baseline']:+.4f}     {r['delta_vs_extended']:+.4f}     {r['mae_played']:.4f}     {r['mae_not_played']:.4f}")

    # Save
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    holdout = {
        "test_season": TEST_SEASON,
        "n_train": len(train_df),
        "n_test": len(test_df),
        "classifier_auc": float(test_auc),
        "baseline_mae": baseline_mae,
        "extended_mae": extended_mae,
        "best_method": best_method,
        "best_mae": best_mae,
        "delta_vs_baseline": best_mae - baseline_mae,
        "delta_vs_extended": best_mae - extended_mae,
        "all_results": results,
    }

    summary = {
        "experiment": "twohead_v1",
        "description": "Two-head model: Classifier (P(play)) + Regressor (E[points|play])",
        "holdout": holdout,
    }

    (OUT_DIR / "summary.json").write_text(json.dumps(summary, indent=2, default=str))
    joblib.dump(model, OUT_DIR / "twohead_model.joblib")

    print(f"\nResults saved to: {OUT_DIR}")

    # Verdict
    print("\n" + "=" * 60)
    delta_base = best_mae - baseline_mae
    delta_ext = best_mae - extended_mae

    if delta_base < -0.005:
        print(f"vs BASELINE: IMPROVEMENT ({delta_base:+.4f}, {delta_base/baseline_mae*100:+.1f}%)")
    else:
        print(f"vs BASELINE: No improvement ({delta_base:+.4f})")

    if delta_ext < -0.005:
        print(f"vs EXTENDED: IMPROVEMENT ({delta_ext:+.4f}, {delta_ext/extended_mae*100:+.1f}%)")
    else:
        print(f"vs EXTENDED: No improvement ({delta_ext:+.4f})")

    print("=" * 60)


if __name__ == "__main__":
    run()
