# ml/pipelines/features/build_extended_features.py
"""
Extended Feature Engineering for FPL Prediction

Adds to baseline features:
1. Extended time windows: roll10 (10-game form)
2. Season averages: season_avg (full season context)
3. Trend features: form momentum indicators
4. Availability features: consecutive starts, minutes trend

Based on OpenFPL SOTA which uses windows: 1, 3, 5, 10, 38
"""

from pathlib import Path

import numpy as np
import pandas as pd


IN_PATH = Path("data/processed/merged/fpl_with_target.csv")
OUT_PATH = Path("data/features/extended_features.csv")

# Time windows: baseline uses [3, 5], we add [10]
ROLL_WINDOWS = [3, 5, 10]

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

# Subset of columns for season averages (avoid explosion)
SEASON_AVG_COLS = [
    "total_points",
    "minutes",
    "expected_goals",
    "expected_assists",
    "influence",
    "creativity",
    "threat",
    "bps",
]


def add_extended_features(df: pd.DataFrame, g, num_cols: list) -> pd.DataFrame:
    """Add extended time window features."""

    print("  Adding roll10 features...")
    for col in num_cols:
        # Roll10: 10-game rolling average (captures form cycles)
        df[f"{col}_roll10"] = g[col].shift(1).rolling(window=10, min_periods=3).mean()

    return df


def add_season_avg_features(df: pd.DataFrame, num_cols: list) -> pd.DataFrame:
    """Add expanding season average features (all games so far this season)."""

    print("  Adding season average features...")

    # Group by season and element for expanding mean
    g_season = df.groupby(["season", "element"], sort=False)

    for col in num_cols:
        if col in SEASON_AVG_COLS:
            # Expanding mean of all previous games this season
            df[f"{col}_season_avg"] = g_season[col].transform(
                lambda x: x.shift(1).expanding(min_periods=1).mean()
            )

    return df


def add_availability_features(df: pd.DataFrame, g) -> pd.DataFrame:
    """Add features related to player availability/rotation."""

    print("  Adding availability features...")

    # Consecutive starts (momentum indicator)
    # Count how many consecutive games the player has started
    if "starts" in df.columns:
        starts_shifted = g["starts"].shift(1)

        def count_consecutive(x):
            """Count consecutive 1s (starts) ending at each position."""
            result = np.zeros(len(x))
            count = 0
            for i, val in enumerate(x):
                if val == 1:
                    count += 1
                else:
                    count = 0
                result[i] = count
            return result

        df["consecutive_starts"] = g["starts"].transform(
            lambda x: pd.Series(count_consecutive(x.shift(1).fillna(0).values), index=x.index)
        )

    # Minutes trend (increasing = more likely to play full 90)
    if "minutes" in df.columns:
        df["minutes_trend"] = g["minutes"].shift(1).rolling(window=3, min_periods=2).apply(
            lambda x: (x.iloc[-1] - x.iloc[0]) / max(x.iloc[0], 1) if len(x) >= 2 else 0,
            raw=False
        )

    # Games since last start (rotation indicator)
    if "starts" in df.columns:
        def games_since_start(x):
            """Count games since last start."""
            result = np.zeros(len(x))
            count = 0
            for i, val in enumerate(x):
                if val == 1:
                    count = 0
                else:
                    count += 1
                result[i] = count
            return result

        df["games_since_start"] = g["starts"].transform(
            lambda x: pd.Series(games_since_start(x.shift(1).fillna(0).values), index=x.index)
        )

    return df


def add_form_momentum_features(df: pd.DataFrame, g) -> pd.DataFrame:
    """Add form momentum features (short-term vs long-term form)."""

    print("  Adding form momentum features...")

    # Form momentum: roll3 - roll10 (positive = improving form)
    if "total_points_roll3" in df.columns and "total_points_roll10" in df.columns:
        df["points_momentum"] = df["total_points_roll3"] - df["total_points_roll10"]

    # BPS momentum (underlying performance)
    if "bps_roll3" in df.columns and "bps_roll10" in df.columns:
        df["bps_momentum"] = df["bps_roll3"] - df["bps_roll10"]

    # xG momentum (attacking threat trend)
    if "expected_goals_roll3" in df.columns and "expected_goals_roll10" in df.columns:
        df["xg_momentum"] = df["expected_goals_roll3"] - df["expected_goals_roll10"]

    return df


def run() -> None:
    print("=" * 60)
    print("Extended Feature Engineering")
    print("=" * 60)

    print("\n📥 Loading fpl_with_target...")
    df = pd.read_csv(IN_PATH, low_memory=False)

    # Ordering keys
    df["GW"] = pd.to_numeric(df["GW"], errors="coerce")
    df["element"] = pd.to_numeric(df["element"], errors="coerce")

    # Stable categoricals
    if "team" in df.columns:
        df["team"] = df["team"].astype(str)
    if "position" in df.columns:
        df["position"] = df["position"].astype(str)

    df = df.sort_values(["season", "element", "GW"]).reset_index(drop=True)
    g = df.groupby(["season", "element"], sort=False)

    # Add Understat numeric columns
    us_cols = [c for c in df.columns if c.startswith("us_")]
    num_cols = []
    for c in (BASE_NUM_COLS + us_cols):
        if c in df.columns:
            df[c] = pd.to_numeric(df[c], errors="coerce")
            num_cols.append(c)

    print(f"\n📊 Numeric columns: {len(num_cols)}")

    # ---- Baseline features (lag1, roll3, roll5) ----
    print("\n🔧 Building baseline features...")

    # Lag-1 features
    for col in num_cols:
        df[f"{col}_lag1"] = g[col].shift(1)

    # Rolling mean features
    for w in ROLL_WINDOWS:
        for col in num_cols:
            df[f"{col}_roll{w}"] = g[col].shift(1).rolling(window=w, min_periods=1).mean()

    # Played last GW
    if "minutes_lag1" in df.columns:
        df["played_lag1"] = (df["minutes_lag1"] > 0).astype(int)
    else:
        df["played_lag1"] = 0

    # ---- Extended features ----
    print("\n🚀 Building extended features...")

    # Season averages
    df = add_season_avg_features(df, num_cols)

    # Availability features
    df = add_availability_features(df, g)

    # Form momentum (after roll features exist)
    df = add_form_momentum_features(df, g)

    # ---- Cleanup ----
    print("\n🧹 Cleaning up...")

    # Require at least 1 previous GW
    before = len(df)
    if "total_points_lag1" in df.columns:
        df = df.dropna(subset=["total_points_lag1"]).copy()
    after = len(df)

    # Remove duplicate columns
    df = df.loc[:, ~df.columns.duplicated()].copy()

    # Select output columns
    keep = [
        "season", "GW", "element", "name", "position", "team",
        "was_home", "opponent_team", "value",
        "points_next_gw",
        "played_lag1",
    ]
    keep = [c for c in keep if c in df.columns]

    # All engineered features
    feature_cols = [c for c in df.columns if (
        c.endswith("_lag1") or
        "_roll" in c or
        "_season_avg" in c or
        "_momentum" in c or
        c in ["consecutive_starts", "minutes_trend", "games_since_start"]
    ) and c != "played_lag1"]

    keep += feature_cols
    out = df[keep].copy()

    # ---- Save ----
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    out.to_csv(OUT_PATH, index=False)

    print("\n✅ Saved:", OUT_PATH)
    print(f"   Rows dropped (no lag history): {before - after}")
    print(f"   Final shape: {out.shape}")

    # Summary
    baseline_features = len([c for c in out.columns if "_roll3" in c or "_roll5" in c or c.endswith("_lag1")])
    extended_features = len([c for c in out.columns if "_roll10" in c or "_season_avg" in c or "_momentum" in c])
    availability_features = len([c for c in out.columns if c in ["consecutive_starts", "minutes_trend", "games_since_start"]])

    print(f"\n📈 Feature breakdown:")
    print(f"   Baseline (lag1, roll3, roll5): {baseline_features}")
    print(f"   Extended (roll10, season_avg, momentum): {extended_features}")
    print(f"   Availability: {availability_features}")
    print(f"   Metadata: {len(keep) - baseline_features - extended_features - availability_features}")
    print(f"   Total: {len(out.columns)}")


if __name__ == "__main__":
    run()
