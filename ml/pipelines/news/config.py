# ml/pipelines/news/config.py
"""
Configuration for news data collection.

This file centralizes all constants, URLs, and paths used by the news pipeline.
Keeping config separate from logic makes the code easier to maintain and modify.
"""

from pathlib import Path

# =============================================================================
# PATHS
# =============================================================================

# Raw data (scraped articles before processing)
RAW_NEWS_DIR = Path("data/raw/news")

# Processed data (aligned to players)
PROCESSED_NEWS_DIR = Path("data/processed/news")

# =============================================================================
# RSS FEED URLS
# =============================================================================
# RSS feeds provide structured XML with recent articles (typically last 30 days)
# Format: title, link, published date, summary

RSS_FEEDS = {
    "guardian_pl": "https://www.theguardian.com/football/premierleague/rss",
    "guardian_football": "https://www.theguardian.com/football/rss",
    "bbc_football": "https://feeds.bbci.co.uk/sport/football/rss.xml",
}

# =============================================================================
# WAYBACK MACHINE CONFIG
# =============================================================================
# The Internet Archive's Wayback Machine stores historical snapshots of web pages.
# CDX API: https://github.com/internetarchive/wayback/tree/master/wayback-cdx-server

WAYBACK_CDX_API = "http://web.archive.org/cdx/search/cdx"

# URL patterns to search in Wayback Machine
# These are the base URLs whose archived versions we want to find
WAYBACK_URL_PATTERNS = {
    "guardian_pl": "theguardian.com/football/premierleague/*",
    "guardian_transfers": "theguardian.com/football/transfer-window/*",
    "bbc_pl": "bbc.co.uk/sport/football/premier-league/*",
}

# Rate limiting: Be polite to the Internet Archive servers
WAYBACK_DELAY_SECONDS = 1.0  # Delay between requests

# =============================================================================
# SEASON DATE RANGES
# =============================================================================
# Premier League season typically runs August to May
# Format: (start_date, end_date) as YYYYMMDD strings for Wayback API

SEASON_DATE_RANGES = {
    "2023-24": ("20230801", "20240531"),
    "2024-25": ("20240801", "20250531"),
}

# =============================================================================
# ARTICLE EXTRACTION CONFIG
# =============================================================================

# Minimum article length (characters) to consider valid
MIN_ARTICLE_LENGTH = 200

# Maximum articles to fetch per source (for testing, set to None for all)
MAX_ARTICLES_PER_SOURCE = None  # Set to e.g. 100 for testing

# =============================================================================
# PLAYER ALIGNMENT CONFIG
# =============================================================================

# Minimum relevance score to keep an article-player association
MIN_RELEVANCE_SCORE = 1.0

# Weights for relevance scoring
RELEVANCE_WEIGHTS = {
    "title_mention": 3.0,      # Player mentioned in title
    "first_para_mention": 2.0,  # Player mentioned in first paragraph
    "body_mention": 1.0,        # Player mentioned anywhere in body
}
