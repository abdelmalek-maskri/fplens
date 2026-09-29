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

from fastapi import APIRouter, Request, Response

logger = logging.getLogger(__name__)

router = APIRouter(tags=["News"])

NEWS_CACHE_TTL = 60

# The same articles for every visitor, so the browser may hold them too, for as
# long as the server would have served the same bytes anyway. A shorter window
# would spend a round trip to be handed an identical response, and on a sleeping
# free-tier instance that round trip is tens of seconds rather than milliseconds.
#
# The two windows are not in phase, so a request arriving just before the server
# refetches is held until roughly two hours after the articles were fetched.
# Fine for a football feed, and well inside the Guardian's 24-hour limit.
BROWSER_CACHE_SECONDS = NEWS_CACHE_TTL * 60


@router.get("/news")
def get_news(request: Request, response: Response):
    """Recent Guardian articles with sentiment and player links."""
    response.headers["Cache-Control"] = f"public, max-age={BROWSER_CACHE_SECONDS}"
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
