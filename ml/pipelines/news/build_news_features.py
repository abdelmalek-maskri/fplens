"""
Build per-GW news features from article-player links.

Aligns articles to gameweeks using fixture kickoff times to prevent
temporal leakage: for GW N, only articles published AFTER GW N-1
kickoff and BEFORE GW N kickoff are used.

7 targeted features per (season, GW, element):
    news_mentioned          - was this player mentioned?          (binary)
    news_mention_count      - number of articles mentioning them  (int)
    news_title_mentions     - articles with player in title       (int)
    news_avg_relevance      - mean relevance score                (float)
    news_sentiment_pos      - mean positive sentiment             (float)
    news_sentiment_neg      - mean negative sentiment             (float)
    news_injury_context     - mentioned with injury keywords?     (binary)

Output: data/features/news_features.csv

Usage:
    python -m ml.pipelines.news.build_news_features
"""

from pathlib import Path

import pandas as pd

LINKS_PATH = Path("data/processed/news/article_player_links.csv")
MAPPINGS_DIR = Path("data/processed/mappings")
FPL_DATA_PATH = Path("data/features/extended_features.csv")
OUTPUT_PATH = Path("data/features/news_features.csv")

NEWS_SEASONS = [
    "2018-19",
    "2019-20",
    "2020-21",
    "2021-22",
    "2022-23",
    "2023-24",
    "2024-25",
]

NEWS_FEATURE_COLS = [
    "news_mentioned",
    "news_mention_count",
    "news_title_mentions",
    "news_avg_relevance",
    "news_sentiment_pos",
    "news_sentiment_neg",
    "news_injury_context",
]


def compute_gw_boundaries(season: str) -> pd.DataFrame:
    """Compute GW start times from fixture data.

    Returns DataFrame with columns: GW, gw_start, gw_end
    where gw_start = first kickoff of GW, gw_end = first kickoff of next GW.
    """
    fixtures_path = MAPPINGS_DIR / f"fpl_fixtures_{season}.csv"
    gw_map_path = MAPPINGS_DIR / f"fixture_to_gw_{season}.csv"

    if not fixtures_path.exists() or not gw_map_path.exists():
        return pd.DataFrame()

    fixtures = pd.read_csv(fixtures_path)
    gw_map = pd.read_csv(gw_map_path)

    merged = fixtures.merge(gw_map, on="fixture")
    merged["kickoff_time"] = pd.to_datetime(merged["kickoff_time"], utc=True)

    gw_starts = merged.groupby("GW")["kickoff_time"].min().sort_index()

    rows = []
    gws = sorted(gw_starts.index)
    for i, gw in enumerate(gws):
        gw_start = (
            gw_starts[gws[i - 1]]
            if i > 0
            else pd.Timestamp(
                f"{season[:4]}-07-01",
                tz="UTC",
            )
        )
        gw_end = gw_starts[gw]
        rows.append({"GW": gw, "gw_start": gw_start, "gw_end": gw_end})

    return pd.DataFrame(rows)


def aggregate_links_to_gw(
    links: pd.DataFrame,
    gw_bounds: pd.DataFrame,
    season: str,
) -> pd.DataFrame:
    """Aggregate article-player links to per-(element, GW) features.

    For GW N, uses articles published in [GW N-1 start, GW N start).
    """
    season_links = links[links["season"] == season].copy()
    if season_links.empty or gw_bounds.empty:
        return pd.DataFrame()

    season_links["published_date"] = pd.to_datetime(
        season_links["published_date"],
        utc=True,
    )

    rows = []
    for _, gw_row in gw_bounds.iterrows():
        gw = int(gw_row["GW"])
        mask = (season_links["published_date"] >= gw_row["gw_start"]) & (
            season_links["published_date"] < gw_row["gw_end"]
        )
        window = season_links[mask]

        if window.empty:
            continue

        for element, group in window.groupby("element"):
            rows.append(
                {
                    "season": season,
                    "GW": gw,
                    "element": int(element),
                    "news_mentioned": 1,
                    "news_mention_count": len(group),
                    "news_title_mentions": int(group["in_title"].sum()),
                    "news_avg_relevance": round(group["relevance_score"].mean(), 4),
                    "news_sentiment_pos": round(group["sentiment_pos"].mean(), 4),
                    "news_sentiment_neg": round(group["sentiment_neg"].mean(), 4),
                    "news_injury_context": int(group["has_injury_context"].any()),
                }
            )

    return pd.DataFrame(rows)


def run() -> None:
    """Build per-GW news features from article-player links."""
    print("=" * 60)
    print("BUILD NEWS FEATURES")
    print("=" * 60)

    if not LINKS_PATH.exists():
        print(f"ERROR: {LINKS_PATH} not found — run link_articles_to_players first")
        return

    print("\nLoading article-player links...")
    links = pd.read_csv(LINKS_PATH)
    print(f"  {len(links):,} links loaded")
    print(f"  Seasons: {sorted(links['season'].unique())}")

    # Build per-GW features for each season
    all_features = []

    for season in NEWS_SEASONS:
        season_links = links[links["season"] == season]
        if season_links.empty:
            print(f"\n  {season}: no links, skipping")
            continue

        gw_bounds = compute_gw_boundaries(season)
        if gw_bounds.empty:
            print(f"\n  {season}: no fixture data, skipping")
            continue

        features = aggregate_links_to_gw(links, gw_bounds, season)
        all_features.append(features)

        n_gws = features["GW"].nunique() if not features.empty else 0
        n_players = features["element"].nunique() if not features.empty else 0
        print(f"  {season}: {len(features):,} rows ({n_players} players across {n_gws} GWs)")

    if not all_features:
        print("\nNo features generated. Check links and fixture data.")
        return

    features_df = pd.concat(all_features, ignore_index=True)

    # Fill to complete grid: every (season, GW, element) gets a row
    # Players not mentioned get 0 for all features
    print("\nExpanding to full player-GW grid...")
    fpl = pd.read_csv(
        FPL_DATA_PATH,
        usecols=["season", "GW", "element"],
        low_memory=False,
    )
    fpl = fpl[fpl["season"].isin(NEWS_SEASONS)]
    grid = fpl[["season", "GW", "element"]].drop_duplicates()

    full = grid.merge(features_df, on=["season", "GW", "element"], how="left")
    full["news_mentioned"] = full["news_mentioned"].fillna(0).astype(int)
    for col in NEWS_FEATURE_COLS:
        if col != "news_mentioned":
            full[col] = full[col].fillna(0)

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    full.to_csv(OUTPUT_PATH, index=False)

    mentioned = full[full["news_mentioned"] == 1]
    print(f"\n{'=' * 60}")
    print("BUILD COMPLETE")
    print(f"{'=' * 60}")
    print(f"Output: {OUTPUT_PATH}")
    print(f"Shape:  {full.shape}")
    print(f"Player-GW rows with mentions: {len(mentioned):,} / {len(full):,} ({len(mentioned) / len(full) * 100:.1f}%)")
    print(f"Mean articles per mentioned player-GW: {mentioned['news_mention_count'].mean():.2f}")
    print(f"Players with injury context: {mentioned['news_injury_context'].sum():,}")


if __name__ == "__main__":
    run()
