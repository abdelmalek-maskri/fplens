# ml/pipelines/news/extract_article.py
"""
Article Content Extraction

This script processes raw articles from various sources (Guardian API, RSS)
and extracts clean text for NLP processing.

The Guardian API already provides article body as HTML, so we:
1. Parse HTML to extract clean text (remove tags, scripts, etc.)
2. Extract first paragraph for relevance scoring

For RSS articles:
- We only have summaries, which are already fairly clean
- But they may contain HTML tags that need stripping

Usage:
    python -m ml.pipelines.news.extract_article
"""

import json
import re
from pathlib import Path

from bs4 import BeautifulSoup

from ml.pipelines.news.config import (
    RAW_NEWS_DIR,
    PROCESSED_NEWS_DIR,
    MIN_ARTICLE_LENGTH,
)


def clean_text(text: str) -> str:
    """
    Clean text by removing extra whitespace and normalizing.

    Args:
        text: Raw text (may contain extra spaces, newlines)

    Returns:
        Cleaned text with normalized whitespace
    """
    if not text:
        return ""
    # Replace multiple whitespace/newlines with single space
    text = re.sub(r"\s+", " ", text)
    # Strip leading/trailing whitespace
    text = text.strip()
    return text


def html_to_text(html: str) -> str:
    """
    Convert HTML to plain text using BeautifulSoup.

    Removes:
    - Script and style tags
    - HTML tags (keeping text content)
    - Extra whitespace

    Args:
        html: HTML string

    Returns:
        Plain text string
    """
    if not html:
        return ""

    soup = BeautifulSoup(html, "lxml")

    # Remove script and style elements
    for script in soup(["script", "style", "aside", "nav", "footer"]):
        script.decompose()

    # Get text content
    text = soup.get_text(separator=" ")

    return clean_text(text)


def extract_first_paragraph(text: str, num_sentences: int = 3) -> str:
    """
    Extract the first few sentences as the 'first paragraph'.

    This is useful for relevance scoring - mentions in the first
    paragraph are more likely to be about the player.

    Args:
        text: Full article text
        num_sentences: Number of sentences to include

    Returns:
        First few sentences joined
    """
    if not text:
        return ""

    # Split by sentence boundaries (period followed by space or end)
    sentences = re.split(r"(?<=[.!?])\s+", text)
    return " ".join(sentences[:num_sentences])


def process_guardian_articles() -> list[dict]:
    """
    Process Guardian API articles from JSON files.

    Guardian API provides:
    - title (headline)
    - summary (trailText)
    - body (HTML content)

    We need to convert body HTML to plain text.

    Returns:
        List of processed articles
    """
    processed = []

    # Find all guardian article files
    guardian_files = list(RAW_NEWS_DIR.glob("guardian_articles_*.json"))

    if not guardian_files:
        print("No Guardian article files found")
        return []

    for filepath in guardian_files:
        season = filepath.stem.replace("guardian_articles_", "")
        print(f"\nProcessing {filepath.name}...")

        with open(filepath, "r", encoding="utf-8") as f:
            articles = json.load(f)

        print(f"  Found {len(articles)} articles")

        for i, article in enumerate(articles):
            if (i + 1) % 100 == 0:
                print(f"  Processed {i + 1}/{len(articles)}...")

            # Extract body text from HTML
            body_html = article.get("body", "")
            body_text = html_to_text(body_html)

            # Use summary if body is too short
            if len(body_text) < MIN_ARTICLE_LENGTH:
                summary = article.get("summary", "")
                body_text = html_to_text(summary) if "<" in summary else summary

            if len(body_text) < MIN_ARTICLE_LENGTH:
                continue  # Skip articles that are too short

            processed_article = {
                "article_id": article.get("article_id", f"guardian_{season}_{i}"),
                "source": "guardian",
                "season": season,
                "title": clean_text(article.get("title", "")),
                "body": body_text,
                "first_paragraph": extract_first_paragraph(body_text),
                "published": article.get("published", ""),
                "url": article.get("url", ""),
            }
            processed.append(processed_article)

        print(f"  Extracted {len([p for p in processed if p['season'] == season])} valid articles")

    return processed


def process_rss_articles() -> list[dict]:
    """
    Process RSS articles from JSON files.

    RSS provides:
    - title
    - summary (may contain HTML)
    - link, published, etc.

    Returns:
        List of processed articles
    """
    rss_path = RAW_NEWS_DIR / "rss_articles.json"

    if not rss_path.exists():
        print("No RSS articles file found")
        return []

    print(f"\nProcessing {rss_path.name}...")

    with open(rss_path, "r", encoding="utf-8") as f:
        articles = json.load(f)

    print(f"  Found {len(articles)} articles")

    processed = []
    for i, article in enumerate(articles):
        # Clean summary (may contain HTML)
        summary = article.get("summary", "")
        body_text = html_to_text(summary) if "<" in summary else clean_text(summary)

        if len(body_text) < 50:  # RSS summaries can be shorter
            continue

        processed_article = {
            "article_id": f"rss_{article.get('feed_name', '')}_{i}",
            "source": article.get("feed_name", "rss"),
            "season": "2024-25",  # RSS is current season
            "title": clean_text(article.get("title", "")),
            "body": body_text,
            "first_paragraph": extract_first_paragraph(body_text),
            "published": article.get("published", ""),
            "url": article.get("link", ""),
        }
        processed.append(processed_article)

    print(f"  Extracted {len(processed)} valid articles")
    return processed


def run():
    """Main function: Process all raw articles."""
    print("=" * 60)
    print("ARTICLE CONTENT EXTRACTION")
    print("=" * 60)

    all_processed = []

    # Process Guardian API articles
    guardian_articles = process_guardian_articles()
    all_processed.extend(guardian_articles)

    # Process RSS articles
    rss_articles = process_rss_articles()
    all_processed.extend(rss_articles)

    if not all_processed:
        print("\nNo articles to process. Run the scrapers first:")
        print("  python -m ml.pipelines.news.scrape_guardian --season 2023-24")
        print("  python -m ml.pipelines.news.scrape_rss")
        return

    # Summary by source and season
    print(f"\n{'=' * 60}")
    print("SUMMARY")
    print(f"{'=' * 60}")
    print(f"Total articles extracted: {len(all_processed)}")

    from collections import Counter
    sources = Counter(a["source"] for a in all_processed)
    seasons = Counter(a["season"] for a in all_processed)

    print(f"\nBy source:")
    for source, count in sources.items():
        print(f"  {source}: {count}")

    print(f"\nBy season:")
    for season, count in sorted(seasons.items()):
        print(f"  {season}: {count}")

    # Save
    PROCESSED_NEWS_DIR.mkdir(parents=True, exist_ok=True)
    output_path = PROCESSED_NEWS_DIR / "extracted_articles.json"

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(all_processed, f, indent=2, ensure_ascii=False)

    print(f"\nSaved to {output_path}")
    print(f"{'=' * 60}")


if __name__ == "__main__":
    run()
