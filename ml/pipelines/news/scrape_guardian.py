# ml/pipelines/news/scrape_guardian.py
"""
Guardian Open Platform API Scraper

This script fetches football articles from the Guardian using their official API.
This is MUCH better than Wayback Machine because:
- Designed for programmatic access
- Clean structured data
- Historical articles available
- Can filter by date, section, tags

API Documentation: https://open-platform.theguardian.com/documentation/

To get a free API key:
1. Go to https://bonobo.capi.gutools.co.uk/register/developer
2. Register for a developer key (free)
3. Set the GUARDIAN_API_KEY environment variable or update config

Usage:
    # Fetch 2023-24 season articles
    python -m ml.pipelines.news.scrape_guardian --season 2023-24

    # Fetch with limit (for testing)
    python -m ml.pipelines.news.scrape_guardian --season 2023-24 --limit 100
"""

import argparse
import json
import os
import time
from datetime import datetime
from pathlib import Path

import requests

from ml.pipelines.news.config import (
    SEASON_DATE_RANGES,
    RAW_NEWS_DIR,
)

# Guardian API configuration
GUARDIAN_API_URL = "https://content.guardianapis.com/search"

# Get API key from environment or use test key (limited)
GUARDIAN_API_KEY = os.environ.get("GUARDIAN_API_KEY", "test")

# Rate limiting
REQUESTS_PER_SECOND = 1
DELAY_BETWEEN_REQUESTS = 1.0 / REQUESTS_PER_SECOND


def fetch_guardian_articles(
    from_date: str,
    to_date: str,
    page: int = 1,
    page_size: int = 50,
) -> dict:
    """
    Fetch articles from Guardian API.

    Args:
        from_date: Start date in YYYY-MM-DD format
        to_date: End date in YYYY-MM-DD format
        page: Page number (1-indexed)
        page_size: Results per page (max 200)

    Returns:
        API response as dictionary
    """
    params = {
        "api-key": GUARDIAN_API_KEY,
        "section": "football",
        "q": "premier league",  # Search term
        "from-date": from_date,
        "to-date": to_date,
        "page": page,
        "page-size": page_size,
        "show-fields": "headline,trailText,body,byline",  # Get article content
        "order-by": "newest",
    }

    response = requests.get(GUARDIAN_API_URL, params=params, timeout=30)
    response.raise_for_status()
    return response.json()


def scrape_season(season: str, limit: int | None = None) -> list[dict]:
    """
    Scrape all Premier League articles for a given season.

    Args:
        season: Season string like "2023-24"
        limit: Maximum total articles (None for all)

    Returns:
        List of article dictionaries
    """
    if season not in SEASON_DATE_RANGES:
        raise ValueError(f"Unknown season: {season}. Available: {list(SEASON_DATE_RANGES.keys())}")

    # Convert YYYYMMDD to YYYY-MM-DD for Guardian API
    from_yyyymmdd, to_yyyymmdd = SEASON_DATE_RANGES[season]
    from_date = f"{from_yyyymmdd[:4]}-{from_yyyymmdd[4:6]}-{from_yyyymmdd[6:]}"
    to_date = f"{to_yyyymmdd[:4]}-{to_yyyymmdd[4:6]}-{to_yyyymmdd[6:]}"

    print(f"  Fetching articles from {from_date} to {to_date}...")

    all_articles = []
    page = 1
    page_size = 50 if not limit or limit > 50 else limit

    while True:
        print(f"  Page {page}...", end=" ", flush=True)

        try:
            result = fetch_guardian_articles(from_date, to_date, page, page_size)
            response = result.get("response", {})

            articles = response.get("results", [])
            total_pages = response.get("pages", 1)
            total_results = response.get("total", 0)

            if page == 1:
                print(f"(Total available: {total_results} articles in {total_pages} pages)")
            else:
                print(f"({len(articles)} articles)")

            # Process each article
            for article in articles:
                fields = article.get("fields", {})
                processed = {
                    "article_id": article.get("id", ""),
                    "title": fields.get("headline", article.get("webTitle", "")),
                    "summary": fields.get("trailText", ""),
                    "body": fields.get("body", ""),  # HTML content
                    "byline": fields.get("byline", ""),
                    "published": article.get("webPublicationDate", ""),
                    "url": article.get("webUrl", ""),
                    "section": article.get("sectionName", ""),
                    "type": article.get("type", ""),
                    "source": "guardian",
                    "season": season,
                    "fetched_at": datetime.now().isoformat(),
                }
                all_articles.append(processed)

            # Check if we should stop
            if limit and len(all_articles) >= limit:
                all_articles = all_articles[:limit]
                break

            if page >= total_pages:
                break

            page += 1
            time.sleep(DELAY_BETWEEN_REQUESTS)

        except Exception as e:
            print(f"Error on page {page}: {e}")
            break

    return all_articles


def run():
    """Main function with CLI argument parsing."""
    parser = argparse.ArgumentParser(description="Scrape football news from Guardian API")
    parser.add_argument("--season", type=str, required=True, help="Season to scrape (e.g., 2023-24)")
    parser.add_argument("--limit", type=int, default=None, help="Max articles (for testing)")
    args = parser.parse_args()

    print("=" * 60)
    print("GUARDIAN API SCRAPER")
    print("=" * 60)
    print(f"Season: {args.season}")
    print(f"Limit: {args.limit or 'None (all articles)'}")
    print(f"API Key: {'custom' if GUARDIAN_API_KEY != 'test' else 'test (limited)'}")
    print()

    articles = scrape_season(args.season, args.limit)

    # Save to JSON
    RAW_NEWS_DIR.mkdir(parents=True, exist_ok=True)
    output_path = RAW_NEWS_DIR / f"guardian_articles_{args.season}.json"

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(articles, f, indent=2, ensure_ascii=False)

    print(f"\n{'=' * 60}")
    print(f"DONE: Saved {len(articles)} articles to {output_path}")
    print(f"{'=' * 60}")


if __name__ == "__main__":
    run()
