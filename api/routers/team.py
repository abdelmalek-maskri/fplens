"""User team endpoints, FPL ID squad, player detail, transfer suggestions."""

from fastapi import APIRouter, Request, HTTPException

router = APIRouter(tags=["Team"])


@router.get("/team/{fpl_id}")
def get_team(fpl_id: int, request: Request):
    # Fetch user's FPL team and merge with predictions + transfer suggestions
    # FF-6 + FF-10: Will call fetch_user_team() + suggest_transfers()
    return {"message": "Not yet implemented", "fpl_id": fpl_id}


@router.get("/player/{element_id}")
def get_player(element_id: int, request: Request):
    # Full player profile with history, fixtures, SHAP values, and predictions for next GW
    # FF-5 + FF-11: Will call fetch_player_histories() + compute_player_shap()
    return {"message": "Not yet implemented", "element_id": element_id}
