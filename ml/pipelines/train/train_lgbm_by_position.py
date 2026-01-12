import json
import numpy as np
import pandas as pd
from pathlib import Path

from sklearn.metrics import mean_absolute_error, mean_squared_error
from lightgbm import LGBMRegressor

IN_PATH = Path("data/features/baseline_features.csv")
OUT_PATH = Path("outputs/metrics/lgbm_rolling_cv_by_position.csv")

POSITIONS = ["GK", "DEF", "MID", "FWD"]
DROP_COLS = ["name"]
MIN_TEST_ROWS = 1000  # safety

def rmse(y_true, y_pred):
    return float(np.sqrt(mean_squared_error(y_true, y_pred)))

def train_eval_fold(train_df, test_df):
    y_train = train_df["points_next_gw"].values
    y_test  = test_df["points_next_gw"].values

    drop = set(["points_next_gw"] + DROP_COLS)
    X_train = train_df.drop(columns=[c for c in drop if c in train_df.columns])
    X_test  = test_df.drop(columns=[c for c in drop if c in test_df.columns])

    X_test = X_test[X_train.columns]

    cat_cols = [c for c in ["season", "team", "opponent_team"] if c in X_train.columns]

    model = LGBMRegressor(
        n_estimators=600,
        learning_rate=0.05,
        num_leaves=63,
        subsample=0.8,
        colsample_bytree=0.8,
        random_state=42,
        n_jobs=-1
    )

    model.fit(X_train, y_train, categorical_feature=cat_cols)
    preds = model.predict(X_test)

    return {
        "mae": mean_absolute_error(y_test, preds),
        "rmse": rmse(y_test, preds),
        "rows_train": len(train_df),
        "rows_test": len(test_df),
    }

def run():
    print("📥 Loading features...")
    df = pd.read_csv(IN_PATH, low_memory=False)

    for c in ["season", "position", "team", "opponent_team"]:
        if c in df.columns:
            df[c] = df[c].astype("category")

    seasons = sorted(df["season"].unique())
    results = []

    print("🔁 Running rolling-season CV by position...")

    # ----------------------------------------
    # 1️⃣ Position-specific rolling CV
    # ----------------------------------------
    for pos in POSITIONS:
        print(f"\n🎯 Position: {pos}")
        df_pos = df[df["position"] == pos].copy()

        for i in range(3, len(seasons)):
            test_season = seasons[i]
            train_seasons = seasons[:i]

            train_df = df_pos[df_pos["season"].isin(train_seasons)]
            test_df  = df_pos[df_pos["season"] == test_season]

            if len(test_df) < MIN_TEST_ROWS:
                continue

            metrics = train_eval_fold(train_df, test_df)

            results.append({
                "position": pos,
                "test_season": test_season,
                "train_seasons": ",".join(train_seasons),
                **metrics,
            })

            print(
                f"  {test_season} | "
                f"MAE={metrics['mae']:.4f} | "
                f"RMSE={metrics['rmse']:.4f}"
            )

    # ----------------------------------------
    # 2️⃣ Convert to DataFrame (CRITICAL)
    # ----------------------------------------
    out = pd.DataFrame(results)
    out.to_csv(OUT_PATH, index=False)

    print("\n✅ Saved per-position CV:", OUT_PATH)

    # ----------------------------------------
    # 3️⃣ Automatic weighted aggregation
    # ----------------------------------------
    print("\n⚖️ Weighted aggregation across positions:")

    weighted_rows = []

    for season, fold in out.groupby("test_season"):
        total_rows = fold["rows_test"].sum()

        weighted_mae = np.sum(fold["mae"] * fold["rows_test"]) / total_rows
        weighted_rmse = np.sum(fold["rmse"] * fold["rows_test"]) / total_rows

        weighted_rows.append({
            "test_season": season,
            "weighted_mae": weighted_mae,
            "weighted_rmse": weighted_rmse,
            "rows_test": total_rows,
        })

        print(
            f"{season} | "
            f"Weighted MAE={weighted_mae:.4f} | "
            f"Weighted RMSE={weighted_rmse:.4f}"
        )

    weighted_df = pd.DataFrame(weighted_rows)

    print("\n📊 Final CV result (position-specific system):")
    print(weighted_df[["weighted_mae", "weighted_rmse"]].agg(["mean", "std"]).round(4))

    weighted_df.to_csv(
        "outputs/metrics/lgbm_position_weighted_cv.csv",
        index=False
    )



if __name__ == "__main__":
    run()
