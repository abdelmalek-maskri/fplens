"""User team endpoints: FPL ID squad, player detail, transfer suggestions."""

import logging

from fastapi import APIRouter, HTTPException, Request

from api.solvers import suggest_transfers
from ml.pipelines.inference.fetch_live_data import fetch_user_team

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


@router.get("/team/{fpl_id}")
def get_team(fpl_id: int, request: Request):
    """Fetch user's FPL team picks and merge with predictions."""
    cache = request.app.state.cache

    try:
        team_data = cache.get_or_fetch(f"team_{fpl_id}", lambda: fetch_user_team(fpl_id))
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=f"FPL API error: {e}") from None
    except Exception as e:
        if "404" in str(e) or "Not Found" in str(e):
            raise HTTPException(status_code=404, detail=f"FPL ID {fpl_id} not found") from None
        raise HTTPException(status_code=502, detail=str(e)) from None

    # merge picks with predictions for player names + predicted points
    predictions_df = None
    try:
        from ml.pipelines.inference.predict import run as run_predictions

        model = request.app.state.model
        result = cache.get_or_fetch(
            "predictions",
            lambda: run_predictions(model=model, save_output=False),
        )
        predictions_df = result["predictions"]
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


@router.get("/player/{element_id}")
def get_player(element_id: int, request: Request):
    """Full player profile: predictions, GW history, fixtures, SHAP breakdown."""
    cache = request.app.state.cache
    return cache.get_or_fetch(f"player_{element_id}", lambda: _build_player_detail(element_id, request))


def _build_player_detail(element_id: int, request: Request) -> dict:
    """Merge prediction, history, fixtures, and SHAP for a single player."""
    from ml.pipelines.inference.fetch_live_data import (
        fetch_fixtures,
        fetch_player_history,
        get_player_fdr,
    )
    from ml.pipelines.inference.predict import run as run_predictions

    try:
        from ml.pipelines.inference.predict import compute_player_shap
    except ImportError:
        compute_player_shap = None

    model = request.app.state.model
    cache = request.app.state.cache
    inference = cache.get_or_fetch(
        "predictions",
        lambda: run_predictions(model=model, save_output=False),
    )
    predictions_df = inference["predictions"]
    feature_matrix = inference["feature_matrix"]
    element_ids = inference["element_ids"]

    player_row = predictions_df[predictions_df["element"] == element_id]
    if player_row.empty:
        raise HTTPException(status_code=404, detail=f"Player {element_id} not found")
    player = player_row.iloc[0].to_dict()

    # numpy types -> native Python for JSON serialization
    for k, v in player.items():
        if hasattr(v, "item"):
            player[k] = v.item()

    # GW history (last 10)
    raw_history = fetch_player_history(element_id)
    if raw_history:
        last10 = raw_history[-10:]
        player["pts_history"] = [gw.get("total_points", 0) for gw in last10]
        player["pts_last5"] = player["pts_history"][-5:]
        player["gw_labels"] = [f"GW{gw.get('round', 0)}" for gw in last10]
        player["minutes_history"] = [gw.get("minutes", 0) for gw in last10]
        player["xg_history"] = [float(gw.get("expected_goals", 0)) for gw in last10]
        player["xa_history"] = [float(gw.get("expected_assists", 0)) for gw in last10]
        player["bonus_history"] = [gw.get("bonus", 0) for gw in last10]
    else:
        player["pts_history"] = []
        player["pts_last5"] = []
        player["gw_labels"] = []
        player["minutes_history"] = []
        player["xg_history"] = []
        player["xa_history"] = []
        player["bonus_history"] = []

    # upcoming fixtures with FDR
    team_name = player.get("team_name", "")
    try:
        fixtures_data = cache.get_or_fetch("fixtures_6", lambda: fetch_fixtures(num_gws=6))
        player["fixtures"] = get_player_fdr(fixtures_data["fixtures"], team_name)
    except Exception:
        logger.warning("Failed to fetch fixtures for player %d", element_id, exc_info=True)
        player["fixtures"] = []

    # per-player SHAP (top 5 features)
    try:
        if compute_player_shap is not None and element_id in element_ids:
            idx = element_ids.index(element_id)
            player_X = feature_matrix.iloc[[idx]]
            shap_result = compute_player_shap(model, player_X, [element_id], top_n=5)
            player["shap"] = shap_result.get(element_id, [])
        else:
            player["shap"] = []
    except Exception:
        logger.warning("SHAP computation failed for player %d", element_id, exc_info=True)
        player["shap"] = []

    return player
