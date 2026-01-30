# ml/pipelines/news/__init__.py
"""
News Pipeline Module

This module handles the collection, processing, and alignment of football news
articles for the multi-stream FPL prediction system.

Pipeline Flow:
    1. scrape_rss.py      - Fetch current articles from RSS feeds (last 30 days)
    2. scrape_guardian.py - Fetch historical articles from Guardian API
    3. extract_article.py - Parse HTML to extract clean article text
    4. align_players.py   - Map articles to FPL player IDs

Usage:
    # Scrape current RSS articles
    python -m ml.pipelines.news.scrape_rss

    # Scrape historical articles from Guardian API
    python -m ml.pipelines.news.scrape_guardian --season 2023-24
    python -m ml.pipelines.news.scrape_guardian --season 2024-25

    # Align articles to players
    python -m ml.pipelines.news.align_players
"""
