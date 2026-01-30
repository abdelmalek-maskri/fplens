# ml/pipelines/news/__init__.py
"""
News Pipeline Module

This module handles the collection, processing, and alignment of football news
articles for the multi-stream FPL prediction system.

Pipeline Flow:
    1. scrape_rss.py      - Fetch current articles from RSS feeds
    2. scrape_wayback.py  - Fetch historical articles from Internet Archive
    3. extract_article.py - Parse HTML to extract clean article text
    4. align_players.py   - Map articles to FPL player IDs

Usage:
    # Scrape current RSS articles
    python -m ml.pipelines.news.scrape_rss

    # Scrape historical articles from Wayback
    python -m ml.pipelines.news.scrape_wayback --season 2023-24

    # Align articles to players
    python -m ml.pipelines.news.align_players
"""
