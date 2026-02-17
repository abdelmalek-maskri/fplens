"""
Merge injury snapshots with the main FPL dataset.

Applies a +1 GW temporal shift to prevent leakage: GW N predictions use
injury status known after GW N-1. GW 1 of each season has no injury data
and gets filled with safe defaults.
"""

from pathlib import Path

import pandas as pd

INJURY_DATA = Path("data/processed/injury/injury_states.csv")
FPL_BASE = Path("data/processed/merged/fpl_base_enriched.csv")
OUTPUT_PATH = Path("data/processed/injury/fpl_with_injury.csv")

# snapshot_date needed downstream to parse absolute return dates
_INJURY_COLS = [
    "season",
    "GW",
    "element",
    "status",
    "chance_of_playing_this_round",
    "chance_of_playing_next_round",
    "news",
    "news_added",
    "snapshot_date",
]


def analyse_status_churn(injury_df: pd.DataFrame) -> None:
    """Quantify GW-over-GW status changes (upper bound on unshifted leakage)."""
    print("\n" + "-" * 60)
    print("STATUS CHURN ANALYSIS (GW N vs GW N-1)")
    print("-" * 60)

    df = injury_df[["season", "GW", "element", "status"]].copy()
    df = df.sort_values(["season", "element", "GW"])
    df["prev_status"] = df.groupby(["season", "element"])["status"].shift(1)

    paired = df.dropna(subset=["prev_status"])
    changed = paired[paired["status"] != paired["prev_status"]]

    total = len(paired)
    n_changed = len(changed)
    rate = n_changed / total * 100 if total > 0 else 0

    print(f"\nConsecutive GW pairs: {total:,}")
    print(f"Status changes:       {n_changed:,}")
    print(f"Churn rate:           {rate:.2f}%")

    if n_changed > 0:
        print("\nTop transitions (prev -> current):")
        transitions = (
            changed.groupby(["prev_status", "status"])
            .size()
            .reset_index(name="count")
            .sort_values("count", ascending=False)
        )
        for _, row in transitions.head(10).iterrows():
            print(f"{row['prev_status']} -> {row['status']}: {row['count']:,}")

        leaked = changed[(changed["prev_status"] == "a") & (changed["status"] != "a")]
        print(f"\nLeakage-relevant (a -> non-a): {len(leaked):,} ({len(leaked) / total * 100:.2f}% of all pairs)")

    print()


def run() -> None:
    """Merge injury states with FPL base data, applying temporal shift."""
    print("=" * 60)
    print("MERGE INJURY DATA WITH FPL BASE")
    print("=" * 60)

    print("\nLoading data...")
    injury_df = pd.read_csv(INJURY_DATA)
    fpl_df = pd.read_csv(FPL_BASE, low_memory=False)
    print(f"Injury data: {len(injury_df):,} rows")
    print(f"FPL base:    {len(fpl_df):,} rows")

    for df in [injury_df, fpl_df]:
        df["season"] = df["season"].astype(str)
        df["GW"] = pd.to_numeric(df["GW"], errors="coerce")
        df["element"] = pd.to_numeric(df["element"], errors="coerce")

    # Churn analysis runs BEFORE shift to quantify what the shift prevents
    analyse_status_churn(injury_df)

    available_cols = [c for c in _INJURY_COLS if c in injury_df.columns]
    injury_subset = injury_df[available_cols].drop_duplicates(subset=["season", "GW", "element"])

    print("Applying temporal shift: injury GW N -> prediction GW N+1...")
    injury_subset = injury_subset.copy()
    injury_subset["GW"] = injury_subset["GW"] + 1
    print(f"Shifted {len(injury_subset):,} rows (+1 GW)")

    fpl_keys = set(zip(fpl_df["season"], fpl_df["GW"], fpl_df["element"]))
    injury_keys = set(zip(injury_subset["season"], injury_subset["GW"], injury_subset["element"]))
    overlap = fpl_keys & injury_keys
    print("\nKey overlap (after shift):")
    print(f"FPL keys:    {len(fpl_keys):,}")
    print(f"Injury keys: {len(injury_keys):,}")
    print(f"Overlap:     {len(overlap):,} ({len(overlap) / len(fpl_keys) * 100:.1f}%)")

    print("\nMerging...")
    merged = fpl_df.merge(injury_subset, on=["season", "GW", "element"], how="left")
    print(f"Result: {len(merged):,} rows, {len(merged.columns)} columns")

    merged["status"] = merged["status"].fillna("a")
    merged["chance_of_playing_this_round"] = merged["chance_of_playing_this_round"].fillna(100.0)
    merged["chance_of_playing_next_round"] = merged["chance_of_playing_next_round"].fillna(100.0)

    print("\nMerged summary:")
    print(f"Seasons:               {sorted(merged['season'].unique())}")
    print(f"Non-available players: {(merged['status'] != 'a').sum():,}")
    print(f"Players with news:     {merged['news'].notna().sum():,}")

    for season in sorted(merged["season"].unique()):
        gw1 = merged[(merged["season"] == season) & (merged["GW"] == 1)]
        gw1_news = gw1[gw1["news"].notna()]
        print(f"{season} GW1: {len(gw1)} players, {len(gw1_news)} with injury data (expected ~0 due to shift)")

    print("\nStatus distribution:")
    print(merged["status"].value_counts().to_string())

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    merged.to_csv(OUTPUT_PATH, index=False)

    print(f"\n{'=' * 60}")
    print("MERGE COMPLETE")
    print(f"{'=' * 60}")
    print(f"Output: {OUTPUT_PATH}")
    print(f"Shape:  {merged.shape}")


if __name__ == "__main__":
    run()
