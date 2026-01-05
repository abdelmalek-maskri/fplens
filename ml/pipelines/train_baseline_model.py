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

TEST_SEASON = "2023-24"   # clean default
DROP_COLS = ["name"]      # not useful for model

def rmse(y_true, y_pred):
    return float(np.sqrt(mean_squared_error(y_true, y_pred)))

def run():
    print("📥 Loading features...")
    df = pd.read_csv(IN_PATH, low_memory=False)

    # Make categoricals explicit for LightGBM
    for c in ["season", "position", "team", "opponent_team"]:
        if c in df.columns:
            df[c] = df[c].astype("category")


    # Train/test split by season (time-aware)
    train_df = df[df["season"] != TEST_SEASON].copy()
    test_df  = df[df["season"] == TEST_SEASON].copy()

    if len(test_df) == 0:
        raise ValueError(f"No rows found for TEST_SEASON={TEST_SEASON}. Available: {sorted(df['season'].unique())}")

    y_train = train_df["points_next_gw"].values
    y_test  = test_df["points_next_gw"].values

    # Feature columns: everything except target + identifiers you don’t want
    drop = set(["points_next_gw"] + DROP_COLS)
    X_train = train_df.drop(columns=[c for c in drop if c in train_df.columns])
    X_test  = test_df.drop(columns=[c for c in drop if c in test_df.columns])

    # Ensure same columns
    X_test = X_test[X_train.columns]

    # Categorical features
    cat_cols = [c for c in ["season", "position", "team", "opponent_team"] if c in X_train.columns]


    print("🧠 Training LightGBM baseline...")
    model = LGBMRegressor(
        n_estimators=800,
        learning_rate=0.05,
        num_leaves=63,
        subsample=0.8,
        colsample_bytree=0.8,
        random_state=42,
        n_jobs=-1
    )

    model.fit(X_train, y_train, categorical_feature=cat_cols)

    preds = model.predict(X_test)

    # ---- Zero baseline (predict all zeros) ----
    zero_preds = np.zeros_like(y_test)
    
    zero_mae = float(mean_absolute_error(y_test, zero_preds))
    zero_rmse = rmse(y_test, zero_preds)

    print("\n📉 Zero baseline:")
    print(f"  MAE : {zero_mae:.4f}")
    print(f"  RMSE: {zero_rmse:.4f}")

    # ---- Mean baseline (predict train mean) ----
    mean_pred = np.full_like(y_test, fill_value=y_train.mean(), dtype=float)
    mean_baseline_value = float(np.mean(y_train))
    mean_baseline_mae = float(mean_absolute_error(y_test, mean_pred))
    mean_baseline_rmse = rmse(y_test, mean_pred)


    metrics = {
    "test_season": TEST_SEASON,
    "rows_train": int(len(train_df)),
    "rows_test": int(len(test_df)),

    # Model performance
    "mae": float(mean_absolute_error(y_test, preds)),
    "rmse": rmse(y_test, preds),

    # Baseline performance
    "zero_baseline_mae": zero_mae,
    "zero_baseline_rmse": zero_rmse,

    # Mean baseline performance
    "mean_baseline_value": mean_baseline_value,
    "mean_baseline_mae": mean_baseline_mae,
    "mean_baseline_rmse": mean_baseline_rmse,
    }   

    print("model mae:", metrics["mae"])
    print("model rmse:", metrics["rmse"])

    print("\n📈 Model vs Zero baseline:")
    print(f"  MAE improvement : {zero_mae - metrics['mae']:.4f}")
    print(f"  RMSE improvement: {zero_rmse - metrics['rmse']:.4f}")
    print(f"\n📊 Model vs Mean baseline value ({mean_baseline_value:.4f}):")
    print(f"  MAE improvement : {mean_baseline_mae - metrics['mae']:.4f}")
    print(f"  RMSE improvement: {mean_baseline_rmse - metrics['rmse']:.4f}")



    OUT_MODEL.parent.mkdir(parents=True, exist_ok=True)
    OUT_METRICS.parent.mkdir(parents=True, exist_ok=True)

    joblib.dump(model, OUT_MODEL)
    OUT_METRICS.write_text(json.dumps(metrics, indent=2))

    # Feature importance
    imp = pd.DataFrame({
        "feature": X_train.columns,
        "importance": model.feature_importances_
    }).sort_values("importance", ascending=False)
    imp.to_csv(OUT_IMPORTANCE, index=False)

    print("✅ Saved model:", OUT_MODEL)
    print("✅ Saved metrics:", OUT_METRICS)
    print("✅ Saved importance:", OUT_IMPORTANCE)
    print("\n📊 Metrics:")
    print(metrics)
    print("\nTop 15 features:")
    print(imp.head(15).to_string(index=False))

if __name__ == "__main__":
    run()
