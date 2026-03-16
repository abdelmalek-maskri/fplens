"""Prediction endpoints: all players, best XI, best squad, multi-GW."""

import pandas as pd
from fastapi import APIRouter, Query, Request

from api.solvers import solve_best_squad, solve_best_xi
from ml.pipelines.inference.multi_gw import predict_multi_gw
from ml.pipelines.inference.predict import run as run_predictions

router = APIRouter(tags=["Predictions"])


def _get_inference_result(request: Request) -> dict:
    """Shared helper: run inference (cached for 15 min).
    Returns {"predictions": DataFrame, "feature_matrix": DataFrame, "element_ids": list}.
    """
    cache = request.app.state.cache
    model = request.app.state.model

    def fetch():
        return run_predictions(model=model, save_output=False)

    return cache.get_or_fetch("predictions", fetch)


def _get_predictions(request: Request) -> pd.DataFrame:
    return _get_inference_result(request)["predictions"]


@router.get("/predictions")
def get_predictions(request: Request):
    # All players with predicted points, uncertainty, and stats
    predictions_df = _get_predictions(request)
    return predictions_df.to_dict(orient="records")


@router.get("/best-xi")
def get_best_xi(request: Request):
    # Global best starting 11 from all available players
    predictions_df = _get_predictions(request)
    return solve_best_xi(predictions_df)


@router.get("/best-squad")
def get_best_squad(
    request: Request,
    budget: float = Query(default=100.0, ge=50.0, le=120.0),
):
    # ILP-optimised 15-man squad within budget constraints
    predictions_df = _get_predictions(request)
    return solve_best_squad(predictions_df, budget=budget)


@router.get("/predictions/multi-gw")
def get_multi_gw(
    request: Request,
    horizon: int = Query(default=6, ge=1, le=8),
):
    # All players with multi-GW predictions across trained horizons + FDR-adjusted projections
    cache = request.app.state.cache
    horizon_models = getattr(request.app.state, "horizon_models", {})

    def fetch():
        from ml.pipelines.inference.fetch_live_data import fetch_fixtures

        inference_result = _get_inference_result(request)
        gw1_preds = inference_result["predictions"]
        feature_matrix = inference_result["feature_matrix"]

        # Rebuild full live_df from feature_matrix + player info columns
        # feature_matrix has the model features; we need the raw live data for GW+2/3 models
        live_df = pd.concat(
            [
                gw1_preds[["element", "team_name", "position"]].reset_index(drop=True),
                feature_matrix.reset_index(drop=True),
            ],
            axis=1,
        )

        fixtures_data = fetch_fixtures(num_gws=horizon)
        return predict_multi_gw(gw1_preds, live_df, horizon_models, fixtures_data, horizon)

    return cache.get_or_fetch(f"multi_gw_{horizon}", fetch)
