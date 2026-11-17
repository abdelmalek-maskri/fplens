"""Build the thing every model is trying to predict.

A player's points n gameweeks from now, as a column on the row describing now.
The shift is negative because the answer lies in the future relative to the
features, and it is grouped by season so no row ever learns its target from a
different season.
"""

from pathlib import Path

import pandas as pd

# ---------------------------------------------------------------------------
IN_PATH = Path("data/processed/merged/fpl_understat_merged.csv")
OUT_PATH = Path("data/processed/merged/fpl_with_target.csv")
TARGET_HORIZONS = {  # output column -> gameweeks ahead
    "points_next_gw": 1,
    "points_gw_plus_2": 2,
    "points_gw_plus_3": 3,
}
# ---------------------------------------------------------------------------


def run():
    """Add the GW+1, GW+2 and GW+3 point targets to the merged table."""
    print("loading fpl_with_understat table...")
    df = pd.read_csv(IN_PATH, low_memory=False)

    # numeric keys, then drop rows that cannot be placed
    # A GW read as a string sorts 10 before 2, which would silently shift the
    # wrong row into the target.
    df["GW"] = pd.to_numeric(df["GW"], errors="coerce")
    df["element"] = pd.to_numeric(df["element"], errors="coerce")
    df["total_points"] = pd.to_numeric(df["total_points"], errors="coerce")
    df = df.dropna(subset=["season", "GW", "element", "total_points"]).copy()

    # build the targets
    # shift(-n) takes the row n positions below, so this sort is what makes
    # "below" mean "next gameweek" rather than whatever came next in the file.
    # Grouping by season as well as player gives the last gameweek of a season
    # a missing target instead of the first gameweek of the next one.
    df = df.sort_values(["season", "element", "GW"]).reset_index(drop=True)
    grouped_points = df.groupby(["season", "element"])["total_points"]
    for col, shift_n in TARGET_HORIZONS.items():
        print(f"creating {col} (shift={shift_n})...")
        df[col] = grouped_points.shift(-shift_n)

    # GW+1 is required: a row with no next gameweek cannot train anything.
    # GW+2 and GW+3 may be missing, because the last rows of a season have no
    # answer and the horizon models drop them themselves. Int64, not int, for
    # those two: plain int cannot hold a missing value and would turn them into
    # zeros, which read as "scored nothing" rather than "not known".
    before = len(df)
    df = df.dropna(subset=["points_next_gw"]).copy()
    after = len(df)
    for col in TARGET_HORIZONS:
        if col in df.columns:
            if col == "points_next_gw":
                df[col] = df[col].astype(int)
            else:
                df[col] = df[col].astype("Int64")

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(OUT_PATH, index=False)

    # report
    print(f"\nSaved: {OUT_PATH}")
    print(f"Rows dropped (no GW+1 target): {before - after}")
    print("Final shape:", df.shape)
    for col in TARGET_HORIZONS:
        valid = df[col].notna().sum()
        print(f"{col}: {valid} valid rows ({len(df) - valid} NaN at season boundaries)")
    target_cols = list(TARGET_HORIZONS.keys())
    print("\nSample columns check:")
    print(df[["season", "GW", "element", "name", "total_points"] + target_cols].head(8))


if __name__ == "__main__":
    run()
