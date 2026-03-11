# ml/pipelines/features/create_target.py (12)

from pathlib import Path
import pandas as pd

IN_PATH = Path("data/processed/merged/fpl_base_enriched.csv")
OUT_PATH = Path("data/processed/merged/fpl_with_target.csv")

# All target horizons: column name → shift amount
TARGET_HORIZONS = {
    "points_next_gw": 1,
    "points_gw_plus_2": 2,
    "points_gw_plus_3": 3,
}


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

    # Create all target columns — group by (season, element) to prevent
    # cross-season leakage (e.g. last GW of 2023-24 must NOT shift into 2024-25)
    g = df.groupby(["season", "element"])["total_points"]
    for col, shift_n in TARGET_HORIZONS.items():
        print(f"Creating {col} (shift={shift_n})...")
        df[col] = g.shift(-shift_n)

    # Only drop rows where the primary target (GW+1) is NaN — downstream
    # training scripts handle NaN in GW+2/GW+3 per their horizon.
    before = len(df)
    df = df.dropna(subset=["points_next_gw"]).copy()
    after = len(df)

    # Points are integers
    for col in TARGET_HORIZONS:
        if col in df.columns:
            # GW+2/GW+3 may have NaN at season boundaries — keep as float
            if col == "points_next_gw":
                df[col] = df[col].astype(int)
            else:
                df[col] = df[col].astype("Int64")  # nullable integer

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(OUT_PATH, index=False)

    print(f"\nSaved: {OUT_PATH}")
    print(f"Rows dropped (no GW+1 target): {before - after}")
    print("Final shape:", df.shape)

    # Per-horizon coverage
    for col, shift_n in TARGET_HORIZONS.items():
        valid = df[col].notna().sum()
        print(f"  {col}: {valid} valid rows ({len(df) - valid} NaN at season boundaries)")

    # Sanity sample
    target_cols = list(TARGET_HORIZONS.keys())
    print("\nSample columns check:")
    print(df[["season", "GW", "element", "name", "total_points"] + target_cols].head(8))


if __name__ == "__main__":
    run()
