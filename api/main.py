"""FPLens API.

Two endpoints that genuinely need a server. Everything else the site shows is
identical for every visitor and changes once per gameweek, so the scheduled job
writes it to JSON and the frontend reads that directly.

No model is loaded here. Predictions come from the snapshot, which is why this
process needs neither LightGBM nor XGBoost nor SHAP.
"""

import os
import secrets
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from api.cache import FPLDataCache
from api.routers import squad, team

# Before any os.environ read below. Previously only the news modules called this,
# and they import lazily, so API settings placed in .env were ignored at startup.
load_dotenv()

# No default. A shared fallback in a public repo is a published credential, so an
# unset secret disables the endpoint rather than leaving a guessable one in place.
REFRESH_SECRET = os.environ.get("REFRESH_SECRET", "")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Only the per-user cache needs setting up now."""
    app.state.cache = FPLDataCache(ttl_minutes=15)
    yield


app = FastAPI(title="FPLens API", version="3.0", lifespan=lifespan)

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

app.include_router(squad.router, prefix="/api")
app.include_router(team.router, prefix="/api")


@app.get("/api/health")
def health():
    """Basic liveness check."""
    return {"status": "ok", "cache_keys": list(app.state.cache.keys())}


@app.post("/api/refresh")
def refresh_cache(x_refresh_secret: str = Header(None)):
    """Drop cached squads so a manager sees their latest picks.

    Only per-user data is cached now; everything else is a file, refreshed by
    rerunning the job.
    """
    if not REFRESH_SECRET:
        raise HTTPException(status_code=503, detail="Cache refresh is not configured")
    # compare_digest keeps the check constant-time so the secret can't be guessed
    # a character at a time from response timing
    if not x_refresh_secret or not secrets.compare_digest(x_refresh_secret, REFRESH_SECRET):
        raise HTTPException(status_code=403, detail="Invalid refresh secret")
    app.state.cache.invalidate()
    return {"status": "refreshed"}
