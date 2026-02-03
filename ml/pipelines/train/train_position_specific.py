# ml/pipelines/train/train_position_specific_lgbm_v2.py

"""
Position-Specific LightGBM (v2)

Trains 4 separate LightGBM models - one per position:
  - GK
  - DEF
  - MID
  - FWD

"""

import json
from pathlib import Path
import joblib
import numpy as np
import pandas as pd
from lightgbm import LGBMRegressor

from ml.config.eval_config import (
    HOLDOUT_SEASON,
    CV_SEASONS,
    DROP_COLS,
    CAT_COLS,
    TARGET_COL,
)
from ml.utils.eval_metrics import (
    compute_metrics,
    full_evaluation,
    print_final_summary,
)

IN_PATH = Path("data/features/extended_features.csv")
OUT_DIR = Path("outputs/experiments/position_specific")
OUT_MODEL = Path("outputs/models/position_specific.joblib")

POSITIONS = ["GK", "DEF", "MID", "FWD"]


def build_lgbm_v2() -> LGBMRegressor:
    return LGBMRegressor(
        n_estimators=600,
        learning_rate=0.03,
        num_leaves=31,
        subsample=0.7,
        colsample_bytree=0.7,
        random_state=123,
        n_jobs=-1,
        verbose=-1,
    )


def prepare_xy(df: pd.DataFrame):
    y = df[TARGET_COL].values
    drop = set([TARGET_COL] + DROP_COLS + ["will_play_next"])
    X = df.drop(columns=[c for c in drop if c in df.columns])
    return X, y


class PositionSpecificLGBMModel:
    """Train a separate LGBM model per position."""

    def __init__(self):
        self.models = {}
        self.feature_cols = None

    def fit(self, X: pd.DataFrame, y: np.ndarray, positions: np.ndarray, cat_cols: list):
        self.feature_cols = X.columns.tolist()

        for pos in POSITIONS:
            mask = positions == pos
            n_samples = int(mask.sum())

            if n_samples < 100:
                print(f"    {pos}: Only {n_samples} samples, skipping")
                continue

            X_pos = X[mask].reset_index(drop=True)
            y_pos = y[mask]

            print(f"    {pos}: Training LGBM v2 on {n_samples:,} samples...")
            model = build_lgbm_v2()
            model.fit(X_pos, y_pos, categorical_feature=cat_cols)
            self.models[pos] = model

        return self

    def predict(self, X: pd.DataFrame, positions: np.ndarray) -> np.ndarray:
        X = X[self.feature_cols]
        predictions = np.zeros(len(X))

        for pos in POSITIONS:
            if pos not in self.models:
                continue

            mask = positions == pos
            if mask.sum() > 0:
                X_pos = X[mask].reset_index(drop=True)
                predictions[mask] = self.models[pos].predict(X_pos)

        return predictions


def train_single_lgbm(X_train, y_train, X_test, cat_cols):
    print("  Training single LGBM (all positions)...")
    model = build_lgbm_v2()
    model.fit(X_train, y_train, categorical_feature=cat_cols)
    preds = model.predict(X_test)
    return preds, model


def train_position_lgbm(X_train, y_train, positions_train, X_test, positions_test, cat_cols):
    print("  Training position-specific LGBM models...")
    model = PositionSpecificLGBMModel()
    model.fit(X_train, y_train, positions_train, cat_cols)
    preds = model.predict(X_test, positions_test)
    return preds, model


def run():
    print("=" * 60)
    print("POSITION-SPECIFIC LIGHTGBM")
    print("=" * 60)
    print(f"Holdout season: {HOLDOUT_SEASON}")
    print(f"Train seasons: {CV_SEASONS}")
    print("Architecture: LightGBM (per-position)")
    print()

    print("Loading extended features...")
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

    # Split
    train_df = df[df["season"].isin(train_seasons)]
    test_df = df[df["season"] == HOLDOUT_SEASON]

    X_train, y_train = prepare_xy(train_df)
    X_test, y_test = prepare_xy(test_df)

    positions_train = train_df["position"].values
    positions_test = test_df["position"].values

    X_test = X_test[X_train.columns]

    for c in CAT_COLS:
        if c in X_train.columns:
            X_train[c] = X_train[c].astype("category")
            X_test[c] = X_test[c].astype("category")

    cat_cols = [c for c in CAT_COLS if c in X_train.columns]

    print(f"Train: {len(train_df):,}, Test: {len(test_df):,}")
    print("\nPosition distribution (test):")
    for pos in POSITIONS:
        n = int((positions_test == pos).sum())
        print(f"  {pos}: {n:,} ({n/len(positions_test)*100:.1f}%)")

    print("\n" + "-" * 60)
    single_preds, single_model = train_single_lgbm(X_train, y_train, X_test, cat_cols)

    print()
    position_preds, position_model = train_position_lgbm(
        X_train, y_train, positions_train, X_test, positions_test, cat_cols
    )

    single_eval = full_evaluation(y_test, single_preds, y_train)
    position_eval = full_evaluation(y_test, position_preds, y_train)

    print(f"\n{'='*60}")
    print("HOLDOUT RESULTS")
    print(f"{'='*60}")

    print(f"\n{'='*60}")
    print("PER-POSITION BREAKDOWN")
    print(f"{'='*60}")
    print(f"\n{'Position':<8} {'N':<8} {'Single MAE':<12} {'Position MAE':<12} {'Diff':<10}")
    print("-" * 52)

    per_position_results = {}
    for pos in POSITIONS:
        mask = positions_test == pos
        if mask.sum() == 0:
            continue

        y_pos = y_test[mask]
        single_pos = single_preds[mask]
        position_pos = position_preds[mask]

        single_m = compute_metrics(y_pos, single_pos)
        position_m = compute_metrics(y_pos, position_pos)

        diff = position_m["mae"] - single_m["mae"]

        per_position_results[pos] = {
            "n_samples": int(mask.sum()),
            "single": single_m,
            "position_specific": position_m,
            "mae_diff": diff,
        }

        print(f"{pos:<8} {mask.sum():<8} {single_m['mae']:.4f}       {position_m['mae']:.4f}        {diff:+.4f}")

    OUT_DIR.mkdir(parents=True, exist_ok=True)

    mae_diff = single_eval["model"]["mae"] - position_eval["model"]["mae"]

    metrics = {
        "model_name": "position_specific",
        "holdout_season": HOLDOUT_SEASON,
        "train_seasons": train_seasons,
        "rows_train": int(len(train_df)),
        "rows_test": int(len(test_df)),
        "holdout": position_eval,
        "comparison": {
            "single_lgbm_v2": single_eval,
            "position_specific": position_eval,
            "mae_improvement": mae_diff,
            "pct_improvement": mae_diff / single_eval["model"]["mae"] * 100 if single_eval["model"]["mae"] else 0,
            "per_position": per_position_results,
        },
    }

    (OUT_DIR / "summary.json").write_text(json.dumps(metrics, indent=2, default=str))

    OUT_MODEL.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(position_model, OUT_MODEL)

    print(f"\n{'='*60}")
    print("SUMMARY")
    print(f"{'='*60}")
    print(f"Single LGBM v2 MAE:      {single_eval['model']['mae']:.4f}")
    print(f"Position-specific MAE:   {position_eval['model']['mae']:.4f}")
    print(f"Difference:              {mae_diff:+.4f} ({'better' if mae_diff > 0 else 'worse'})")

    if mae_diff > 0.002:
        print(f"\nPosition-specific models IMPROVE by {mae_diff:.4f} MAE")
    elif mae_diff < -0.002:
        print(f"\nSingle model is BETTER by {-mae_diff:.4f} MAE")
    else:
        print("\nNo significant difference")

    print_final_summary(
        model_name="position_specific",
        holdout_season=HOLDOUT_SEASON,
        train_seasons=train_seasons,
        n_train=len(train_df),
        n_test=len(test_df),
        eval_result=position_eval,
        output_dir=str(OUT_DIR),
    )


if __name__ == "__main__":
    run()
