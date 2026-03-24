# ml/pipelines/train/train_baseline_tweedie.py
"""Single LightGBM with Tweedie loss (vp=1.5) instead of default MSE."""

import json
from pathlib import Path

import joblib
import pandas as pd
from lightgbm import LGBMRegressor

from ml.config.eval_config import (
    CAT_COLS,
    CV_SEASONS,
    DROP_COLS,
    HOLDOUT_SEASON,
    MIN_TRAIN_SEASONS,
    TARGET_COL,
)
from ml.evaluation.comprehensive_metrics import ComprehensiveEvaluator
from ml.utils.eval_metrics import full_evaluation, print_final_summary

IN_PATH = Path("data/features/baseline_features.csv")
OUT_DIR = Path("outputs/experiments/baseline_tweedie")


def build_model():
    return LGBMRegressor(
        objective="tweedie",
        tweedie_variance_power=1.5,
        n_estimators=800,
        learning_rate=0.05,
        num_leaves=63,
        subsample=0.8,
        colsample_bytree=0.8,
        random_state=42,
        n_jobs=-1,
        verbose=-1,
    )


def prepare_xy(df):
    # Tweedie loss requires y >= 0; FPL points can be negative (red cards, own goals)
    y = df[TARGET_COL].values.clip(min=0)
    drop = set([TARGET_COL] + DROP_COLS)
    X = df.drop(columns=[c for c in drop if c in df.columns])
    return X, y


def rolling_season_cv(df, seasons):
    rows = []
    for i in range(MIN_TRAIN_SEASONS, len(seasons)):
        test_season = seasons[i]
        train_seasons = seasons[:i]

        train_df = df[df["season"].isin(train_seasons)]
        test_df = df[df["season"] == test_season]

        X_train, y_train = prepare_xy(train_df)
        X_test, y_test = prepare_xy(test_df)
        X_test = X_test[X_train.columns]

        cat_cols = [c for c in CAT_COLS if c in X_train.columns]

        model = build_model()
        model.fit(X_train, y_train, categorical_feature=cat_cols)
        preds = model.predict(X_test)

        ev = full_evaluation(y_test, preds, y_train)
        fold = {
            "test_season": test_season,
            "n_train_seasons": len(train_seasons),
            "rows_train": int(len(train_df)),
            "rows_test": int(len(test_df)),
            **{f"model_{k}": v for k, v in ev["model"].items()},
        }
        rows.append(fold)
        print(f"  CV fold {test_season}: MAE={ev['model']['mae']:.4f}, R2={ev['model']['r2']:.4f}")

    return pd.DataFrame(rows)


def run():
    print("=" * 60)
    print("BASELINE + TWEEDIE LOSS (LightGBM, vp=1.5)")
    print("=" * 60)

    df = pd.read_csv(IN_PATH, low_memory=False)

    for c in CAT_COLS:
        if c in df.columns:
            df[c] = df[c].astype("category")

    available = set(df["season"].dropna().unique())
    if HOLDOUT_SEASON not in available:
        raise ValueError(f"Holdout season {HOLDOUT_SEASON} not in data")

    cv_seasons = [s for s in CV_SEASONS if s in available]

    print(f"  holdout: {HOLDOUT_SEASON}")
    print(f"  features: {IN_PATH}")

    print("\nRunning rolling-season CV...")
    cv_df = rolling_season_cv(df[df["season"].isin(cv_seasons)], cv_seasons)

    cv_summary = {
        "n_folds": int(len(cv_df)),
        "mae_mean": float(cv_df["model_mae"].mean()),
        "mae_std": float(cv_df["model_mae"].std()),
        "r2_mean": float(cv_df["model_r2"].mean()),
    }
    print(f"\nCV Summary: MAE={cv_summary['mae_mean']:.4f} +/- {cv_summary['mae_std']:.4f}")

    print(f"\nTraining final model ({HOLDOUT_SEASON} holdout)...")
    train_df = df[df["season"].isin(cv_seasons)]
    test_df = df[df["season"] == HOLDOUT_SEASON]

    X_train, y_train = prepare_xy(train_df)
    X_test, y_test = prepare_xy(test_df)
    X_test = X_test[X_train.columns]

    cat_cols = [c for c in CAT_COLS if c in X_train.columns]

    model = build_model()
    model.fit(X_train, y_train, categorical_feature=cat_cols)
    preds = model.predict(X_test)

    holdout_eval = full_evaluation(y_test, preds, y_train)

    OUT_DIR.mkdir(parents=True, exist_ok=True)

    metrics = {
        "model_name": "baseline_tweedie",
        "holdout_season": HOLDOUT_SEASON,
        "cv_seasons": cv_seasons,
        "rows_train": int(len(train_df)),
        "rows_test": int(len(test_df)),
        "holdout": holdout_eval,
        "cv_summary": cv_summary,
    }

    joblib.dump(model, OUT_DIR / "model.joblib")
    (OUT_DIR / "metrics.json").write_text(json.dumps(metrics, indent=2, default=str))
    cv_df.to_csv(OUT_DIR / "cv_results.csv", index=False)

    imp = pd.DataFrame({
        "feature": model.feature_name_,
        "importance": model.feature_importances_,
    }).sort_values("importance", ascending=False)
    imp.to_csv(OUT_DIR / "feature_importance.csv", index=False)

    print_final_summary(
        model_name="baseline_tweedie",
        holdout_season=HOLDOUT_SEASON,
        train_seasons=cv_seasons,
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
        positions=test_df["position"].values if "position" in test_df.columns else None,
        gameweek_ids=test_df["GW"].values if "GW" in test_df.columns else None,
        experiment_name="baseline_tweedie",
    )

    print(f"\nAll outputs saved to: {OUT_DIR}/")

    print("\nTop 15 features:")
    print(imp.head(15).to_string(index=False))


if __name__ == "__main__":
    run()
