# ml/pipelines/features/create_target.py (12)

from pathlib import Path

import pandas as pd

IN_PATH = Path("data/processed/merged/fpl_base_enriched.csv")
OUT_PATH = Path("data/processed/merged/fpl_with_target.csv")


def run():
    print("Loading base_enriched table...")
    df = pd.read_csv(IN_PATH, low_memory=False)

    # Ensure numeric ordering keys
    df["GW"] = pd.to_numeric(df["GW"], errors="coerce")
    df["element"] = pd.to_numeric(df["element"], errors="coerce")
    df["total_points"] = pd.to_numeric(df["total_points"], errors="coerce")

    # Drop rows missing essential keys
    df = df.dropna(subset=["season", "GW", "element", "total_points"]).copy()

    # Sort so shift works correctly
    df = df.sort_values(["season", "element", "GW"]).reset_index(drop=True)

    print("Creating points_next_gw...")
    df["points_next_gw"] = df.groupby(["season", "element"])["total_points"].shift(-1)

    before = len(df)
    df = df.dropna(subset=["points_next_gw"]).copy()
    after = len(df)

    # Points should be integer
    df["points_next_gw"] = df["points_next_gw"].astype(int)

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(OUT_PATH, index=False)

    print(f"Saved: {OUT_PATH}")
    print(f"Rows dropped (no next GW): {before - after}")
    print("Final shape:", df.shape)

    # Tiny sanity sample
    print("\nSample columns check:")
    print(df[["season", "GW", "element", "name", "total_points", "points_next_gw"]].head(8))


if __name__ == "__main__":
    run()
