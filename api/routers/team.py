"""A manager's own squad. The only endpoint that genuinely needs a server at
request time: there are millions of possible FPL IDs, so nothing can be
precomputed until someone types theirs in."""

import logging

from fastapi import APIRouter, HTTPException, Path, Request

from api.schemas import Team
from api.snapshot import load_predictions
from api.solvers import suggest_transfers
from job.fetch_live_data import fetch_user_team

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Team"])

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
    "uncertainty": 0,
    "predicted_range_low": 0,
    "predicted_range_high": 0,
}


@router.get("/team/{fpl_id}", response_model=Team)
def get_team(
    request: Request,
    fpl_id: int = Path(..., ge=1, le=15_000_000),
):
    """Fetch user's FPL team picks and merge with predictions."""
    cache = request.app.state.cache

    try:
        team_data = cache.get_or_fetch(f"team_{fpl_id}", lambda: fetch_user_team(fpl_id))
    except RuntimeError:
        raise HTTPException(status_code=502, detail="Failed to fetch team data") from None
    except Exception as e:
        if "404" in str(e) or "Not Found" in str(e):
            raise HTTPException(status_code=404, detail="FPL ID not found") from None
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
