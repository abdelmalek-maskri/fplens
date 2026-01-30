# ml/pipelines/news/scrape_rss.py
"""
RSS Feed Scraper for Current Football News

This script fetches articles from RSS feeds (Guardian, BBC Sport).
RSS feeds only contain recent articles (typically last 30 days),
so this is used for current season data.

How RSS Works:
    RSS (Really Simple Syndication) is an XML format for content distribution.
    Publishers create RSS feeds that update when new content is added.
    We use the `feedparser` library to parse this XML into Python objects.

Example RSS entry structure:
    <item>
        <title>Salah scores twice as Liverpool beat City</title>
        <link>https://theguardian.com/football/...</link>
        <pubDate>Sat, 25 Jan 2025 15:30:00 GMT</pubDate>
        <description>Mohamed Salah was the hero...</description>
    </item>

Usage:
    python -m ml.pipelines.news.scrape_rss
"""

import json
from datetime import datetime
from pathlib import Path

# feedparser: Library for parsing RSS/Atom feeds
# Install: pip install feedparser
import feedparser

from ml.pipelines.news.config import (
    RSS_FEEDS,
    RAW_NEWS_DIR,
    MAX_ARTICLES_PER_SOURCE,
)


def fetch_rss_feed(feed_url: str) -> list[dict]:
    """
    Fetch and parse an RSS feed.

    Args:
        feed_url: URL of the RSS feed

    Returns:
        List of article dictionaries with keys:
        - title: Article headline
        - link: URL to full article
        - published: Publication datetime (ISO format)
        - summary: Article summary/excerpt
        - source: Which feed this came from
    """
    print(f"  Fetching: {feed_url}")

    # feedparser handles the HTTP request and XML parsing
    feed = feedparser.parse(feed_url)

    articles = []
    for entry in feed.entries:
        # Parse the publication date
        # RSS dates can be in various formats; feedparser normalizes them
        pub_date = None
        if hasattr(entry, "published_parsed") and entry.published_parsed:
            pub_date = datetime(*entry.published_parsed[:6]).isoformat()

        article = {
            "title": entry.get("title", ""),
            "link": entry.get("link", ""),
            "published": pub_date,
            "summary": entry.get("summary", ""),
            "source": feed_url,
            "fetched_at": datetime.now().isoformat(),
        }
        articles.append(article)

    return articles


def run():
    """
    Main function: Fetch all RSS feeds and save to JSON.
    """
    print("=" * 60)
    print("RSS FEED SCRAPER")
    print("=" * 60)

    all_articles = []

    for feed_name, feed_url in RSS_FEEDS.items():
        print(f"\nFetching {feed_name}...")
        try:
            articles = fetch_rss_feed(feed_url)

            # Apply limit if set (for testing)
            if MAX_ARTICLES_PER_SOURCE:
                articles = articles[:MAX_ARTICLES_PER_SOURCE]

            # Tag each article with the feed name
            for article in articles:
                article["feed_name"] = feed_name

            all_articles.extend(articles)
            print(f"  Got {len(articles)} articles")

        except Exception as e:
            print(f"  ERROR: {e}")

    # Save to JSON
    RAW_NEWS_DIR.mkdir(parents=True, exist_ok=True)
    output_path = RAW_NEWS_DIR / "rss_articles.json"

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(all_articles, f, indent=2, ensure_ascii=False)

    print(f"\n{'=' * 60}")
    print(f"DONE: Saved {len(all_articles)} articles to {output_path}")
    print(f"{'=' * 60}")

    return all_articles


if __name__ == "__main__":
    run()
