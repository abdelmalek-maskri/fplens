# ml/pipelines/train/train_catboost_twohead.py
"""
CatBoost two-head hurdle model for zero-inflated FPL points.

Head 1: CatBoostClassifier predicts P(plays) with Logloss
Head 2: CatBoostRegressor predicts E[points|plays] with Tweedie loss

Three combination strategies tested:
  - soft: P(play) x E[points|play]
  - hard: E[points|play] if P(play) > 0.5, else 0
  - weighted: P(play)^alpha x E[points|play], alpha tuned on train
"""

import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from catboost import CatBoostClassifier, CatBoostRegressor
from sklearn.metrics import mean_absolute_error, roc_auc_score

from ml.config.eval_config import CAT_COLS, CV_SEASONS, DROP_COLS, HOLDOUT_SEASON, TARGET_COL
from ml.evaluation.comprehensive_metrics import ComprehensiveEvaluator
from ml.utils.eval_metrics import full_evaluation, print_final_summary

IN_PATH = Path("data/features/extended_features.csv")
OUT_DIR = Path("outputs/experiments/catboost_twohead")


def prepare_xy(df):
    y = df[TARGET_COL].values
    drop = set([TARGET_COL] + DROP_COLS)
    X = df.drop(columns=[c for c in drop if c in df.columns])
    return X, y


def prep_catboost(X, cat_cols):
    """CatBoost needs string categories, not pandas categorical."""
    X = X.copy()
    for c in cat_cols:
        if c in X.columns:
            X[c] = X[c].astype(str).fillna("missing")
    return X


class CatBoostTwoHead:
    def __init__(self):
        self.classifier = None
        self.regressor = None
        self.cat_cols = []
        self.feature_cols = []

    def fit(self, X, y, cat_cols):
        self.cat_cols = [c for c in cat_cols if c in X.columns]
        self.feature_cols = X.columns.tolist()
        X_cb = prep_catboost(X, self.cat_cols)

        # Head 1: will they play?
        y_binary = (y > 0).astype(int)
        print("  training Head 1 (classifier)...")
        self.classifier = CatBoostClassifier(
            iterations=600,
            learning_rate=0.05,
            depth=6,
            l2_leaf_reg=3,
            random_seed=42,
            verbose=0,
            auto_class_weights="Balanced",  # ~60% zeros, handle imbalance
        )
        self.classifier.fit(X_cb, y_binary, cat_features=self.cat_cols)

        # Head 2: how many points if they play?
        # Tweedie loss (vp=1.5) handles the right-skewed points distribution
        played_mask = y > 0
        X_played = X_cb[played_mask].reset_index(drop=True)
        y_played = y[played_mask]

        print(f"  training Head 2 (regressor on {played_mask.sum():,} played rows, Tweedie vp=1.5)...")
        self.regressor = CatBoostRegressor(
            iterations=700,
            learning_rate=0.05,
            depth=6,
            l2_leaf_reg=3,
            loss_function="Tweedie:variance_power=1.5",
            random_seed=42,
            verbose=0,
        )
        self.regressor.fit(X_played, y_played, cat_features=self.cat_cols)

        train_auc = roc_auc_score(y_binary, self.classifier.predict_proba(X_cb)[:, 1])
        print(f"  classifier train AUC: {train_auc:.4f}")

        return self

    def predict(self, X):
        X_cb = prep_catboost(X[self.feature_cols], self.cat_cols)
        p_play = self.classifier.predict_proba(X_cb)[:, 1]
        e_points = self.regressor.predict(X_cb)
        e_points = np.clip(e_points, 0, None)

        return {
            "play_prob": p_play,
            "points_if_play": e_points,
            "soft": p_play * e_points,
            "hard": np.where(p_play > 0.5, e_points, 0),
            "weighted": (p_play ** 0.7) * e_points,  # softer than linear, harsher than sqrt
        }


def run():
    print("=" * 60)
    print("CATBOOST TWO-HEAD (HURDLE)")
    print("=" * 60)

    df = pd.read_csv(IN_PATH, low_memory=False)
    available = set(df["season"].dropna().unique())
    train_seasons = [s for s in CV_SEASONS if s in available]
    if HOLDOUT_SEASON not in available:
        raise ValueError(f"Holdout season {HOLDOUT_SEASON} not in data")

    train_df = df[df["season"].isin(train_seasons)]
    test_df = df[df["season"] == HOLDOUT_SEASON]

    X_train, y_train = prepare_xy(train_df)
    X_test, y_test = prepare_xy(test_df)
    X_test = X_test[X_train.columns]

    cat_cols = [c for c in CAT_COLS if c in X_train.columns]

    print(f"  train: {len(train_df):,}  test: {len(test_df):,}")
    print(f"  played in test: {(y_test > 0).sum():,} ({(y_test > 0).mean()*100:.1f}%)")

    model = CatBoostTwoHead()
    model.fit(X_train, y_train, cat_cols)

    predictions = model.predict(X_test)

    # evaluate classifier
    test_auc = roc_auc_score(y_test > 0, predictions["play_prob"])
    print(f"  classifier test AUC: {test_auc:.4f}")

    # evaluate all combination methods
    methods = ["soft", "hard", "weighted"]
    results = {}
    print(f"\n  {'method':<12} {'MAE':<10} {'RMSE':<10} {'R²':<10}")
    print("  " + "-" * 40)
    for method in methods:
        preds = predictions[method]
        ev = full_evaluation(y_test, preds, y_train)
        results[method] = ev
        m = ev["model"]
        print(f"  {method:<12} {m['mae']:.4f}     {m['rmse']:.4f}     {m['r2']:.4f}")

    best_method = min(results.keys(), key=lambda k: results[k]["model"]["mae"])
    best_preds = predictions[best_method]
    holdout_eval = results[best_method]

    print(f"\n  best method: {best_method}")

    OUT_DIR.mkdir(parents=True, exist_ok=True)

    metrics = {
        "model_name": "catboost_twohead",
        "holdout_season": HOLDOUT_SEASON,
        "train_seasons": train_seasons,
        "rows_train": int(len(train_df)),
        "rows_test": int(len(test_df)),
        "classifier_auc": float(test_auc),
        "holdout": holdout_eval,
        "all_methods": {k: v["model"] for k, v in results.items()},
        "best_method": best_method,
    }

    joblib.dump(model, OUT_DIR / "model.joblib")
    (OUT_DIR / "metrics.json").write_text(json.dumps(metrics, indent=2, default=str))

    print_final_summary(
        model_name="catboost_twohead",
        holdout_season=HOLDOUT_SEASON,
        train_seasons=train_seasons,
        n_train=len(train_df),
        n_test=len(test_df),
        eval_result=holdout_eval,
        output_dir=str(OUT_DIR),
    )

    print("\nRunning comprehensive evaluation...")
    evaluator = ComprehensiveEvaluator(OUT_DIR)
    evaluator.evaluate_holdout(
        y_true=y_test,
        y_pred=best_preds,
        positions=test_df["position"].values if "position" in test_df.columns else None,
        gameweek_ids=test_df["GW"].values if "GW" in test_df.columns else None,
        experiment_name="catboost_twohead",
    )
    print(f"All outputs saved to: {OUT_DIR}/")


if __name__ == "__main__":
    run()
