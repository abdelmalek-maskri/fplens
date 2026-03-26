"""
Two-Head Model
Architecture:
  Head 1: LGBMClassifier -> P(will play)
  Head 2: LGBMRegressor -> E[points | played] (trained only on played samples)
Final prediction: P(play) x E[points | played]
"""

import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from lightgbm import LGBMClassifier, LGBMRegressor
from sklearn.metrics import roc_auc_score

from ml.config.eval_config import (
    CAT_COLS,
    CV_SEASONS,
    DROP_COLS,
    HOLDOUT_SEASON,
    TARGET_COL,
)
from ml.utils.eval_metrics import (
    full_evaluation,
    print_final_summary,
)

IN_PATH = Path("data/features/extended_features.csv")
OUT_DIR = Path("outputs/experiments/twohead")


def prepare_xy(df: pd.DataFrame):
    y = df[TARGET_COL].values
    drop = set([TARGET_COL] + DROP_COLS)
    X = df.drop(columns=[c for c in drop if c in df.columns])
    return X, y


class TwoHeadModel:
    def __init__(self):
        self.classifier = None
        self.regressor = None
        self.played_threshold = 0.5

    def fit(self, X: pd.DataFrame, y: np.ndarray, cat_cols: list):
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
        play_prob = self.classifier.predict_proba(X)[:, 1]
        points_if_play = self.regressor.predict(X)
        predictions = {
            "soft": play_prob * points_if_play,
            "hard": np.where(play_prob > self.played_threshold, points_if_play, 0),
            "play_prob": play_prob,
            "points_if_play": points_if_play,
        }

        return predictions


def evaluate_all_predictions(y_true: np.ndarray, y_train: np.ndarray, predictions: dict) -> dict:
    """Evaluate prediction methods using shared metrics."""
    results = {}
    for name, preds in predictions.items():
        if name in ["play_prob", "points_if_play"]:
            continue
        eval_result = full_evaluation(y_true, preds, y_train)
        results[name] = {
            **eval_result["model"],
            "improve_vs_zero_mae": eval_result["improvements"]["vs_zero"]["mae_improve"],
            "improve_vs_mean_mae": eval_result["improvements"]["vs_mean"]["mae_improve"],
        }
    return results


def run():
    print("=" * 60)
    print("TWO-HEAD MODEL TRAINING")
    print("=" * 60)
    print(f"Holdout season: {HOLDOUT_SEASON}")
    print(f"Train seasons: {CV_SEASONS}")
    print()
    print("Loading extended features...")
    df = pd.read_csv(IN_PATH, low_memory=False)

    for c in CAT_COLS:
        if c in df.columns:
            df[c] = df[c].astype("category")

    available = set(df["season"].dropna().unique())
    train_seasons = [s for s in CV_SEASONS if s in available]

    if HOLDOUT_SEASON not in available:
        raise ValueError(f"Holdout season {HOLDOUT_SEASON} not in data")

    print(f"Total rows: {len(df):,}")

    # Split
    train_df = df[df["season"].isin(train_seasons)]
    test_df = df[df["season"] == HOLDOUT_SEASON]
    X_train, y_train = prepare_xy(train_df)
    X_test, y_test = prepare_xy(test_df)
    X_test = X_test[X_train.columns]

    for c in CAT_COLS:
        if c in X_train.columns:
            X_train[c] = X_train[c].astype("category")
            X_test[c] = X_test[c].astype("category")

    cat_cols = [c for c in CAT_COLS if c in X_train.columns]
    print(f"\nTrain: {len(train_df):,} samples")
    print(f"Test: {len(test_df):,} samples")
    print(f"Played in test: {(y_test > 0).sum():,} ({(y_test > 0).mean() * 100:.1f}%)")

    # Train
    print("\nTraining two-head model...")
    model = TwoHeadModel()
    model.fit(X_train, y_train, cat_cols)

    # Predict
    print("\nGenerating predictions...")
    predictions = model.predict(X_test)

    # Evaluate classifier
    test_auc = roc_auc_score(y_test > 0, predictions["play_prob"])
    print(f"Classifier test AUC: {test_auc:.4f}")

    # Evaluate
    results = evaluate_all_predictions(y_test, y_train, predictions)

    # Find best
    best_method = min(results.keys(), key=lambda k: results[k]["mae"])

    # Print results
    print(f"\n{'=' * 60}")
    print("HOLDOUT RESULTS")
    print(f"{'=' * 60}")
    print(f"\n{'Method':<15} {'MAE':<10} {'RMSE':<10} {'R²':<10}")
    print("-" * 45)
    for method in sorted(results.keys(), key=lambda x: results[x]["mae"]):
        r = results[method]
        print(f"{method:<15} {r['mae']:.4f}     {r['rmse']:.4f}     {r['r2']:.4f}")

    print(f"\nBest method: {best_method}")

    # Save
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    holdout_eval = full_evaluation(y_test, predictions[best_method], y_train)
    metrics = {
        "model_name": "twohead_v1",
        "holdout_season": HOLDOUT_SEASON,
        "train_seasons": train_seasons,
        "rows_train": int(len(train_df)),
        "rows_test": int(len(test_df)),
        "classifier_auc": float(test_auc),
        "holdout": holdout_eval,
        "all_methods": results,
        "best_method": best_method,
    }
    (OUT_DIR / "metrics.json").write_text(json.dumps(metrics, indent=2, default=str))
    joblib.dump(model, OUT_DIR / "model.joblib")

    print_final_summary(
        model_name="twohead",
        holdout_season=HOLDOUT_SEASON,
        train_seasons=train_seasons,
        n_train=len(train_df),
        n_test=len(test_df),
        eval_result=holdout_eval,
        output_dir=str(OUT_DIR),
    )

    print("\nRunning comprehensive evaluation...")
    from ml.evaluation.comprehensive_metrics import ComprehensiveEvaluator

    evaluator = ComprehensiveEvaluator(OUT_DIR)
    evaluator.evaluate_holdout(
        y_true=y_test,
        y_pred=predictions[best_method],
        positions=test_df["position"].values if "position" in test_df.columns else None,
        gameweek_ids=test_df["GW"].values if "GW" in test_df.columns else None,
        experiment_name="twohead",
    )
    print(f"All outputs saved to: {OUT_DIR}/")


if __name__ == "__main__":
    run()
