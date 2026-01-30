# ml/pipelines/news/extract_article.py
"""
Article Content Extraction

This script extracts clean article text from HTML content.
Different news sources have different HTML structures, so we need
source-specific parsing logic.

Why Extract Text?
    - Raw HTML contains navigation, ads, related articles, etc.
    - We only want the main article content for embeddings
    - Clean text produces better NLP features

Libraries Used:
    - BeautifulSoup: HTML parsing and navigation
    - (Optional) newspaper3k: Automatic article extraction

Usage:
    python -m ml.pipelines.news.extract_article
"""

import json
import re
from pathlib import Path

# BeautifulSoup: Library for parsing HTML/XML
# Install: pip install beautifulsoup4 lxml
from bs4 import BeautifulSoup

from ml.pipelines.news.config import (
    RAW_NEWS_DIR,
    PROCESSED_NEWS_DIR,
    MIN_ARTICLE_LENGTH,
)


def clean_text(text: str) -> str:
    """
    Clean extracted text by removing extra whitespace.

    Args:
        text: Raw extracted text

    Returns:
        Cleaned text with normalized whitespace
    """
    # Replace multiple whitespace/newlines with single space
    text = re.sub(r"\s+", " ", text)
    # Strip leading/trailing whitespace
    text = text.strip()
    return text


def extract_guardian_article(html: str) -> dict | None:
    """
    Extract article content from Guardian HTML.

    Guardian articles typically have:
    - <h1> or <h2> for headline
    - <article> containing the main content
    - <p> tags with class containing "body" for paragraphs

    Args:
        html: Raw HTML content

    Returns:
        Dictionary with title, body, and first_paragraph, or None if extraction failed
    """
    soup = BeautifulSoup(html, "lxml")

    # Find headline
    title = None
    headline_tag = soup.find("h1")
    if headline_tag:
        title = clean_text(headline_tag.get_text())

    # Find article body
    # Guardian uses various classes; try multiple selectors
    article_body = None
    body_selectors = [
        ("div", {"class": re.compile(r"article-body")}),
        ("div", {"class": re.compile(r"content__article-body")}),
        ("article", {}),
    ]

    for tag, attrs in body_selectors:
        body_elem = soup.find(tag, attrs)
        if body_elem:
            # Get all paragraph text
            paragraphs = body_elem.find_all("p")
            if paragraphs:
                article_body = " ".join(clean_text(p.get_text()) for p in paragraphs)
                break

    if not article_body or len(article_body) < MIN_ARTICLE_LENGTH:
        return None

    # Extract first paragraph separately (useful for relevance scoring)
    first_para = ""
    if article_body:
        # Split by sentence boundaries and take first few sentences
        sentences = article_body.split(". ")[:3]
        first_para = ". ".join(sentences)

    return {
        "title": title or "",
        "body": article_body,
        "first_paragraph": first_para,
    }


def extract_bbc_article(html: str) -> dict | None:
    """
    Extract article content from BBC Sport HTML.

    BBC Sport articles typically have:
    - <h1> with id="main-heading" for headline
    - <article> with data-component="text-block" for paragraphs

    Args:
        html: Raw HTML content

    Returns:
        Dictionary with title, body, and first_paragraph, or None if extraction failed
    """
    soup = BeautifulSoup(html, "lxml")

    # Find headline
    title = None
    headline_tag = soup.find("h1", id="main-heading")
    if not headline_tag:
        headline_tag = soup.find("h1")
    if headline_tag:
        title = clean_text(headline_tag.get_text())

    # Find article body
    # BBC uses data attributes; fallback to article tag
    article_body = None

    # Try BBC-specific selectors
    article_elem = soup.find("article")
    if article_elem:
        paragraphs = article_elem.find_all("p")
        if paragraphs:
            article_body = " ".join(clean_text(p.get_text()) for p in paragraphs)

    if not article_body or len(article_body) < MIN_ARTICLE_LENGTH:
        return None

    # Extract first paragraph
    first_para = ""
    if article_body:
        sentences = article_body.split(". ")[:3]
        first_para = ". ".join(sentences)

    return {
        "title": title or "",
        "body": article_body,
        "first_paragraph": first_para,
    }


def extract_article(html: str, source: str) -> dict | None:
    """
    Extract article content based on source.

    This is a dispatcher function that calls the appropriate
    source-specific extraction function.

    Args:
        html: Raw HTML content
        source: Source identifier (e.g., "guardian_pl", "bbc_football")

    Returns:
        Extracted article dict or None
    """
    if "guardian" in source.lower():
        return extract_guardian_article(html)
    elif "bbc" in source.lower():
        return extract_bbc_article(html)
    else:
        # Generic fallback: try both extractors
        result = extract_guardian_article(html)
        if not result:
            result = extract_bbc_article(html)
        return result


def process_wayback_articles(season: str) -> list[dict]:
    """
    Process all Wayback articles for a season, extracting text.

    Args:
        season: Season string like "2023-24"

    Returns:
        List of processed articles with extracted text
    """
    input_path = RAW_NEWS_DIR / f"wayback_articles_{season}.json"

    if not input_path.exists():
        print(f"No wayback articles found for {season} at {input_path}")
        return []

    with open(input_path, "r", encoding="utf-8") as f:
        articles = json.load(f)

    print(f"Processing {len(articles)} articles from {input_path}...")

    processed = []
    for i, article in enumerate(articles):
        if (i + 1) % 50 == 0:
            print(f"  Processed {i + 1}/{len(articles)}...")

        html = article.get("html_content", "")
        source = article.get("source", "")

        extracted = extract_article(html, source)

        if extracted:
            # Keep original metadata, add extracted content
            processed_article = {
                "article_id": f"{season}_{i}",
                "original_url": article.get("original_url", ""),
                "wayback_url": article.get("wayback_url", ""),
                "source": source,
                "season": season,
                "timestamp": article.get("timestamp", ""),
                "title": extracted["title"],
                "body": extracted["body"],
                "first_paragraph": extracted["first_paragraph"],
            }
            processed.append(processed_article)

    print(f"Successfully extracted {len(processed)}/{len(articles)} articles")
    return processed


def run():
    """Main function: Process all raw articles."""
    print("=" * 60)
    print("ARTICLE CONTENT EXTRACTION")
    print("=" * 60)

    # Process each season's wayback articles
    all_processed = []

    for season in ["2023-24", "2024-25"]:
        print(f"\nProcessing {season}...")
        processed = process_wayback_articles(season)
        all_processed.extend(processed)

    # Also process RSS articles (they have summary, not full HTML)
    rss_path = RAW_NEWS_DIR / "rss_articles.json"
    if rss_path.exists():
        print("\nProcessing RSS articles...")
        with open(rss_path, "r", encoding="utf-8") as f:
            rss_articles = json.load(f)

        for i, article in enumerate(rss_articles):
            # RSS articles have summary, not full body
            # We'll use summary as-is (it's already clean text)
            processed_article = {
                "article_id": f"rss_{i}",
                "original_url": article.get("link", ""),
                "source": article.get("feed_name", ""),
                "season": "2024-25",  # RSS is current season
                "timestamp": article.get("published", ""),
                "title": article.get("title", ""),
                "body": article.get("summary", ""),
                "first_paragraph": article.get("summary", "")[:500],
            }
            if len(processed_article["body"]) >= MIN_ARTICLE_LENGTH:
                all_processed.append(processed_article)

        print(f"  Added {len(rss_articles)} RSS articles")

    # Save processed articles
    PROCESSED_NEWS_DIR.mkdir(parents=True, exist_ok=True)
    output_path = PROCESSED_NEWS_DIR / "extracted_articles.json"

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(all_processed, f, indent=2, ensure_ascii=False)

    print(f"\n{'=' * 60}")
    print(f"DONE: Saved {len(all_processed)} extracted articles to {output_path}")
    print(f"{'=' * 60}")


if __name__ == "__main__":
    run()
