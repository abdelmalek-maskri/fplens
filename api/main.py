import os
import secrets
from contextlib import asynccontextmanager
from pathlib import Path

import joblib
from dotenv import load_dotenv
from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from api.cache import FPLDataCache
from api.routers import fixtures, insights, predictions, team
from job.models import load_models, patch_unpickle_names
from job.multi_gw import load_horizon_models
from job.predict import DEFAULT_MODEL

patch_unpickle_names()

# Before any os.environ read below. Previously only the news modules called this,
# and they import lazily, so API settings placed in .env were ignored at startup.
load_dotenv()

MODEL_PATH = Path(os.environ.get("MODEL_PATH", str(DEFAULT_MODEL)))

# No default. A shared fallback in a public repo is a published credential, so an
# unset secret disables the endpoint rather than leaving a guessable one in place.
REFRESH_SECRET = os.environ.get("REFRESH_SECRET", "")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load the selected models and initialise the FPL data cache on startup."""
    if not MODEL_PATH.exists():
        raise FileNotFoundError(f"Model file not found: {MODEL_PATH}")

    app.state.models, app.state.model_info = load_models()

    if "config_d" in app.state.models:
        app.state.model = app.state.models["config_d"]
        print(f"Loaded {len(app.state.models)} models, default: config_d")
    else:
        app.state.model = joblib.load(MODEL_PATH)
        print(f"Loaded {len(app.state.models)} models, default: {MODEL_PATH}")

    print("Loading horizon models (GW+2, GW+3)...")
    app.state.horizon_models = load_horizon_models()
    app.state.cache = FPLDataCache(ttl_minutes=15)

    # No pre-warm — the first request triggers data fetch via _get_live_data()
    # in predictions.py. The cache dedup lock ensures concurrent requests wait
    # for the same fetch rather than starting duplicates.

    yield
    print("Shutting down...")


app = FastAPI(title="FPLens API", version="2.0", lifespan=lifespan)

# The deployed dashboard is served from a different origin than the API, so the
# allowed origins have to be configurable. CORS_ORIGINS is a comma-separated list;
# the default covers local Vite only, so a deployment that forgets to set it fails
# visibly in the browser rather than silently allowing everything.
DEV_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"]
CORS_ORIGINS = [o.strip() for o in os.environ.get("CORS_ORIGINS", ",".join(DEV_ORIGINS)).split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
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
    from job.fetch_live_data import get_bootstrap_data, get_current_gameweek

    cache = app.state.cache

    def fetch():
        bootstrap = get_bootstrap_data()
        event = get_current_gameweek(bootstrap["events"])
        return {"current_gw": event["id"], "deadline": event.get("deadline_time")}

    return cache.get_or_fetch("status", fetch)


@app.post("/api/refresh")
def refresh_cache(x_refresh_secret: str = Header(None)):
    """Invalidate all cached data. Requires the REFRESH_SECRET header."""
    if not REFRESH_SECRET:
        raise HTTPException(status_code=503, detail="Cache refresh is not configured")
    # compare_digest keeps the check constant-time so the secret can't be guessed
    # a character at a time from response timing
    if not x_refresh_secret or not secrets.compare_digest(x_refresh_secret, REFRESH_SECRET):
        raise HTTPException(status_code=403, detail="Invalid refresh secret")
    app.state.cache.invalidate()
    return {"status": "refreshed"}
