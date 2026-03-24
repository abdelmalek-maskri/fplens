# ml/pipelines/features/create_target.py

from pathlib import Path

import pandas as pd

IN_PATH = Path("data/processed/merged/fpl_understat_merged.csv")
OUT_PATH = Path("data/processed/merged/fpl_with_target.csv")

# Forecast horizons: output column -> number of gameweeks ahead
TARGET_HORIZONS = {
    "points_next_gw": 1,
    "points_gw_plus_2": 2,
    "points_gw_plus_3": 3,
}


def run():
    print("loading fpl_with_understat table...")
    df = pd.read_csv(IN_PATH, low_memory=False)

    # ensure key columns are numeric for reliable sorting and shifting
    df["GW"] = pd.to_numeric(df["GW"], errors="coerce")
    df["element"] = pd.to_numeric(df["element"], errors="coerce")
    df["total_points"] = pd.to_numeric(df["total_points"], errors="coerce")

    # remove rows with missing keys required for target construction
    df = df.dropna(subset=["season", "GW", "element", "total_points"]).copy()

    # sort by season, player, and gameweek so future shifts are well-defined
    df = df.sort_values(["season", "element", "GW"]).reset_index(drop=True)

    # create future-point targets within each (season, player) group to prevent cross-season leakage at season boundaries
    grouped_points = df.groupby(["season", "element"])["total_points"]
    for col, shift_n in TARGET_HORIZONS.items():
        print(f"creating {col} (shift={shift_n})...")
        df[col] = grouped_points.shift(-shift_n)

    # drop rows without a valid one-step-ahead target
    # longer-horizon missing values are handled during horizon-specific training
    before = len(df)
    df = df.dropna(subset=["points_next_gw"]).copy()
    after = len(df)

    # preserve nullable integers for horizons that can be missing near season end
    for col in TARGET_HORIZONS:
        if col in df.columns:
            if col == "points_next_gw":
                df[col] = df[col].astype(int)
            else:
                df[col] = df[col].astype("Int64")

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(OUT_PATH, index=False)

    print(f"\nSaved: {OUT_PATH}")
    print(f"Rows dropped (no GW+1 target): {before - after}")
    print("Final shape:", df.shape)

    # report target availability for each forecast horizon
    for col in TARGET_HORIZONS:
        valid = df[col].notna().sum()
        print(f"{col}: {valid} valid rows ({len(df) - valid} NaN at season boundaries)")

    # display a small sample for sanity checking
    target_cols = list(TARGET_HORIZONS.keys())
    print("\nSample columns check:")
    print(df[["season", "GW", "element", "name", "total_points"] + target_cols].head(8))


if __name__ == "__main__":
    run()
