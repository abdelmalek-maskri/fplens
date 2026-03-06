"""Prediction endpoints: all players, best XI, best squad, multi-GW."""

from fastapi import APIRouter, Request, Query
from ml.pipelines.inference.predict import run as run_predictions

router = APIRouter(tags=["Predictions"])

def _get_predictions(request: Request) -> dict:
    #shared helper: run predictions (cached for 15 min)
    cache = request.app.state.cache
    model = request.app.state.model

    def fetch():
        return run_predictions(model=model, save_output=False)

    return cache.get_or_fetch("predictions", fetch)


@router.get("/predictions")
def get_predictions(request: Request):
    # All players with predicted points, uncertainty, and stats
    predictions_df = _get_predictions(request)
    return predictions_df.to_dict(orient="records")


@router.get("/best-xi")
def get_best_xi(request: Request):
    # """Global best starting 11 from all available players."""
    # FF-7: Will call solve_best_xi() once implemented
    predictions_df = _get_predictions(request)
    return {"message": "Not yet implemented", "total_players": len(predictions_df)}


@router.get("/best-squad")
def get_best_squad(
    request: Request,
    horizon: int = Query(default=1, ge=1, le=8),
    budget: float = Query(default=100.0, ge=50.0, le=120.0),
):
    # ILP-optimised 15-man squad within budget constraints.
    # FF-8: Will call solve_best_squad() once implemented
    return {"message": "Not yet implemented"}


@router.get("/predictions/multi-gw")
def get_multi_gw(
    request: Request,
    horizon: int = Query(default=6, ge=1, le=8),
):
    # All players with multi-GW predictions (FDR-adjusted decay).
    # FF-9: Will call predict_multi_gw() once implemented
    return {"message": "Not yet implemented"}
