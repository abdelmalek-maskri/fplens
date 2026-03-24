"""Train 4 separate LightGBM models, one per FPL position (GK/DEF/MID/FWD)"""

import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from lightgbm import LGBMRegressor
from sklearn.metrics import mean_absolute_error

from ml.config.eval_config import CAT_COLS, CV_SEASONS, DROP_COLS, HOLDOUT_SEASON, TARGET_COL
from ml.evaluation.comprehensive_metrics import ComprehensiveEvaluator
from ml.utils.eval_metrics import full_evaluation, print_final_summary

IN_PATH = Path("data/features/extended_features.csv")
OUT_DIR = Path("outputs/experiments/position_specific")
POSITIONS = ["GK", "DEF", "MID", "FWD"]


def build_lgbm() -> LGBMRegressor:
    # more conservative than baseline: each position subset is ~1/4 of the data
    return LGBMRegressor(
        n_estimators=600,
        learning_rate=0.03,
        num_leaves=31,
        subsample=0.7,
        colsample_bytree=0.7,
        random_state=42,
        n_jobs=-1,
        verbose=-1,
    )


def prepare_xy(df: pd.DataFrame):
    y = df[TARGET_COL].values
    drop = set([TARGET_COL] + DROP_COLS)
    X = df.drop(columns=[c for c in drop if c in df.columns])
    return X, y

class PositionSpecificLGBMModel:
    """wrapper that trains and predicts with a separate LightGBM per position."""

    def __init__(self):
        self.models = {}
        self.feature_cols = []

    def fit(self, X, y, positions, cat_cols):
        self.feature_cols = X.columns.tolist()
        for pos in POSITIONS:
            mask = positions == pos
            n = int(mask.sum())
            if n < 100:
                print(f"  {pos}: only {n} samples, skipping")
                continue
            print(f"  {pos}: training on {n:,} samples")
            model = build_lgbm()
            model.fit(X[mask].reset_index(drop=True), y[mask], categorical_feature=cat_cols)
            self.models[pos] = model
        return self

    def predict(self, X, positions):
        X = X[self.feature_cols]
        preds = np.zeros(len(X))
        for pos, model in self.models.items():
            mask = positions == pos
            if mask.sum() > 0:
                preds[mask] = model.predict(X[mask].reset_index(drop=True))
        return preds


def run():
    print("=" * 60)
    print("POSITION-SPECIFIC LIGHTGBM")
    print("=" * 60)

    df = pd.read_csv(IN_PATH, low_memory=False)
    if "position" not in df.columns:
        raise ValueError("'position' column not found")

    for c in CAT_COLS:
        if c in df.columns:
            df[c] = df[c].astype("category")

    available = set(df["season"].dropna().unique())
    train_seasons = [s for s in CV_SEASONS if s in available]
    if HOLDOUT_SEASON not in available:
        raise ValueError(f"Holdout season {HOLDOUT_SEASON} not in data")

    train_df = df[df["season"].isin(train_seasons)]
    test_df = df[df["season"] == HOLDOUT_SEASON]

    X_train, y_train = prepare_xy(train_df)
    X_test, y_test = prepare_xy(test_df)
    X_test = X_test[X_train.columns]

    positions_train = train_df["position"].values
    positions_test = test_df["position"].values

    for c in CAT_COLS:
        if c in X_train.columns:
            X_train[c] = X_train[c].astype("category")
            X_test[c] = X_test[c].astype("category")
    cat_cols = [c for c in CAT_COLS if c in X_train.columns]

    print(f"  train: {len(train_df):,}  test: {len(test_df):,}")
    print(f"  positions: {', '.join(f'{p}={int((positions_test==p).sum())}' for p in POSITIONS)}")

    model = PositionSpecificLGBMModel()
    model.fit(X_train, y_train, positions_train, cat_cols)
    preds = model.predict(X_test, positions_test)

    holdout_eval = full_evaluation(y_test, preds, y_train)

    # Per-position breakdown
    print(f"\n  per-position MAE:")
    per_pos = {}
    for pos in POSITIONS:
        mask = positions_test == pos
        if mask.sum() == 0:
            continue
        mae = mean_absolute_error(y_test[mask], preds[mask])
        per_pos[pos] = {"n": int(mask.sum()), "mae": mae}
        print(f"    {pos}: {mae:.4f} (n={mask.sum():,})")

    OUT_DIR.mkdir(parents=True, exist_ok=True)

    metrics = {
        "model_name": "position_specific",
        "holdout_season": HOLDOUT_SEASON,
        "train_seasons": train_seasons,
        "rows_train": int(len(train_df)),
        "rows_test": int(len(test_df)),
        "holdout": holdout_eval,
        "per_position": per_pos,
    }

    joblib.dump(model, OUT_DIR / "model.joblib")
    (OUT_DIR / "metrics.json").write_text(json.dumps(metrics, indent=2, default=str))

    print_final_summary(
        model_name="position_specific",
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
        y_pred=preds,
        positions=positions_test,
        gameweek_ids=test_df["GW"].values if "GW" in test_df.columns else None,
        experiment_name="position_specific",
    )
    print(f"All outputs saved to: {OUT_DIR}/")


if __name__ == "__main__":
    run()
