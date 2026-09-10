import contextlib
import os
import secrets
import sys
from contextlib import asynccontextmanager
from pathlib import Path

import joblib
from dotenv import load_dotenv
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

# Before any os.environ read below. Previously only the news modules called this,
# and they import lazily, so API settings placed in .env were ignored at startup.
load_dotenv()

MODEL_PATH = Path(os.environ.get("MODEL_PATH", str(DEFAULT_MODEL)))

# GW+1 model registry, served to the frontend selector via /api/models.
# (display name, joblib path, MAE, Spearman rho) on the 2024-25 holdout.
#
# Both metrics are exposed because ranking and error disagree here, and that
# disagreement is the point: baseline_tweedie has the lowest MAE of anything in
# the project while ranking near the bottom, because 60% of the target is zeros
# and MAE rewards predicting low. rho is the metric to sort and judge by.
# Numbers come from outputs/experiments/**/{summary,metrics,*_comprehensive}.json.
MODEL_REGISTRY = {
    "config_d": (
        "Config D: Stacked + Injury + News",
        "outputs/experiments/ablation/config_D/model.joblib",
        1.029,
        0.687,
    ),
    "config_b": ("Config B: + Injury", "outputs/experiments/ablation/config_B/model.joblib", 1.032, 0.685),
    "config_c": ("Config C: + News", "outputs/experiments/ablation/config_C/model.joblib", 1.037, 0.675),
    "config_a": ("Config A: FPL + Understat", "outputs/experiments/ablation/config_A/model.joblib", 1.039, 0.674),
    "stacked_ensemble": (
        "Stacked Ensemble (no injury/news)",
        "outputs/experiments/stacked_ensemble/model.joblib",
        1.080,
        0.669,
    ),
    "catboost_twohead": ("CatBoost Two-Head", "outputs/experiments/catboost_twohead/model.joblib", 1.097, 0.667),
    "baseline_tweedie": ("LightGBM Tweedie", "outputs/experiments/baseline_tweedie/model.joblib", 1.021, 0.662),
    "baseline": ("Single LightGBM", "outputs/experiments/baseline/model.joblib", 1.091, 0.661),
    "twohead": ("Two-Head (Classifier + Regressor)", "outputs/experiments/twohead/model.joblib", 1.087, 0.655),
    "position_specific": (
        "Position-Specific (4× LightGBM)",
        "outputs/experiments/position_specific/model.joblib",
        1.095,
        0.633,
    ),
}

# No default. A shared fallback in a public repo is a published credential, so an
# unset secret disables the endpoint rather than leaving a guessable one in place.
REFRESH_SECRET = os.environ.get("REFRESH_SECRET", "")

# The set deployed to production. Each of the four non-ensemble models is 4-7MB
# and demonstrates something distinct (lowest MAE but poor ranking, the original
# baseline, a different architecture, a failed experiment). The remaining ablation
# configs share config_d's architecture, so each would cost ~120MB of RAM to show
# a ranking difference of about 2%.
SHOWCASE_MODELS = ("config_d", "baseline_tweedie", "baseline", "twohead", "position_specific")


def selected_model_ids() -> list[str]:
    """Model IDs to attempt loading.

    Defaults to SHOWCASE_MODELS so a local run shows the same selector a visitor
    gets, rather than every model that happens to be on disk. FPLENS_MODELS takes
    "all", "showcase", or a comma-separated list of IDs.
    """
    raw = os.environ.get("FPLENS_MODELS", "").strip()
    if not raw or raw == "showcase":
        return list(SHOWCASE_MODELS)
    if raw == "all":
        return list(MODEL_REGISTRY)

    ids = [m.strip() for m in raw.split(",") if m.strip()]
    unknown = [m for m in ids if m not in MODEL_REGISTRY]
    if unknown:
        raise ValueError(f"FPLENS_MODELS contains unknown model IDs {unknown}; valid: {list(MODEL_REGISTRY)}")
    return ids


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load the selected models and initialise the FPL data cache on startup."""
    if not MODEL_PATH.exists():
        raise FileNotFoundError(f"Model file not found: {MODEL_PATH}")

    app.state.models = {}
    app.state.model_info = []
    for model_id in selected_model_ids():
        name, path, mae, rho = MODEL_REGISTRY[model_id]
        p = Path(path)
        if not p.exists():
            continue
        try:
            print(f"  Loading {name} from {path}...")
            app.state.models[model_id] = joblib.load(p)
            app.state.model_info.append({"id": model_id, "name": name, "mae": mae, "spearman": rho})
        except Exception as e:
            print(f"  WARNING: Failed to load {name}: {e}")

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
    from ml.pipelines.inference.fetch_live_data import get_bootstrap_data, get_current_gameweek

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
