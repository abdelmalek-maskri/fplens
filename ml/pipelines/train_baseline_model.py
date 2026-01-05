import json
import joblib
import numpy as np
import pandas as pd
from pathlib import Path

from sklearn.metrics import mean_absolute_error, mean_squared_error
from lightgbm import LGBMRegressor

IN_PATH = Path("data/features/baseline_features.csv")
OUT_MODEL = Path("outputs/models/lgbm_baseline.joblib")
OUT_METRICS = Path("outputs/metrics/lgbm_baseline.json")
OUT_IMPORTANCE = Path("outputs/metrics/lgbm_feature_importance.csv")
OUT_CV = Path("outputs/metrics/lgbm_rolling_cv.csv")

TEST_SEASON = "2023-24"   # optional final holdout
DROP_COLS = ["name"]      # not useful for model

# Rolling CV settings:
MIN_TRAIN_SEASONS = 3     # require at least this many seasons before we start evaluating folds

def rmse(y_true, y_pred):
    return float(np.sqrt(mean_squared_error(y_true, y_pred)))

def build_model():
    return LGBMRegressor(
        n_estimators=800,
        learning_rate=0.05,
        num_leaves=63,
        subsample=0.8,
        colsample_bytree=0.8,
        random_state=42,
        n_jobs=-1
    )

def prepare_xy(df, drop_cols):
    y = df["points_next_gw"].values
    drop = set(["points_next_gw"] + drop_cols)
    X = df.drop(columns=[c for c in drop if c in df.columns])
    return X, y

def rolling_season_cv(df, seasons, cat_base_cols):
    """
    For each fold:
      train = seasons[:i]
      test  = seasons[i]
    starting from i = MIN_TRAIN_SEASONS
    """
    rows = []

    for i in range(MIN_TRAIN_SEASONS, len(seasons)):
        test_season = seasons[i]
        train_seasons = seasons[:i]

        train_df = df[df["season"].isin(train_seasons)].copy()
        test_df  = df[df["season"] == test_season].copy()

        # Prepare features/targets
        X_train, y_train = prepare_xy(train_df, DROP_COLS)
        X_test, y_test = prepare_xy(test_df, DROP_COLS)

        # Ensure same columns
        X_test = X_test[X_train.columns]

        # Categorical columns present in X
        cat_cols = [c for c in cat_base_cols if c in X_train.columns]

        # Train model
        model = build_model()
        model.fit(X_train, y_train, categorical_feature=cat_cols)

        preds = model.predict(X_test)

        # Baselines
        zero_preds = np.zeros_like(y_test)
        mean_value = float(np.mean(y_train))
        mean_preds = np.full_like(y_test, fill_value=mean_value, dtype=float)

        fold = {
            "test_season": test_season,
            "train_seasons": ",".join(train_seasons),
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

        # Improvements (positive = model better)
        fold["mae_improve_vs_zero"] = fold["zero_baseline_mae"] - fold["mae"]
        fold["rmse_improve_vs_zero"] = fold["zero_baseline_rmse"] - fold["rmse"]
        fold["mae_improve_vs_mean"] = fold["mean_baseline_mae"] - fold["mae"]
        fold["rmse_improve_vs_mean"] = fold["mean_baseline_rmse"] - fold["rmse"]

        rows.append(fold)

    return pd.DataFrame(rows)

def run():
    print("📥 Loading features...")
    df = pd.read_csv(IN_PATH, low_memory=False)

    # Make categoricals explicit for LightGBM
    cat_base_cols = ["season", "position", "team", "opponent_team"]
    for c in cat_base_cols:
        if c in df.columns:
            df[c] = df[c].astype("category")

    # Ensure seasons sorted (very important for rolling CV)
    seasons = sorted(df["season"].dropna().unique().tolist())

    if len(seasons) < (MIN_TRAIN_SEASONS + 1):
        raise ValueError(
            f"Not enough seasons for rolling CV. Have {len(seasons)} seasons: {seasons}. "
            f"Need at least {MIN_TRAIN_SEASONS + 1}."
        )

    # -----------------------
    # 1) Rolling-season CV
    # -----------------------
    print("🔁 Running rolling-season CV...")
    cv_df = rolling_season_cv(df, seasons, cat_base_cols)

    OUT_CV.parent.mkdir(parents=True, exist_ok=True)
    cv_df.to_csv(OUT_CV, index=False)

    # Summaries
    cv_summary = {
        "folds": int(len(cv_df)),
        "mae_mean": float(cv_df["mae"].mean()),
        "mae_std": float(cv_df["mae"].std(ddof=1)) if len(cv_df) > 1 else 0.0,
        "rmse_mean": float(cv_df["rmse"].mean()),
        "rmse_std": float(cv_df["rmse"].std(ddof=1)) if len(cv_df) > 1 else 0.0,
        "mae_improve_vs_zero_mean": float(cv_df["mae_improve_vs_zero"].mean()),
        "mae_improve_vs_mean_mean": float(cv_df["mae_improve_vs_mean"].mean()),
    }

    print("✅ Saved rolling CV:", OUT_CV)
    print("📊 Rolling CV summary:", cv_summary)

    # -----------------------
    # 2) Optional final holdout training (your existing behavior)
    # -----------------------
    print("\n🏁 Training final model with holdout test season:", TEST_SEASON)

    train_df = df[df["season"] != TEST_SEASON].copy()
    test_df = df[df["season"] == TEST_SEASON].copy()

    if len(test_df) == 0:
        raise ValueError(
            f"No rows found for TEST_SEASON={TEST_SEASON}. Available: {sorted(df['season'].unique())}"
        )

    X_train, y_train = prepare_xy(train_df, DROP_COLS)
    X_test, y_test = prepare_xy(test_df, DROP_COLS)
    X_test = X_test[X_train.columns]
    cat_cols = [c for c in cat_base_cols if c in X_train.columns]

    model = build_model()
    model.fit(X_train, y_train, categorical_feature=cat_cols)
    preds = model.predict(X_test)

    # Baselines on holdout
    zero_preds = np.zeros_like(y_test)
    mean_value = float(np.mean(y_train))
    mean_preds = np.full_like(y_test, fill_value=mean_value, dtype=float)

    metrics = {
        "test_season": TEST_SEASON,
        "rows_train": int(len(train_df)),
        "rows_test": int(len(test_df)),

        "mae": float(mean_absolute_error(y_test, preds)),
        "rmse": rmse(y_test, preds),

        "zero_baseline_mae": float(mean_absolute_error(y_test, zero_preds)),
        "zero_baseline_rmse": rmse(y_test, zero_preds),

        "mean_baseline_value": mean_value,
        "mean_baseline_mae": float(mean_absolute_error(y_test, mean_preds)),
        "mean_baseline_rmse": rmse(y_test, mean_preds),

        # Rolling CV summary included for reference
        "rolling_cv": cv_summary,
    }

    print("\n📉 Holdout baselines:")
    print(f"  Zero baseline MAE : {metrics['zero_baseline_mae']:.4f}")
    print(f"  Mean baseline MAE : {metrics['mean_baseline_mae']:.4f} (mean={mean_value:.4f})")

    print("\n📊 Holdout model metrics:")
    print(f"  Model MAE : {metrics['mae']:.4f}")
    print(f"  Model RMSE: {metrics['rmse']:.4f}")

    print("\n📈 Holdout improvements:")
    print(f"  MAE improve vs zero: {metrics['zero_baseline_mae'] - metrics['mae']:.4f}")
    print(f"  MAE improve vs mean: {metrics['mean_baseline_mae'] - metrics['mae']:.4f}")

    # Save outputs
    OUT_MODEL.parent.mkdir(parents=True, exist_ok=True)
    OUT_METRICS.parent.mkdir(parents=True, exist_ok=True)

    joblib.dump(model, OUT_MODEL)
    OUT_METRICS.write_text(json.dumps(metrics, indent=2))

    # Feature importance from final model
    imp = pd.DataFrame({
        "feature": X_train.columns,
        "importance": model.feature_importances_
    }).sort_values("importance", ascending=False)
    OUT_IMPORTANCE.parent.mkdir(parents=True, exist_ok=True)
    imp.to_csv(OUT_IMPORTANCE, index=False)

    print("\n✅ Saved model:", OUT_MODEL)
    print("✅ Saved metrics:", OUT_METRICS)
    print("✅ Saved importance:", OUT_IMPORTANCE)
    print("\nTop 15 features (final model):")
    print(imp.head(15).to_string(index=False))

if __name__ == "__main__":
    run()
