"""Fantasy Foresight API, serves ML predictions from trained model."""

import os
from contextlib import asynccontextmanager
from pathlib import Path

import joblib
from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from api.cache import FPLDataCache
from api.routers import fixtures, insights, predictions, team
from ml.pipelines.inference.predict import DEFAULT_MODEL

MODEL_PATH = Path(os.environ.get("MODEL_PATH", str(DEFAULT_MODEL)))


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Load model and initialise cache on startup
    if not MODEL_PATH.exists():
        raise FileNotFoundError(
            f"Model file not found: {MODEL_PATH}\nSet MODEL_PATH env var or ensure the file exists."
        )
    print(f"Loading ML model from {MODEL_PATH}...")
    app.state.model = joblib.load(MODEL_PATH)
    app.state.cache = FPLDataCache(ttl_minutes=15)
    print(f"Model loaded: {type(app.state.model).__name__}")
    yield
    print("Shutting down...")


app = FastAPI(
    title="FPLens API",
    version="2.0",
    lifespan=lifespan,
)

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


# When I deploy, set REFRESH_SECRET in .env to something strong:
#   REFRESH_SECRET=some-long-random-string
# Then call it with:
#   curl -X POST http://localhost:8000/api/refresh -H "X-Refresh-Secret: some-long-random-string"
REFRESH_SECRET = os.environ.get("REFRESH_SECRET", "dev-secret")


@app.post("/api/refresh")
def refresh_cache(x_refresh_secret: str = Header(None)):
    if x_refresh_secret != REFRESH_SECRET:
        raise HTTPException(status_code=403, detail="Invalid refresh secret")
    app.state.cache.invalidate()
    return {"status": "refreshed"}
