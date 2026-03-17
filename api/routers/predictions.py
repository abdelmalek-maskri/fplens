"""Prediction endpoints: all players, best XI, best squad, multi-GW."""

import pandas as pd
from fastapi import APIRouter, Query, Request

from api.solvers import solve_best_squad, solve_best_xi
from ml.pipelines.inference.multi_gw import predict_multi_gw
from ml.pipelines.inference.predict import run as run_predictions

router = APIRouter(tags=["Predictions"])


def _get_inference_result(request: Request, model_id: str | None = None) -> dict:
    """Shared helper: run inference (cached per model, 15 min TTL)."""
    cache = request.app.state.cache
    models = getattr(request.app.state, "models", {})
    if model_id and model_id not in models:
        from fastapi import HTTPException

        raise HTTPException(status_code=400, detail=f"Unknown model: {model_id}. Available: {list(models.keys())}")
    model = models.get(model_id, request.app.state.model) if model_id else request.app.state.model
    cache_key = f"predictions_{model_id or 'default'}"

    def fetch():
        return run_predictions(model=model, save_output=False)

    return cache.get_or_fetch(cache_key, fetch)


def _get_predictions(request: Request, model_id: str | None = None) -> pd.DataFrame:
    return _get_inference_result(request, model_id)["predictions"]


@router.get("/predictions")
def get_predictions(
    request: Request,
    model: str = Query(default=None, description="Model ID (config_d, stacked_ensemble, etc.)"),
):
    predictions_df = _get_predictions(request, model)
    result = predictions_df.to_dict(orient="records")
    return result


@router.get("/models")
def get_models(request: Request):
    """List available models for the frontend selector."""
    return getattr(request.app.state, "model_info", [])


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
    horizon: int = Query(default=3, ge=1, le=3),
):
    # All players with multi-GW predictions (GW+1/2/3, each backed by a trained model)
    cache = request.app.state.cache
    horizon_models = getattr(request.app.state, "horizon_models", {})

    def fetch():
        from ml.pipelines.inference.fetch_live_data import fetch_fixtures

        inference_result = _get_inference_result(request)
        gw1_preds = inference_result["predictions"]
        feature_matrix = inference_result["feature_matrix"]

        # Rebuild live_df: feature_matrix already has model features (including
        # position, team etc). Only add columns not already present.
        live_df = feature_matrix.reset_index(drop=True).copy()
        for col in ["element", "team_name"]:
            if col not in live_df.columns and col in gw1_preds.columns:
                live_df[col] = gw1_preds[col].reset_index(drop=True)

        fixtures_data = fetch_fixtures(num_gws=horizon)
        return predict_multi_gw(gw1_preds, live_df, horizon_models, fixtures_data, horizon)

    return cache.get_or_fetch(f"multi_gw_{horizon}", fetch)
