"""
Merge injury data with main FPL dataset.
Takes the injury states downloaded from historical snapshots and merges
them with fpl_base.csv. Injury snapshots are shifted by +1 GW so that
GW N predictions use the injury status known *after* GW N-1 (i.e. before
GW N starts). This prevents temporal leakage from post-match status updates.
"""

from pathlib import Path
import pandas as pd

INJURY_DATA = Path("data/processed/injury/injury_states.csv")
FPL_BASE = Path("data/processed/merged/fpl_base_enriched.csv")
OUTPUT_PATH = Path("data/processed/injury/fpl_with_injury.csv")


def analyse_status_churn(injury_df: pd.DataFrame) -> None:
    """
    Compare injury status at GW N vs GW N-1 for the same player.
    Quantifies how often status changes between consecutive gameweeks,
    which is the upper bound on temporal leakage from the naive merge.
    """

    print("\n" + "-" * 60)
    print("STATUS CHURN ANALYSIS (GW N vs GW N-1)")
    print("-" * 60)

    df = injury_df[["season", "GW", "element", "status"]].copy()
    df = df.sort_values(["season", "element", "GW"])

    # Previous GW status for the same player within the same season
    df["prev_status"] = df.groupby(["season", "element"])["status"].shift(1)

    # Only rows where we have both current and previous
    paired = df.dropna(subset=["prev_status"])
    changed = paired[paired["status"] != paired["prev_status"]]

    total_pairs = len(paired)
    total_changed = len(changed)
    churn_rate = total_changed / total_pairs * 100 if total_pairs > 0 else 0

    print(f"\n  Consecutive GW pairs analysed: {total_pairs:,}")
    print(f"  Status changes between GWs:    {total_changed:,}")
    print(f"  Churn rate:                     {churn_rate:.2f}%")

    if total_changed > 0:
        # Transition matrix
        print("\n  Transition counts (prev → current):")
        transitions = changed.groupby(["prev_status", "status"]).size().reset_index(name="count")
        transitions = transitions.sort_values("count", ascending=False)
        for _, row in transitions.head(10).iterrows():
            print(f"    {row['prev_status']} → {row['status']}: {row['count']:,}")

        # Leakage-relevant transitions: available → non-available
        # These are cases where a player was fine before the GW but the
        # post-match snapshot shows them as injured/doubtful
        leaked = changed[
            (changed["prev_status"] == "a") & (changed["status"] != "a")
        ]
        print(f"\nLeakage-relevant (a → non-a): {len(leaked):,} "
              f"({len(leaked)/total_pairs*100:.2f}% of all pairs)")
        print(f"These are players who appeared available before the GW but")
        print(f"whose post-match snapshot shows a status change.")

    print()


def run():
    print("=" * 60)
    print("MERGE INJURY DATA WITH FPL BASE")
    print("=" * 60)

    print("\nLoading data...")
    injury_df = pd.read_csv(INJURY_DATA)
    fpl_df = pd.read_csv(FPL_BASE, low_memory=False)

    print(f"Injury data: {len(injury_df):,} rows")
    print(f"FPL base: {len(fpl_df):,} rows")

    injury_df["season"] = injury_df["season"].astype(str)
    injury_df["GW"] = pd.to_numeric(injury_df["GW"], errors="coerce")
    injury_df["element"] = pd.to_numeric(injury_df["element"], errors="coerce")

    fpl_df["season"] = fpl_df["season"].astype(str)
    fpl_df["GW"] = pd.to_numeric(fpl_df["GW"], errors="coerce")
    fpl_df["element"] = pd.to_numeric(fpl_df["element"], errors="coerce")

    # Run churn analysis BEFORE shifting to quantify leakage
    analyse_status_churn(injury_df)

    # Select injury columns to merge (avoid duplicating name/team)
    injury_cols = [
        "season", "GW", "element",
        "status", "chance_of_playing_this_round", "chance_of_playing_next_round",
        "news", "news_added",
    ]
    injury_subset = injury_df[injury_cols].drop_duplicates(
        subset=["season", "GW", "element"]
    )

    # use GW N-1 injury snapshot for GW N predictions
    print("Applying temporal shift: injury GW N → prediction GW N+1...")
    pre_shift = len(injury_subset)
    injury_subset["GW"] = injury_subset["GW"] + 1
    print(f"  Shifted {pre_shift:,} rows (+1 GW)")

    print(f"\nInjury data for merge: {len(injury_subset):,} unique (season, GW, element)")

    #check overlap
    fpl_keys = set(zip(fpl_df["season"], fpl_df["GW"], fpl_df["element"]))
    injury_keys = set(zip(injury_subset["season"], injury_subset["GW"], injury_subset["element"]))
    overlap = fpl_keys & injury_keys

    print(f"\nKey overlap (after shift):")
    print(f"FPL keys: {len(fpl_keys):,}")
    print(f"Injury keys: {len(injury_keys):,}")
    print(f"Overlap: {len(overlap):,} ({len(overlap)/len(fpl_keys)*100:.1f}% of FPL)")

    # Filter to overlapping seasons
    injury_seasons = injury_subset["season"].unique()
    fpl_in_scope = fpl_df[fpl_df["season"].isin(injury_seasons)]
    print(f"\nFPL rows in injury seasons ({injury_seasons}): {len(fpl_in_scope):,}")

    #merge
    print("\nMerging...")
    merged = fpl_df.merge(
        injury_subset,
        on=["season", "GW", "element"],
        how="left"
    )

    print(f"Result: {len(merged):,} rows, {len(merged.columns)} columns")

    # Fill missing injury data (GW1 of each season + seasons without injury data)
    # Default: available status
    merged["status"] = merged["status"].fillna("a")
    merged["chance_of_playing_this_round"] = merged["chance_of_playing_this_round"].fillna(100.0)
    merged["chance_of_playing_next_round"] = merged["chance_of_playing_next_round"].fillna(100.0)

    # Summary of merged data
    print("\nMerged data summary:")
    print(f"Seasons: {sorted(merged['season'].unique())}")
    print(f"Players with injury status != 'a': {(merged['status'] != 'a').sum():,}")
    print(f"Players with news: {merged['news'].notna().sum():,}")

    # GW1 coverage check
    for season in sorted(merged["season"].unique()):
        gw1 = merged[(merged["season"] == season) & (merged["GW"] == 1)]
        gw1_with_injury = gw1[gw1["news"].notna()]
        print(f"  {season} GW1: {len(gw1)} players, {len(gw1_with_injury)} with injury data "
              f"(expected ~0 due to shift)")

    # Status distribution in merged
    print("\nStatus distribution in merged data:")
    print(merged["status"].value_counts().to_string())

    # Save
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    merged.to_csv(OUTPUT_PATH, index=False)

    print(f"\n" + "=" * 60)
    print("MERGE COMPLETE")
    print("=" * 60)
    print(f"Output: {OUTPUT_PATH}")
    print(f"Shape: {merged.shape}")

    # New columns added
    new_cols = ["status", "chance_of_playing_this_round", "chance_of_playing_next_round", "news", "news_added"]
    print(f"New columns: {new_cols}")


if __name__ == "__main__":
    run()
