"""Guardian articles with sentiment.

This cannot be precomputed into the snapshot like everything else. The Guardian
Open Platform's free tier forbids retaining content for more than 24 hours, and
the snapshot is committed to a public repository, so writing headlines there
would retain them permanently through git history.

So it stays a live fetch with a short in-memory cache and nothing on disk. The
model's news features are unaffected: those are derived aggregates (mention
counts, sentiment scores), not article text, and they are built during the job.
"""

import logging

from fastapi import APIRouter, Request

logger = logging.getLogger(__name__)

router = APIRouter(tags=["News"])

# Comfortably inside the 24-hour retention limit, and the feed barely moves
# faster than this anyway.
NEWS_CACHE_TTL = 60


@router.get("/news")
def get_news(request: Request):
    """Recent Guardian articles with sentiment and player links."""
    cache = request.app.state.cache

    def fetch():
        from job.fetch_live_data import get_bootstrap_data
        from job.news import fetch_recent_news

        try:
            bootstrap = cache.get_or_fetch("bootstrap", get_bootstrap_data)
            return fetch_recent_news(bootstrap, days=7)
        except Exception as e:
            logger.error("News fetch failed: %s", e)
            return {"articles": [], "trending": []}

    return cache.get_or_fetch("news", fetch, ttl_minutes=NEWS_CACHE_TTL)
