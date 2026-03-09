"""Model insights and news endpoints, static training metrics + Guardian articles."""

import json
import logging
from pathlib import Path

from fastapi import APIRouter, Query, Request

router = APIRouter(tags=["Insights"])
logger = logging.getLogger(__name__)

OUTPUTS = Path("outputs")


@router.get("/model-insights")
def get_model_insights():

    # Training metrics, ablation results, SHAP global importance
    ablation_path = OUTPUTS / "experiments/ablation_injury/ablation_summary.json"
    ablation = json.loads(ablation_path.read_text()) if ablation_path.exists() else {}

    shap_path = OUTPUTS / "analysis/shap/stacked_ensemble_global_importance.csv"
    shap_features = []
    if shap_path.exists():
        import csv

        with open(shap_path) as f:
            shap_features = list(csv.DictReader(f))

    variants = []
    for config in ["A", "B", "C", "D"]:
        summary_path = OUTPUTS / f"experiments/ablation_injury/config_{config}/summary.json"
        if summary_path.exists():
            variants.append(json.loads(summary_path.read_text()))

    return {
        "ablation": ablation,
        "shap_features": shap_features,
        "model_variants": variants,
    }


NEWS_CACHE_TTL = 60  # minutes


@router.get("/news")
def get_news(request: Request, days: int = Query(default=7, ge=1, le=30)):
    # Recent Guardian articles with sentiment and player links.
    # Uses separate 60-min cache since news doesn't change fast.
    cache = request.app.state.cache

    def _fetch_news():
        from ml.pipelines.inference.fetch_live_data import get_bootstrap_data
        from ml.pipelines.inference.news import fetch_recent_news

        try:
            bootstrap = cache.get_or_fetch("bootstrap", get_bootstrap_data)
            return fetch_recent_news(bootstrap, days=days)
        except Exception as e:
            logger.error("News fetch failed: %s", e)
            return {"articles": [], "trending": []}

    return cache.get_or_fetch(f"news_{days}", _fetch_news, ttl_minutes=NEWS_CACHE_TTL)
