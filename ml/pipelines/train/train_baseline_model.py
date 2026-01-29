# ml/pipelines/train/train_baseline_model.py
"""
Baseline LightGBM model for FPL points prediction.
"""

from pathlib import Path
import json
import joblib
import pandas as pd
from lightgbm import LGBMRegressor

from ml.config.eval_config import (
    HOLDOUT_SEASON,
    CV_SEASONS,
    MIN_TRAIN_SEASONS,
    DROP_COLS,
    CAT_COLS,
    TARGET_COL,
    MODELS_DIR,
    METRICS_DIR,
)
from ml.utils.eval_metrics import (
    full_evaluation,
    print_final_summary,
)

IN_PATH = Path("data/features/baseline_features.csv")
OUT_MODEL = Path(MODELS_DIR) / "lgbm_baseline_v1.joblib"
OUT_METRICS = Path(METRICS_DIR) / "baseline_v1.json"
OUT_IMPORTANCE = Path(METRICS_DIR) / "baseline_v1_feature_importance.csv"
OUT_CV = Path(METRICS_DIR) / "baseline_v1_cv.csv"


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
    """Extract features (X) and target (y) from dataframe."""
    y = df[TARGET_COL].values
    drop = set([TARGET_COL] + DROP_COLS)
    X = df.drop(columns=[c for c in drop if c in df.columns])
    return X, y


def rolling_season_cv(df: pd.DataFrame, seasons: list[str]) -> pd.DataFrame:
    # fold i: train on seasons[:i], test on seasons[i]  

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

        print(f"  CV fold {test_season}: MAE={eval_result['model']['mae']:.4f}, R²={eval_result['model']['r2']:.4f}")

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

    OUT_CV.parent.mkdir(parents=True, exist_ok=True)
    cv_df.to_csv(OUT_CV, index=False)

    cv_summary = {
        "n_folds": int(len(cv_df)),
        "mae_mean": float(cv_df["model_mae"].mean()),
        "mae_std": float(cv_df["model_mae"].std()),
        "rmse_mean": float(cv_df["model_rmse"].mean()),
        "r2_mean": float(cv_df["model_r2"].mean()),
    }
    print(f"\nCV Summary: MAE={cv_summary['mae_mean']:.4f} ± {cv_summary['mae_std']:.4f}, R²={cv_summary['r2_mean']:.4f}")

    # 2) Final holdout evaluation (train on all CV seasons, test on holdout)

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
        model_name="lgbm_baseline_v1",
        holdout_season=HOLDOUT_SEASON,
        train_seasons=cv_seasons_available,
        n_train=len(train_df),
        n_test=len(test_df),
        eval_result=holdout_eval,
        output_dir=str(OUT_METRICS.parent),
    )
    # 3) Save outputs
    
    metrics = {
        "model_name": "lgbm_baseline_v1",
        "holdout_season": HOLDOUT_SEASON,
        "cv_seasons": cv_seasons_available,
        "rows_train": int(len(train_df)),
        "rows_test": int(len(test_df)),
        "holdout": holdout_eval,
        "cv_summary": cv_summary,
    }

    OUT_MODEL.parent.mkdir(parents=True, exist_ok=True)
    OUT_METRICS.parent.mkdir(parents=True, exist_ok=True)

    joblib.dump(model, OUT_MODEL)
    OUT_METRICS.write_text(json.dumps(metrics, indent=2))

    # Feature importance
    imp = pd.DataFrame({
        "feature": X_train.columns,
        "importance": model.feature_importances_,
    }).sort_values("importance", ascending=False)

    OUT_IMPORTANCE.parent.mkdir(parents=True, exist_ok=True)
    imp.to_csv(OUT_IMPORTANCE, index=False)

    print("\n" + "=" * 60)
    print("OUTPUTS SAVED")
    print("=" * 60)
    print(f"Model:      {OUT_MODEL}")
    print(f"Metrics:    {OUT_METRICS}")
    print(f"CV results: {OUT_CV}")
    print(f"Features:   {OUT_IMPORTANCE}")

    print("\nTop 15 features:")
    print(imp.head(15).to_string(index=False))


if __name__ == "__main__":
    run()
