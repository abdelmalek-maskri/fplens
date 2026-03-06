"""Fixture endpoints, team x GW grid with FDR ratings"""

from fastapi import APIRouter, Request, Query
from ml.pipelines.inference.fetch_live_data import fetch_fixtures

router = APIRouter(tags=["Fixtures"])


@router.get("/fixtures")
def get_fixtures(
    request: Request,
    num_gws: int = Query(default=6, ge=1, le=10),
):
    # 20-team x N-GW fixture grid with attack/defence FDR
    cache = request.app.state.cache
    def fetch():
        return fetch_fixtures(num_gws=num_gws)
    return cache.get_or_fetch(f"fixtures_{num_gws}", fetch)
