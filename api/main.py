"""FPLens API.

Two endpoints that genuinely need a server. Everything else the site shows is
identical for every visitor and changes once per gameweek, so the scheduled job
writes it to JSON and the frontend reads that directly.

/team varies by who is asking. /news cannot be stored at all: the Guardian's
licence forbids retaining content beyond 24 hours.

No model is loaded here. Predictions come from the snapshot, which is why this
process needs neither LightGBM nor XGBoost nor SHAP.

News is the exception to the precompute rule: the Guardian's licence forbids
retaining content beyond 24 hours, so it cannot live in a committed snapshot.
"""

import os
import re
import secrets
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from api.cache import FPLDataCache
from api.ratelimit import UpstreamGuard
from api.routers import news, team

# Before the os.environ reads below, which happen at import. A module that
# calls load_dotenv itself is too late if it is imported lazily, so this has
# to be the process's first call rather than any one feature's.
load_dotenv()

# ---------------------------------------------------------------------------
# No default on the secret. A shared fallback in a public repo is a published
# credential, so an unset secret disables the endpoint rather than leaving a
# guessable one in place. A manager's FPL ID is in the path of every /team
# request, and an ID plus a squad is enough to name the person, so the pattern
# below strips it from Sentry events before they leave the process.
REFRESH_SECRET = os.environ.get("REFRESH_SECRET", "")
SENTRY_DSN = os.environ.get("SENTRY_DSN", "")
_FPL_ID_IN_PATH = re.compile(r"(/api/team/)\d+")
# ---------------------------------------------------------------------------


def scrub_fpl_id(event, hint):
    """Replace the manager ID in any URL on the event with a placeholder.

    The route pattern FastAPI reports as the transaction name is already
    anonymous; it is the concrete request URL, and any breadcrumb recording a
    call to it, that carry the real number.
    """
    request = event.get("request")
    if request and isinstance(request.get("url"), str):
        request["url"] = _FPL_ID_IN_PATH.sub(r"\1{fpl_id}", request["url"])

    for crumb in event.get("breadcrumbs", {}).get("values", []) or []:
        url = crumb.get("data", {}).get("url")
        if isinstance(url, str):
            crumb["data"]["url"] = _FPL_ID_IN_PATH.sub(r"\1{fpl_id}", url)

    return event


# Guarded so local runs and the test suite stay silent. An unset DSN is the
# normal case everywhere except the deployed API.
if SENTRY_DSN:
    import sentry_sdk
    from sentry_sdk.integrations.fastapi import FastApiIntegration
    from sentry_sdk.integrations.starlette import StarletteIntegration

    # The SDK reports every 5xx by default, and most of ours are deliberate:
    # a 503 when refresh is unconfigured is a setting, not a fault. 500 is an
    # unhandled crash and 502 means the FPL API itself is failing, which are
    # the two worth waking up for.
    REPORTABLE = {500, 502}

    sentry_sdk.init(
        dsn=SENTRY_DSN,
        integrations=[
            StarletteIntegration(failed_request_status_codes=REPORTABLE),
            FastApiIntegration(failed_request_status_codes=REPORTABLE),
        ],
        environment=os.environ.get("SENTRY_ENV", "production"),
        # Render exposes the deployed commit, so an issue points at the code that
        # produced it rather than at whatever main happened to be that week.
        release=os.environ.get("RENDER_GIT_COMMIT"),
        # Errors only. Tracing would spend the quota on healthy requests, and
        # there is no latency question open that it would answer.
        traces_sample_rate=0.0,
        send_default_pii=False,
        before_send=scrub_fpl_id,
    )


@asynccontextmanager
async def lifespan(app: FastAPI):
    """The per-user cache, and the budget for the fetches it cannot absorb.

    /team is the only endpoint whose cache key a caller chooses, so it is the
    only one that can be made to call the FPL API at will.
    """
    app.state.cache = FPLDataCache(ttl_minutes=15)
    app.state.upstream_guard = UpstreamGuard()
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

app.include_router(news.router, prefix="/api")
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
