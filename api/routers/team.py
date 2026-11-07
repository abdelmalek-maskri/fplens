"""A manager's own squad. The only endpoint that genuinely needs a server at
request time: there are millions of possible FPL IDs, so nothing can be
precomputed until someone types theirs in."""

import logging

from fastapi import APIRouter, HTTPException, Path, Request, Response

from api.ratelimit import RateLimited, client_key
from api.schemas import Team
from api.snapshot import load_predictions
from job.fetch_live_data import FPLAPIError, fetch_user_team, get_bootstrap_data
from job.solvers import suggest_transfers

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Team"])

# bootstrap-static is ~1.8MB and identical for everyone. Only the gameweek list
# is read from it here, and that changes once a week, so an hour of staleness
# costs nothing. /news already caches it under this key.
BOOTSTRAP_CACHE_TTL = 60

# Fields to enrich from predictions onto each pick
_ENRICH_FIELDS = {
    "web_name": "",
    "position": "",
    "team_name": "",
    "predicted_points": 0,
    "form": 0,
    "status": "a",
    "chance_of_playing": 100,
    "opponent_name": "",
    "value": 0,
}


@router.get("/team/{fpl_id}", response_model=Team)
def get_team(
    request: Request,
    response: Response,
    fpl_id: int = Path(..., ge=1, le=15_000_000),
):
    """Fetch user's FPL team picks and merge with predictions."""
    # One manager's squad. Says so out loud, so no proxy between here and the
    # browser can hand this response to a different visitor.
    response.headers["Cache-Control"] = "private, no-store"
    cache = request.app.state.cache
    guard = request.app.state.upstream_guard
    caller = client_key(request)

    try:
        # Shared across every manager, so it is fetched once per TTL rather
        # than once per squad. One shared key with a TTL cannot be driven by a
        # caller, so it is not billed to anyone.
        bootstrap = cache.get_or_fetch("bootstrap", get_bootstrap_data, ttl_minutes=BOOTSTRAP_CACHE_TTL)

        def fetch():
            # Billed inside the fetch, not at the top of the handler, so the
            # budget tracks what the FPL API actually sees. A cached squad never
            # reaches here, which keeps a manager refreshing their own team off
            # the limit.
            guard.charge(caller)
            return fetch_user_team(fpl_id, bootstrap)

        team_data = cache.get_or_fetch(f"team_{fpl_id}", fetch)
    except RateLimited as e:
        raise HTTPException(
            status_code=429,
            detail="Too many FPL lookups right now. Try again in a moment.",
            headers={"Retry-After": str(e.retry_after)},
        ) from None
    # Before FPLAPIError carried the status, every upstream failure arrived as a
    # RuntimeError and was answered 502, including a 404. Order matters here:
    # FPLAPIError is a RuntimeError, so it has to be caught first.
    except FPLAPIError as e:
        if e.status_code == 404:
            raise HTTPException(status_code=404, detail="FPL ID not found") from None
        logger.warning("FPL API returned %s for %s", e.status_code, e.url)
        raise HTTPException(status_code=502, detail="Failed to fetch team data") from None
    except Exception:
        logger.warning("Could not fetch squad for %s", fpl_id, exc_info=True)
        raise HTTPException(status_code=502, detail="Failed to fetch team data") from None

    # merge picks with predictions for player names + predicted points
    predictions_df = None
    try:
        predictions_df = load_predictions()
    except Exception:
        logger.warning("Predictions unavailable for team enrichment", exc_info=True)

    if predictions_df is not None:
        pick_elements = {p["element"] for p in team_data["picks"]}
        lookup = predictions_df[predictions_df["element"].isin(pick_elements)]
        lookup = lookup.fillna(_ENRICH_FIELDS).set_index("element")

        enriched = []
        for p in team_data["picks"]:
            pick = dict(p)
            if p["element"] in lookup.index:
                row = lookup.loc[p["element"]]
                pick["web_name"] = row.get("web_name", "")
                pick["player_position"] = row.get("position", "")
                for field, default in _ENRICH_FIELDS.items():
                    if field not in ("web_name", "position"):
                        pick[field] = row.get(field, default)
            enriched.append(pick)

        team_data["picks"] = enriched
        team_data["transfer_suggestions"] = suggest_transfers(
            user_picks=enriched,
            all_predictions=predictions_df,
            bank=team_data.get("bank", 0),
        )

    return team_data
