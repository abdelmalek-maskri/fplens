# ml/pipelines/news/scrape_wayback.py
"""
Wayback Machine Scraper for Historical Football News

This script fetches archived articles from the Internet Archive's Wayback Machine.
Use this to get historical news from seasons that are no longer in RSS feeds.

How Wayback Machine Works:
    1. The Internet Archive periodically crawls and saves web pages
    2. Each saved version is called a "snapshot" or "capture"
    3. The CDX API lets you search for captures by URL pattern and date range
    4. You can then fetch the archived HTML content

CDX API Response Format:
    Each line contains: urlkey, timestamp, original_url, mimetype, statuscode, digest, length
    Example: "com,theguardian)/football/2024/jan/... 20240115123456 https://... text/html 200 ABC123 12345"

Usage:
    # Fetch 2023-24 season articles
    python -m ml.pipelines.news.scrape_wayback --season 2023-24

    # Fetch with limit (for testing)
    python -m ml.pipelines.news.scrape_wayback --season 2023-24 --limit 100
"""

import argparse
import json
import time
from datetime import datetime
from pathlib import Path
from urllib.parse import quote

import requests

from ml.pipelines.news.config import (
    WAYBACK_CDX_API,
    WAYBACK_URL_PATTERNS,
    WAYBACK_DELAY_SECONDS,
    SEASON_DATE_RANGES,
    RAW_NEWS_DIR,
)


def query_cdx_api(
    url_pattern: str,
    from_date: str,
    to_date: str,
    limit: int | None = None,
) -> list[dict]:
    """
    Query the Wayback Machine CDX API for archived URLs.

    The CDX API is like a search index for the Wayback Machine.
    It tells you what URLs were archived and when, without downloading the content.

    Args:
        url_pattern: URL pattern to search (can include wildcards like *)
        from_date: Start date in YYYYMMDD format
        to_date: End date in YYYYMMDD format
        limit: Maximum number of results (None for all)

    Returns:
        List of dictionaries with archived URL info
    """
    params = {
        "url": url_pattern,
        "matchType": "prefix",  # Match URLs starting with pattern
        "from": from_date,
        "to": to_date,
        "output": "json",  # Get JSON instead of plain text
        "filter": "statuscode:200",  # Only successful captures
        "filter": "mimetype:text/html",  # Only HTML pages (not images, etc.)
        "collapse": "urlkey",  # Deduplicate by URL (keep one snapshot per URL)
    }

    if limit:
        params["limit"] = limit

    print(f"  Querying CDX API for: {url_pattern}")
    print(f"  Date range: {from_date} to {to_date}")

    response = requests.get(WAYBACK_CDX_API, params=params, timeout=60)
    response.raise_for_status()

    # Parse JSON response
    # First row is headers: ["urlkey", "timestamp", "original", "mimetype", "statuscode", "digest", "length"]
    # Subsequent rows are data
    data = response.json()

    if not data or len(data) < 2:
        print("  No results found")
        return []

    headers = data[0]
    results = []

    for row in data[1:]:
        record = dict(zip(headers, row))
        results.append({
            "original_url": record.get("original", ""),
            "timestamp": record.get("timestamp", ""),
            "wayback_url": f"https://web.archive.org/web/{record.get('timestamp')}/{record.get('original', '')}",
        })

    print(f"  Found {len(results)} archived URLs")
    return results


def fetch_archived_page(wayback_url: str) -> str | None:
    """
    Fetch the HTML content of an archived page.

    Args:
        wayback_url: Full Wayback Machine URL (https://web.archive.org/web/...)

    Returns:
        HTML content as string, or None if fetch failed
    """
    try:
        response = requests.get(wayback_url, timeout=30)
        response.raise_for_status()
        return response.text
    except Exception as e:
        print(f"  Error fetching {wayback_url}: {e}")
        return None


def scrape_season(season: str, limit: int | None = None) -> list[dict]:
    """
    Scrape all archived articles for a given season.

    Args:
        season: Season string like "2023-24"
        limit: Max articles per source (for testing)

    Returns:
        List of article dictionaries
    """
    if season not in SEASON_DATE_RANGES:
        raise ValueError(f"Unknown season: {season}. Available: {list(SEASON_DATE_RANGES.keys())}")

    from_date, to_date = SEASON_DATE_RANGES[season]
    all_articles = []

    for source_name, url_pattern in WAYBACK_URL_PATTERNS.items():
        print(f"\n{'='*40}")
        print(f"Source: {source_name}")
        print(f"{'='*40}")

        # Query CDX API for archived URLs
        archived_urls = query_cdx_api(url_pattern, from_date, to_date, limit)

        # Fetch each archived page
        for i, url_info in enumerate(archived_urls):
            print(f"  [{i+1}/{len(archived_urls)}] Fetching: {url_info['original_url'][:60]}...")

            # Rate limiting: Be polite to the Internet Archive
            time.sleep(WAYBACK_DELAY_SECONDS)

            html_content = fetch_archived_page(url_info["wayback_url"])

            if html_content:
                article = {
                    "original_url": url_info["original_url"],
                    "wayback_url": url_info["wayback_url"],
                    "timestamp": url_info["timestamp"],
                    "source": source_name,
                    "season": season,
                    "html_content": html_content,  # We'll extract text later
                    "fetched_at": datetime.now().isoformat(),
                }
                all_articles.append(article)

    return all_articles


def run():
    """Main function with CLI argument parsing."""
    parser = argparse.ArgumentParser(description="Scrape historical news from Wayback Machine")
    parser.add_argument("--season", type=str, required=True, help="Season to scrape (e.g., 2023-24)")
    parser.add_argument("--limit", type=int, default=None, help="Max articles per source (for testing)")
    args = parser.parse_args()

    print("=" * 60)
    print("WAYBACK MACHINE SCRAPER")
    print("=" * 60)
    print(f"Season: {args.season}")
    print(f"Limit: {args.limit or 'None (all articles)'}")

    articles = scrape_season(args.season, args.limit)

    # Save to JSON
    RAW_NEWS_DIR.mkdir(parents=True, exist_ok=True)
    output_path = RAW_NEWS_DIR / f"wayback_articles_{args.season}.json"

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(articles, f, indent=2, ensure_ascii=False)

    print(f"\n{'=' * 60}")
    print(f"DONE: Saved {len(articles)} articles to {output_path}")
    print(f"{'=' * 60}")


if __name__ == "__main__":
    run()
