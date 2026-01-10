import pandas as pd
from pathlib import Path

IN_PATH = Path("data/processed/merged/fpl_with_target.csv")
OUT_PATH = Path("data/features/baseline_features.csv")

ROLL_WINDOWS = [3, 5]

BASE_NUM_COLS = [
    "total_points",
    "minutes",
    "starts",
    "expected_goals",
    "expected_assists",
    "expected_goal_involvements",
    "expected_goals_conceded",
    "influence",
    "creativity",
    "threat",
    "ict_index",
    "bps",
    "bonus",
]

def run():
    print("📥 Loading fpl_with_target...")
    df = pd.read_csv(IN_PATH, low_memory=False)

    # Ensure correct ordering keys
    df["GW"] = pd.to_numeric(df["GW"], errors="coerce")
    df["element"] = pd.to_numeric(df["element"], errors="coerce")

    # Make categoricals stable
    df["team"] = df["team"].astype(str)
    df["position"] = df["position"].astype(str)

    df = df.sort_values(["season", "element", "GW"]).reset_index(drop=True)

    g = df.groupby(["season", "element"], sort=False)

    # ---- Lag 1 features (last GW only) ----
    for col in BASE_NUM_COLS:
        if col in df.columns:
            df[f"{col}_lag1"] = g[col].shift(1)

    # ---- Rolling mean features (past only) ----
    for w in ROLL_WINDOWS:
        for col in BASE_NUM_COLS:
            if col in df.columns:
                # shift(1) ensures we only use history up to GW-1
                df[f"{col}_roll{w}"] = g[col].shift(1).rolling(window=w, min_periods=1).mean()

    # Simple “played recently” binary
    df["played_lag1"] = ((df["minutes_lag1"] > 0).astype(int))


    # Drop rows where lag features are missing (first appearance for each player-season)
    # We keep it simple: require total_points_lag1 to exist
    before = len(df)
    df = df.dropna(subset=["total_points_lag1"]).copy()
    after = len(df)

    # Remove accidental duplicate columns
    df = df.loc[:, ~df.columns.duplicated()]


    # Select final columns for baseline model
        # Remove any accidental duplicate played_lag1 columns BEFORE feature selection
    df = df.drop(columns=[c for c in df.columns if c.startswith("played_lag1.")], errors="ignore")

    # Select final columns for baseline model
    keep = [
        "season", "GW", "element", "name", "position", "team",
        "was_home", "opponent_team", "value",
        "points_next_gw",
        "played_lag1",
    ]

    # Add generated feature cols (exclude played_lag1 itself)
    feature_cols = [
        c for c in df.columns
        if (c.endswith("_lag1") or "_roll" in c) and c != "played_lag1"
    ]
    keep += feature_cols

    out = df[keep].copy()



    out = df[keep].copy()

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    out.to_csv(OUT_PATH, index=False)

    print("✅ Saved:", OUT_PATH)
    print("Rows dropped (no lag history):", before - after)
    print("Final shape:", out.shape)
    print("Example columns:", out.columns[:25].tolist())

if __name__ == "__main__":
    run()
