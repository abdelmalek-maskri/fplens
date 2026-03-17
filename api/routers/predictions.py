"""Prediction endpoints: all players, best XI, best squad, multi-GW."""

import pandas as pd
from fastapi import APIRouter, HTTPException, Query, Request

from api.solvers import solve_best_squad, solve_best_xi
from ml.pipelines.inference.multi_gw import predict_multi_gw
from ml.pipelines.inference.predict import run as run_predictions

router = APIRouter(tags=["Predictions"])


def _get_inference_result(request: Request, model_id: str | None = None) -> dict:
    """Run inference, cached per model with 15 min TTL."""
    cache = request.app.state.cache
    models = getattr(request.app.state, "models", {})

    if model_id and model_id not in models:
        raise HTTPException(status_code=400, detail=f"Unknown model: {model_id}. Available: {list(models.keys())}")

    model = models.get(model_id, request.app.state.model) if model_id else request.app.state.model
    cache_key = f"predictions_{model_id or 'default'}"

    return cache.get_or_fetch(cache_key, lambda: run_predictions(model=model, save_output=False))


def _get_predictions(request: Request, model_id: str | None = None) -> pd.DataFrame:
    return _get_inference_result(request, model_id)["predictions"]


@router.get("/predictions")
def get_predictions(
    request: Request,
    model: str = Query(default=None, description="Model ID (config_d, stacked_ensemble, etc.)"),
):
    """All player predictions for the current GW."""
    return _get_predictions(request, model).to_dict(orient="records")


@router.get("/models")
def get_models(request: Request):
    """List available models for the frontend selector."""
    return getattr(request.app.state, "model_info", [])


@router.get("/best-xi")
def get_best_xi(request: Request):
    """Global best starting 11 from all available players."""
    return solve_best_xi(_get_predictions(request))


@router.get("/best-squad")
def get_best_squad(
    request: Request,
    budget: float = Query(default=100.0, ge=50.0, le=120.0),
):
    """ILP-optimised 15-man squad within budget constraints."""
    return solve_best_squad(_get_predictions(request), budget=budget)


@router.get("/predictions/multi-gw")
def get_multi_gw(
    request: Request,
    horizon: int = Query(default=3, ge=1, le=3),
):
    """All players with multi-GW predictions (GW+1/2/3, each backed by a trained model)."""
    cache = request.app.state.cache
    horizon_models = getattr(request.app.state, "horizon_models", {})

    def fetch():
        from ml.pipelines.inference.fetch_live_data import fetch_fixtures

        inference = _get_inference_result(request)
        gw1_preds = inference["predictions"]
        feature_matrix = inference["feature_matrix"]

        # feature_matrix is in original API order; gw1_preds is sorted by predicted_points.
        # Join by element ID to avoid row mismatch.
        element_ids = inference.get("element_ids", [])
        live_df = feature_matrix.reset_index(drop=True).copy()
        if "element" not in live_df.columns and element_ids:
            live_df["element"] = element_ids
        if "team_name" not in live_df.columns and "element" in live_df.columns:
            team_map = dict(zip(gw1_preds["element"], gw1_preds["team_name"]))
            live_df["team_name"] = live_df["element"].map(team_map)

        fixtures_data = fetch_fixtures(num_gws=horizon)
        return predict_multi_gw(gw1_preds, live_df, horizon_models, fixtures_data, horizon)

    return cache.get_or_fetch(f"multi_gw_{horizon}", fetch)
