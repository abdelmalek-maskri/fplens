import contextlib
import os
import sys
from contextlib import asynccontextmanager
from pathlib import Path

import joblib
from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from api.cache import FPLDataCache
from api.routers import fixtures, insights, predictions, team
from ml.pipelines.inference.multi_gw import load_horizon_models
from ml.pipelines.inference.predict import DEFAULT_MODEL

# Unpickling model objects
# joblib needs these classes importable at load time. Training scripts
# pickle under __main__, but uvicorn --reload remaps to __mp_main__,
# so we patch both. Guarded because training deps (xgboost, catboost)
# may not be installed in the API environment.

_MODEL_CLASSES = []
with contextlib.suppress(ImportError):
    from ml.pipelines.train.train_stacked_ensemble import StackedEnsemble
    _MODEL_CLASSES.append(StackedEnsemble)
with contextlib.suppress(ImportError):
    from ml.pipelines.train.train_twohead_model import TwoHeadModel
    _MODEL_CLASSES.append(TwoHeadModel)
with contextlib.suppress(ImportError):
    from ml.pipelines.train.train_position_specific import PositionSpecificLGBMModel
    _MODEL_CLASSES.append(PositionSpecificLGBMModel)
with contextlib.suppress(ImportError):
    from ml.pipelines.train.train_stacked_with_injury import StackedEnsembleInjury
    _MODEL_CLASSES.append(StackedEnsembleInjury)
with contextlib.suppress(ImportError):
    from ml.pipelines.train.train_catboost_twohead import CatBoostTwoHead
    _MODEL_CLASSES.append(CatBoostTwoHead)

for _mod in ("__main__", "__mp_main__"):
    if _mod in sys.modules:
        for _cls in _MODEL_CLASSES:
            setattr(sys.modules[_mod], _cls.__name__, _cls)

MODEL_PATH = Path(os.environ.get("MODEL_PATH", str(DEFAULT_MODEL)))

# Model registry (all GW+1 variants available via /api/models)

MODEL_REGISTRY = {
    "config_d": (
        "Config D: Stacked + Injury + News (Best)",
        "outputs/experiments/ablation/config_D/model.joblib",
        1.029,
    ),
    "config_b": ("Config B: + Injury features", "outputs/experiments/ablation/config_B/model.joblib", 1.032),
    "config_c": ("Config C: + News features", "outputs/experiments/ablation/config_C/model.joblib", 1.037),
    "config_a": ("Config A: FPL + Understat only", "outputs/experiments/ablation/config_A/model.joblib", 1.039),
    "baseline_tweedie": ("LightGBM Tweedie", "outputs/experiments/baseline_tweedie/model.joblib", 1.021),
    "stacked_ensemble": ("Stacked Ensemble (fpl+Understat)", "outputs/experiments/stacked_ensemble/model.joblib", 1.080),
    "twohead": ("Two-Head (Classifier + Regressor)", "outputs/experiments/twohead/model.joblib", 1.087),
    "baseline": ("Single LightGBM", "outputs/experiments/baseline/model.joblib", 1.091),
    "position_specific": ("Position-Specific (4x LightGBM)", "outputs/experiments/position_specific/model.joblib", 1.095),
    "catboost_twohead": ("CatBoost Two-Head", "outputs/experiments/catboost_twohead/model.joblib", 1.097),
}

REFRESH_SECRET = os.environ.get("REFRESH_SECRET", "dev-secret")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load all models and initialise the FPL data cache on startup."""
    if not MODEL_PATH.exists():
        raise FileNotFoundError(f"Model file not found: {MODEL_PATH}")

    # Load every registered model that exists on disk
    app.state.models = {}
    app.state.model_info = []
    for model_id, (name, path, mae) in MODEL_REGISTRY.items():
        p = Path(path)
        if not p.exists():
            continue
        try:
            print(f"  Loading {name} from {path}...")
            app.state.models[model_id] = joblib.load(p)
            app.state.model_info.append({"id": model_id, "name": name, "mae": mae})
        except Exception as e:
            print(f"  WARNING: Failed to load {name}: {e}")

    # config_d is the best ablation variant (MAE 1.016); fall back to MODEL_PATH
    if "config_d" in app.state.models:
        app.state.model = app.state.models["config_d"]
        print(f"Loaded {len(app.state.models)} models, default: config_d")
    else:
        app.state.model = joblib.load(MODEL_PATH)
        print(f"Loaded {len(app.state.models)} models, default: {MODEL_PATH}")

    print("Loading horizon models (GW+2, GW+3)...")
    app.state.horizon_models = load_horizon_models()
    app.state.cache = FPLDataCache(ttl_minutes=240)

    # Pre-warm: fetch live data once (shared across all models), then predict with default
    print("Pre-warming cache (live data + default model)...")
    try:
        from ml.pipelines.inference.fetch_live_data import fetch_current_gw_data
        from ml.pipelines.inference.predict import get_model_features, predict, prepare_features

        live_df = fetch_current_gw_data(include_history=True, include_understat=True)
        keep_cols = [c for c in [
            "element", "web_name", "name", "team_name", "position", "value",
            "status", "form", "total_points", "chance_this_round", "news",
            "opponent_name", "selected_by_percent", "goals_scored",
            "expected_goals", "assists", "expected_assists",
            "transfers_in_event", "transfers_out_event", "ict_index",
            "minutes", "bonus", "bps", "clean_sheets", "goals_conceded",
        ] if c in live_df.columns]
        player_info = live_df[keep_cols].copy()
        element_ids = list(live_df["element"]) if "element" in live_df.columns else []

        live_cache = {"live_df": live_df, "player_info": player_info, "element_ids": element_ids}
        app.state.cache.get_or_fetch("live_data", lambda: live_cache)

        model_features = get_model_features(app.state.model)
        X = prepare_features(live_df, model_features)
        predictions = predict(app.state.model, X, player_info)
        result = {"predictions": predictions, "feature_matrix": X, "element_ids": element_ids}
        app.state.cache.get_or_fetch("predictions_default", lambda: result)

        print(f"  Cache warm: {len(predictions)} players, model switching is now instant")
    except Exception as e:
        print(f"  WARNING: Pre-warm failed, first request will be slow: {e}")

    yield
    print("Shutting down...")


app = FastAPI(title="FPLens API", version="2.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "X-Refresh-Secret"],
)

app.include_router(predictions.router, prefix="/api")
app.include_router(fixtures.router, prefix="/api")
app.include_router(team.router, prefix="/api")
app.include_router(insights.router, prefix="/api")


@app.get("/api/health")
def health():
    """Basic liveness check with model and cache status."""
    return {
        "status": "ok",
        "model_loaded": hasattr(app.state, "model"),
        "cache_keys": list(app.state.cache.keys()) if hasattr(app.state, "cache") else [],
    }


@app.get("/api/status")
def status():
    """Current gameweek number and next deadline for the frontend shell."""
    from ml.pipelines.inference.fetch_live_data import get_bootstrap_data, get_current_gameweek

    cache = app.state.cache

    def fetch():
        bootstrap = get_bootstrap_data()
        event = get_current_gameweek(bootstrap["events"])
        return {"current_gw": event["id"], "deadline": event.get("deadline_time")}

    return cache.get_or_fetch("status", fetch)


@app.post("/api/refresh")
def refresh_cache(x_refresh_secret: str = Header(None)):
    """Invalidate all cached data. Requires REFRESH_SECRET header."""
    if x_refresh_secret != REFRESH_SECRET:
        raise HTTPException(status_code=403, detail="Invalid refresh secret")
    app.state.cache.invalidate()
    return {"status": "refreshed"}
