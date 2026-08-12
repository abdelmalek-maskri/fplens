"""Shared access to cached live FPL data and per-model inference results.

Every router reads predictions through here. The live fetch costs roughly one
FPL API call per player, so it is cached once under a single key with a single
TTL — routers must not fetch it themselves or the cache ends up with two
writers disagreeing on freshness.
"""

import pandas as pd
from fastapi import HTTPException, Request

from ml.pipelines.inference.predict import get_model_features, predict, prepare_features

DEFAULT_MODEL_ID = "config_d"

# Live data changes at most once per gameweek; predictions are cheap to derive
# from it, so both share the same long TTL.
LIVE_DATA_TTL_MINUTES = 240

PLAYER_INFO_COLS = [
    "element",
    "web_name",
    "name",
    "team_name",
    "position",
    "value",
    "status",
    "form",
    "total_points",
    "chance_this_round",
    "news",
    "opponent_name",
    "selected_by_percent",
    "goals_scored",
    "expected_goals",
    "assists",
    "expected_assists",
    "transfers_in_event",
    "transfers_out_event",
    "ict_index",
    "minutes",
    "bonus",
    "bps",
    "clean_sheets",
    "goals_conceded",
]


def resolve_model(request: Request, model_id: str | None = None):
    """Resolve a model ID to (id, loaded model), defaulting to config_d."""
    models = getattr(request.app.state, "models", {})

    if not model_id or model_id == "default":
        model_id = DEFAULT_MODEL_ID

    if model_id not in models:
        raise HTTPException(status_code=400, detail=f"Unknown model: {model_id}. Available: {list(models.keys())}")

    return model_id, models[model_id]


def get_live_data(request: Request) -> dict:
    """Fetch live player data once and cache it. Shared across all models."""
    cache = request.app.state.cache

    def fetch():
        from ml.pipelines.inference.fetch_live_data import fetch_current_gw_data

        live_df = fetch_current_gw_data(include_history=True, include_understat=True)
        keep = [c for c in PLAYER_INFO_COLS if c in live_df.columns]

        return {
            "live_df": live_df,
            "player_info": live_df[keep].copy(),
            "element_ids": list(live_df["element"]) if "element" in live_df.columns else [],
        }

    return cache.get_or_fetch("live_data", fetch, ttl_minutes=LIVE_DATA_TTL_MINUTES)


def get_inference_result(request: Request, model_id: str | None = None) -> dict:
    """Run model prediction on cached live data. Only the model.predict() call
    is repeated per model; the expensive data fetch is shared."""
    cache = request.app.state.cache
    model_id, model = resolve_model(request, model_id)

    def run_on_cached_data():
        live = get_live_data(request)
        X = prepare_features(live["live_df"], get_model_features(model))
        return {
            "predictions": predict(model, X, live["player_info"]),
            "feature_matrix": X,
            "element_ids": live["element_ids"],
        }

    return cache.get_or_fetch(f"predictions_{model_id}", run_on_cached_data, ttl_minutes=LIVE_DATA_TTL_MINUTES)


def get_predictions_df(request: Request, model_id: str | None = None) -> pd.DataFrame:
    return get_inference_result(request, model_id)["predictions"]
