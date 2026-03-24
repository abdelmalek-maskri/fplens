# ml/pipelines/train/train_baseline_model.py

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
from ml.utils.eval_metrics import (
    full_evaluation,
    print_final_summary,
)

IN_PATH = Path("data/features/baseline_features.csv")
OUT_DIR = Path("outputs/experiments/baseline")


def build_model() -> LGBMRegressor:
    return LGBMRegressor(
        n_estimators=800,
        learning_rate=0.05,
        num_leaves=63,
        subsample=0.8,
        colsample_bytree=0.8,
        random_state=42,
        n_jobs=-1,
    )


def prepare_xy(df: pd.DataFrame):
    """extract features (X) and target (y) from dataframe."""
    y = df[TARGET_COL].values
    drop = set([TARGET_COL] + DROP_COLS)
    X = df.drop(columns=[c for c in drop if c in df.columns])
    return X, y


def rolling_season_cv(df: pd.DataFrame, seasons: list[str]) -> pd.DataFrame:
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

        eval_result = full_evaluation(y_test, preds, y_train)

        fold = {
            "test_season": test_season,
            "n_train_seasons": len(train_seasons),
            "rows_train": int(len(train_df)),
            "rows_test": int(len(test_df)),
            **{f"model_{k}": v for k, v in eval_result["model"].items()},
            **{f"zero_{k}": v for k, v in eval_result["baselines"]["zero_baseline"].items()},
            **{f"mean_{k}": v for k, v in eval_result["baselines"]["mean_baseline"].items()},
            **{f"improve_vs_zero_{k}": v for k, v in eval_result["improvements"]["vs_zero"].items()},
            **{f"improve_vs_mean_{k}": v for k, v in eval_result["improvements"]["vs_mean"].items()},
        }
        rows.append(fold)

        print(f"CV fold {test_season}: MAE={eval_result['model']['mae']:.4f}, R²={eval_result['model']['r2']:.4f}")

    return pd.DataFrame(rows)


def run() -> None:
    print("=" * 60)
    print("BASELINE MODEL TRAINING")
    print("=" * 60)
    print(f"Holdout season: {HOLDOUT_SEASON}")
    print(f"CV seasons: {CV_SEASONS}")
    print()
    print("Loading baseline features...")
    df = pd.read_csv(IN_PATH, low_memory=False)

    # Convert categoricals for LightGBM
    for c in CAT_COLS:
        if c in df.columns:
            df[c] = df[c].astype("category")

    # Verify we have required seasons
    available = set(df["season"].dropna().unique())
    if HOLDOUT_SEASON not in available:
        raise ValueError(f"Holdout season {HOLDOUT_SEASON} not in data: {available}")

    cv_seasons_available = [s for s in CV_SEASONS if s in available]
    if len(cv_seasons_available) < MIN_TRAIN_SEASONS + 1:
        raise ValueError(f"Not enough CV seasons: {cv_seasons_available}")

    # 1) Rolling-season CV (on CV_SEASONS only, excludes holdout)
    print("Running rolling-season CV...")
    cv_df = rolling_season_cv(df[df["season"].isin(cv_seasons_available)], cv_seasons_available)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    cv_df.to_csv(OUT_DIR / "cv_results.csv", index=False)

    cv_summary = {
        "n_folds": int(len(cv_df)),
        "mae_mean": float(cv_df["model_mae"].mean()),
        "mae_std": float(cv_df["model_mae"].std()),
        "rmse_mean": float(cv_df["model_rmse"].mean()),
        "r2_mean": float(cv_df["model_r2"].mean()),
    }
    print(
        f"\nCV Summary: MAE={cv_summary['mae_mean']:.4f} ± {cv_summary['mae_std']:.4f}, R²={cv_summary['r2_mean']:.4f}"
    )

    # 2) Final holdout evaluation
    print(f"\nTraining final model for holdout evaluation ({HOLDOUT_SEASON})...")

    train_df = df[df["season"].isin(cv_seasons_available)]
    test_df = df[df["season"] == HOLDOUT_SEASON]

    X_train, y_train = prepare_xy(train_df)
    X_test, y_test = prepare_xy(test_df)
    X_test = X_test[X_train.columns]

    cat_cols = [c for c in CAT_COLS if c in X_train.columns]

    model = build_model()
    model.fit(X_train, y_train, categorical_feature=cat_cols)
    preds = model.predict(X_test)

    holdout_eval = full_evaluation(y_test, preds, y_train)

    print_final_summary(
        model_name="baseline",
        holdout_season=HOLDOUT_SEASON,
        train_seasons=cv_seasons_available,
        n_train=len(train_df),
        n_test=len(test_df),
        eval_result=holdout_eval,
        output_dir=str(OUT_DIR),
    )

    # 3) Save model + metrics
    metrics = {
        "model_name": "baseline",
        "holdout_season": HOLDOUT_SEASON,
        "cv_seasons": cv_seasons_available,
        "rows_train": int(len(train_df)),
        "rows_test": int(len(test_df)),
        "holdout": holdout_eval,
        "cv_summary": cv_summary,
    }

    joblib.dump(model, OUT_DIR / "model.joblib")
    (OUT_DIR / "metrics.json").write_text(json.dumps(metrics, indent=2))

    # Feature importance
    imp = pd.DataFrame({"feature": X_train.columns, "importance": model.feature_importances_}).sort_values(
        "importance", ascending=False
    )
    imp.to_csv(OUT_DIR / "feature_importance.csv", index=False)

    # 4) Comprehensive evaluation (same metrics as all other models)
    print("\nRunning comprehensive evaluation...")
    evaluator = ComprehensiveEvaluator(OUT_DIR)
    evaluator.evaluate_holdout(
        y_true=y_test,
        y_pred=preds,
        positions=test_df["position"].values if "position" in test_df.columns else None,
        gameweek_ids=test_df["GW"].values if "GW" in test_df.columns else None,
        experiment_name="baseline",
    )

    print("\n" + "=" * 60)
    print(f"All outputs saved to: {OUT_DIR}/")
    print("=" * 60)

    print("\nTop 15 features:")
    print(imp.head(15).to_string(index=False))


if __name__ == "__main__":
    run()
