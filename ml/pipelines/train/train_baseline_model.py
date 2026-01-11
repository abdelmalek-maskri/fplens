# ml/pipelines/train/train_baseline_model.py
from pathlib import Path
import json

import joblib
import numpy as np
import pandas as pd
from lightgbm import LGBMRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error


IN_PATH = Path("data/features/baseline_features.csv")

OUT_MODEL = Path("outputs/models/lgbm_baseline.joblib")
OUT_METRICS = Path("outputs/metrics/lgbm_baseline.json")
OUT_IMPORTANCE = Path("outputs/metrics/lgbm_feature_importance.csv")
OUT_CV = Path("outputs/metrics/lgbm_rolling_cv.csv")

# Optional final holdout (set to None to disable)
TEST_SEASON = "2023-24"

DROP_COLS = ["name", "element"]

# Rolling CV settings
MIN_TRAIN_SEASONS = 3

CAT_COLS = ["season", "position", "team", "opponent_team"]


def rmse(y_true, y_pred) -> float:
    return float(np.sqrt(mean_squared_error(y_true, y_pred)))


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
    y = df["points_next_gw"].values
    drop = set(["points_next_gw"] + DROP_COLS)
    X = df.drop(columns=[c for c in drop if c in df.columns])
    return X, y


def rolling_season_cv(df: pd.DataFrame, seasons: list[str]) -> pd.DataFrame:
    """
    Rolling-season CV:
      fold i:
        train = seasons[:i]
        test  = seasons[i]
    """
    rows = []

    for i in range(MIN_TRAIN_SEASONS, len(seasons)):
        test_season = seasons[i]
        train_seasons = seasons[:i]

        train_df = df[df["season"].isin(train_seasons)]
        test_df = df[df["season"] == test_season]

        X_train, y_train = prepare_xy(train_df)
        X_test, y_test = prepare_xy(test_df)

        # Align columns
        X_test = X_test[X_train.columns]

        cat_cols = [c for c in CAT_COLS if c in X_train.columns]

        model = build_model()
        model.fit(X_train, y_train, categorical_feature=cat_cols)

        preds = model.predict(X_test)

        zero_preds = np.zeros_like(y_test)
        mean_value = float(np.mean(y_train))
        mean_preds = np.full_like(y_test, mean_value, dtype=float)

        fold = {
            "test_season": test_season,
            "rows_train": int(len(train_df)),
            "rows_test": int(len(test_df)),
            "mae": float(mean_absolute_error(y_test, preds)),
            "rmse": rmse(y_test, preds),
            "zero_baseline_mae": float(mean_absolute_error(y_test, zero_preds)),
            "zero_baseline_rmse": rmse(y_test, zero_preds),
            "mean_baseline_value": mean_value,
            "mean_baseline_mae": float(mean_absolute_error(y_test, mean_preds)),
            "mean_baseline_rmse": rmse(y_test, mean_preds),
        }

        fold["mae_improve_vs_zero"] = fold["zero_baseline_mae"] - fold["mae"]
        fold["mae_improve_vs_mean"] = fold["mean_baseline_mae"] - fold["mae"]

        rows.append(fold)

    return pd.DataFrame(rows)


def run() -> None:
    print("📥 Loading baseline features...")
    df = pd.read_csv(IN_PATH, low_memory=False)

    # Explicit categoricals for LightGBM
    for c in CAT_COLS:
        if c in df.columns:
            df[c] = df[c].astype("category")

    seasons = sorted(df["season"].dropna().unique().tolist())

    if len(seasons) < MIN_TRAIN_SEASONS + 1:
        raise ValueError(f"Not enough seasons for rolling CV: {seasons}")

    # -----------------------
    # 1) Rolling-season CV
    # -----------------------
    print("🔁 Running rolling-season CV...")
    cv_df = rolling_season_cv(df, seasons)

    OUT_CV.parent.mkdir(parents=True, exist_ok=True)
    cv_df.to_csv(OUT_CV, index=False)

    cv_summary = {
        "folds": int(len(cv_df)),
        "mae_mean": float(cv_df["mae"].mean()),
        "rmse_mean": float(cv_df["rmse"].mean()),
        "mae_improve_vs_zero_mean": float(cv_df["mae_improve_vs_zero"].mean()),
        "mae_improve_vs_mean_mean": float(cv_df["mae_improve_vs_mean"].mean()),
    }

    print("📊 Rolling CV summary:", cv_summary)

    # -----------------------
    # 2) Optional final holdout
    # -----------------------
    if TEST_SEASON and TEST_SEASON in seasons:
        print(f"\n🏁 Training final model (holdout={TEST_SEASON})")

        train_df = df[df["season"] != TEST_SEASON]
        test_df = df[df["season"] == TEST_SEASON]

        X_train, y_train = prepare_xy(train_df)
        X_test, y_test = prepare_xy(test_df)
        X_test = X_test[X_train.columns]

        cat_cols = [c for c in CAT_COLS if c in X_train.columns]

        model = build_model()
        model.fit(X_train, y_train, categorical_feature=cat_cols)
        preds = model.predict(X_test)

        metrics = {
            "test_season": TEST_SEASON,
            "rows_train": int(len(train_df)),
            "rows_test": int(len(test_df)),
            "mae": float(mean_absolute_error(y_test, preds)),
            "rmse": rmse(y_test, preds),
            "rolling_cv": cv_summary,
        }

        OUT_MODEL.parent.mkdir(parents=True, exist_ok=True)
        OUT_METRICS.parent.mkdir(parents=True, exist_ok=True)

        joblib.dump(model, OUT_MODEL)
        OUT_METRICS.write_text(json.dumps(metrics, indent=2))

        imp = pd.DataFrame({
            "feature": X_train.columns,
            "importance": model.feature_importances_,
        }).sort_values("importance", ascending=False)

        OUT_IMPORTANCE.parent.mkdir(parents=True, exist_ok=True)
        imp.to_csv(OUT_IMPORTANCE, index=False)

        print("✅ Saved final model & metrics")
        print("Top features:")
        print(imp.head(15).to_string(index=False))


if __name__ == "__main__":
    run()
