"""Fantasy Foresight API — serves ML predictions from trained models."""

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

# joblib needs these classes in scope to unpickle custom model objects.
# Models pickled when training scripts ran as __main__; uvicorn --reload
# remaps that to __mp_main__, so we patch both modules.
from ml.pipelines.train.train_stacked_ensemble import StackedEnsemble  
from ml.pipelines.train.train_twohead_model import TwoHeadModel 
from ml.pipelines.train.train_position_specific import PositionSpecificLGBMModel  

with contextlib.suppress(ImportError):
    from ml.pipelines.train.train_stacked_with_injury import StackedEnsembleInjury  

_MODEL_CLASSES = [StackedEnsemble, TwoHeadModel, PositionSpecificLGBMModel]
for _mod in ("__main__", "__mp_main__"):
    if _mod in sys.modules:
        for _cls in _MODEL_CLASSES:
            setattr(sys.modules[_mod], _cls.__name__, _cls)

MODEL_PATH = Path(os.environ.get("MODEL_PATH", str(DEFAULT_MODEL)))

# All GW+1 models available for user selection via /api/models
MODEL_REGISTRY = {
    "config_d": (
        "Config D: Stacked + Injury + News (Best)",
        "outputs/experiments/ablation_injury/config_D/model.joblib",
        1.016,
    ),
    "config_a": ("Config A: FPL + Understat only", "outputs/experiments/ablation_injury/config_A/model.joblib", 1.026),
    "config_b": ("Config B: + Injury features", "outputs/experiments/ablation_injury/config_B/model.joblib", 1.016),
    "config_c": ("Config C: + News features", "outputs/experiments/ablation_injury/config_C/model.joblib", 1.023),
    "stacked_ensemble": ("Stacked Ensemble (109 features)", "outputs/experiments/stacked_ensemble/model.joblib", 1.051),
    "catboost_tweedie": (
        "CatBoost Tweedie vp1.5",
        "outputs/experiments/multi_horizon/gw1/catboost_tweedie_vp1.5/model.joblib",
        1.032,
    ),
    "lgbm_baseline": ("LightGBM Baseline", "outputs/experiments/multi_horizon/gw1/lgbm_baseline/model.joblib", 1.054),
    "baseline": ("Single LightGBM (production)", "outputs/experiments/baseline/model.joblib", 1.060),
}

REFRESH_SECRET = os.environ.get("REFRESH_SECRET", "dev-secret")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load all models and initialise cache on startup."""
    if not MODEL_PATH.exists():
        raise FileNotFoundError(f"Model file not found: {MODEL_PATH}")

    app.state.models = {}
    app.state.model_info = []
    for model_id, (name, path, mae) in MODEL_REGISTRY.items():
        p = Path(path)
        if p.exists():
            try:
                print(f"  Loading {name} from {path}...")
                app.state.models[model_id] = joblib.load(p)
                app.state.model_info.append({"id": model_id, "name": name, "mae": mae})
            except Exception as e:
                print(f"  WARNING: Failed to load {name}: {e}")

    # Default model: prefer config_d, fallback to MODEL_PATH
    if "config_d" in app.state.models:
        app.state.model = app.state.models["config_d"]
        print(f"Loaded {len(app.state.models)} models, default: config_d")
    else:
        app.state.model = joblib.load(MODEL_PATH)
        print(f"Loaded {len(app.state.models)} models, default: {MODEL_PATH}")

    print("Loading horizon models (GW+2, GW+3)...")
    app.state.horizon_models = load_horizon_models()
    app.state.cache = FPLDataCache(ttl_minutes=15)
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
