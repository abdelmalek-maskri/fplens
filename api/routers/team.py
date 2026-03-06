"""User team endpoints, FPL ID squad, player detail, transfer suggestions."""

from fastapi import APIRouter, Request, HTTPException
from ml.pipelines.inference.fetch_live_data import fetch_user_team

router = APIRouter(tags=["Team"])


@router.get("/team/{fpl_id}")
def get_team(fpl_id: int, request: Request):
    # Fetch user's FPL team picks and merge with predictions
    cache = request.app.state.cache

    def fetch():
        return fetch_user_team(fpl_id)

    try:
        team_data = cache.get_or_fetch(f"team_{fpl_id}", fetch)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=f"FPL API error: {e}")
    except Exception as e:
        if "404" in str(e) or "Not Found" in str(e):
            raise HTTPException(status_code=404, detail=f"FPL ID {fpl_id} not found")
        raise HTTPException(status_code=502, detail=str(e))

    # merge picks with predictions so frontend gets player names + predicted points
    predictions_df = None
    try:
        from ml.pipelines.inference.predict import run as run_predictions
        model = request.app.state.model
        predictions_df = cache.get_or_fetch(
            "predictions",
            lambda: run_predictions(model=model, save_output=False),
        )
    except Exception:
        pass  # predictions unavailable, return picks without enrichment

    if predictions_df is not None:
        pick_elements = {p["element"] for p in team_data["picks"]}
        player_lookup = predictions_df[predictions_df["element"].isin(pick_elements)]
        player_lookup = player_lookup.set_index("element")

        enriched_picks = []
        for p in team_data["picks"]:
            pick = dict(p)
            if p["element"] in player_lookup.index:
                row = player_lookup.loc[p["element"]]
                pick["web_name"] = row.get("web_name", "")
                pick["player_position"] = row.get("position", "")
                pick["team_name"] = row.get("team_name", "")
                pick["predicted_points"] = row.get("predicted_points", 0)
                pick["form"] = row.get("form", 0)
                pick["status"] = row.get("status", "a")
                pick["chance_of_playing"] = row.get("chance_of_playing", 100)
                pick["opponent_name"] = row.get("opponent_name", "")
                pick["value"] = row.get("value", 0)
                pick["uncertainty"] = row.get("uncertainty", 0)
                pick["predicted_range_low"] = row.get("predicted_range_low", 0)
                pick["predicted_range_high"] = row.get("predicted_range_high", 0)
            enriched_picks.append(pick)

        team_data["picks"] = enriched_picks

    return team_data


@router.get("/player/{element_id}")
def get_player(element_id: int, request: Request):
    # Full player profile with history, fixtures, SHAP values, and predictions for next GW
    # FF-5 + FF-11: Will call fetch_player_histories() + compute_player_shap()
    return {"message": "Not yet implemented", "element_id": element_id}
