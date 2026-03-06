"""Fantasy Foresight API, serves ML predictions from trained model."""

from contextlib import asynccontextmanager
from pathlib import Path
import joblib
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.cache import FPLDataCache
from api.routers import predictions, fixtures, team, insights

MODEL_PATH = Path("outputs/experiments/ablation_injury/config_D/model.joblib")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Load model and initialise cache on startup
    print(f"loading ML model from {MODEL_PATH}...")
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
    allow_methods=["*"],
    allow_headers=["*"],
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


@app.post("/api/refresh")
def refresh_cache():
    app.state.cache.invalidate()
    return {"status": "refreshed"}
