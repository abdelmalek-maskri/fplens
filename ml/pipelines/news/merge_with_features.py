"""
Merge news features with extended feature sets for ablation configs C and D.

Outputs:
    data/features/extended_with_news.csv              (Config C: baseline + news)
    data/features/extended_with_injury_and_news.csv   (Config D: baseline + injury + news)

Usage:
    python -m ml.pipelines.news.merge_with_features
"""

from pathlib import Path

import numpy as np
import pandas as pd

from ml.pipelines.news.build_news_features import NEWS_FEATURE_COLS, NEWS_SEASONS

EXTENDED_PATH = Path("data/features/extended_features.csv")
INJURY_PATH = Path("data/features/extended_with_injury.csv")
NEWS_PATH = Path("data/features/news_features.csv")

OUTPUT_C = Path("data/features/extended_with_news.csv")
OUTPUT_D = Path("data/features/extended_with_injury_and_news.csv")

MERGE_KEYS = ["season", "GW", "element"]


def merge_news(base_df: pd.DataFrame, news_df: pd.DataFrame) -> pd.DataFrame:
    """Left-join news features onto a base feature set.

    Seasons without Guardian data get NaN (LightGBM handles natively).
    Seasons with Guardian data but no mentions get 0.
    """
    for col_df in [base_df, news_df]:
        col_df["season"] = col_df["season"].astype(str)
        col_df["GW"] = pd.to_numeric(col_df["GW"], errors="coerce")
        col_df["element"] = pd.to_numeric(col_df["element"], errors="coerce")

    # Drop stale news columns from previous runs
    overlap = set(base_df.columns) & set(NEWS_FEATURE_COLS)
    if overlap:
        base_df = base_df.drop(columns=overlap)

    news_subset = news_df[MERGE_KEYS + NEWS_FEATURE_COLS].drop_duplicates(
        subset=MERGE_KEYS,
    )

    combined = base_df.merge(news_subset, on=MERGE_KEYS, how="left")

    # Seasons with Guardian coverage: fill missing with 0 (no mention = no signal)
    # Seasons without coverage: leave as NaN
    has_news = combined["season"].isin(NEWS_SEASONS).values
    for col in NEWS_FEATURE_COLS:
        if col in combined.columns:
            combined[col] = combined[col].astype(float)
            mask = has_news & combined[col].isna().values
            combined.loc[mask, col] = 0
            combined.loc[~has_news, col] = np.nan

    n_real = has_news.sum()
    n_nan = (~has_news).sum()
    print(f"  Seasons with news data: {n_real:,} rows")
    print(f"  Pre-news seasons (NaN): {n_nan:,} rows")

    return combined


def run() -> None:
    """Merge news features with extended feature sets."""
    print("=" * 60)
    print("MERGE NEWS FEATURES")
    print("=" * 60)

    if not NEWS_PATH.exists():
        print(f"ERROR: {NEWS_PATH} not found — run build_news_features first")
        return

    print("\nLoading news features...")
    news_df = pd.read_csv(NEWS_PATH, low_memory=False)
    print(f"  {len(news_df):,} rows, {len(NEWS_FEATURE_COLS)} features")

    # Config C: baseline + news
    if EXTENDED_PATH.exists():
        print(f"\nBuilding Config C (baseline + news)...")
        base_df = pd.read_csv(EXTENDED_PATH, low_memory=False)
        print(f"  Base: {base_df.shape}")
        combined_c = merge_news(base_df, news_df)
        combined_c.to_csv(OUTPUT_C, index=False)
        print(f"  Saved: {OUTPUT_C} ({combined_c.shape})")
    else:
        print(f"\nWARNING: {EXTENDED_PATH} not found, skipping Config C")

    # Config D: baseline + injury + news
    if INJURY_PATH.exists():
        print(f"\nBuilding Config D (baseline + injury + news)...")
        injury_df = pd.read_csv(INJURY_PATH, low_memory=False)
        print(f"  Base: {injury_df.shape}")
        combined_d = merge_news(injury_df, news_df)
        combined_d.to_csv(OUTPUT_D, index=False)
        print(f"  Saved: {OUTPUT_D} ({combined_d.shape})")
    else:
        print(f"\nWARNING: {INJURY_PATH} not found, skipping Config D")

    print(f"\n{'=' * 60}")
    print("MERGE COMPLETE")
    print(f"{'=' * 60}")


if __name__ == "__main__":
    run()
