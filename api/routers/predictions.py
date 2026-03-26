"""Prediction endpoints: all players, best XI, best squad, multi-GW."""

import pandas as pd
from fastapi import APIRouter, HTTPException, Query, Request

from api.solvers import solve_best_squad
from ml.pipelines.inference.multi_gw import predict_multi_gw
from ml.pipelines.inference.predict import (
    get_model_features,
    predict,
    prepare_features,
)

router = APIRouter(tags=["Predictions"])


def _get_live_data(request: Request) -> dict:
    """Fetch live player data once and cache it. Shared across all models."""
    cache = request.app.state.cache

    def fetch():
        from ml.pipelines.inference.fetch_live_data import fetch_current_gw_data

        live_df = fetch_current_gw_data(include_history=True, include_understat=True)

        keep_cols = [
            "element", "web_name", "name", "team_name", "position", "value",
            "status", "form", "total_points", "chance_this_round", "news",
            "opponent_name", "selected_by_percent", "goals_scored",
            "expected_goals", "assists", "expected_assists",
            "transfers_in_event", "transfers_out_event", "ict_index",
            "minutes", "bonus", "bps", "clean_sheets",
        ]
        if "goals_conceded" in live_df.columns:
            keep_cols.append("goals_conceded")
        keep_cols = [c for c in keep_cols if c in live_df.columns]

        return {
            "live_df": live_df,
            "player_info": live_df[keep_cols].copy(),
            "element_ids": list(live_df["element"]) if "element" in live_df.columns else [],
        }

    return cache.get_or_fetch("live_data", fetch)


def _get_inference_result(request: Request, model_id: str | None = None) -> dict:
    """Run model prediction on cached live data. Only the model.predict() call
    is repeated per model; the expensive data fetch is shared."""
    cache = request.app.state.cache
    models = getattr(request.app.state, "models", {})

    if model_id and model_id not in models:
        raise HTTPException(status_code=400, detail=f"Unknown model: {model_id}. Available: {list(models.keys())}")

    model = models.get(model_id, request.app.state.model) if model_id else request.app.state.model
    cache_key = f"predictions_{model_id or 'default'}"

    def run_on_cached_data():
        live = _get_live_data(request)
        model_features = get_model_features(model)
        X = prepare_features(live["live_df"], model_features)
        predictions = predict(model, X, live["player_info"])
        return {
            "predictions": predictions,
            "feature_matrix": X,
            "element_ids": live["element_ids"],
        }

    return cache.get_or_fetch(cache_key, run_on_cached_data)


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
