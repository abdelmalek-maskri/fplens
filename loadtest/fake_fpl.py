"""A stand-in for the FPL API, so load tests never aim traffic at a third party.

Serves the three endpoints a squad request touches, with a latency that can be
set per run. bootstrap-static is padded to roughly its real 1.8MB, because its
size is the thing being measured.

    uvicorn loadtest.fake_fpl:app --port 8001

Then point the API at it:

    FPL_BASE_URL=http://127.0.0.1:8001 uvicorn api.main:app --port 8000
"""

import asyncio
import os

from fastapi import FastAPI

# ---------------------------------------------------------------------------
LATENCY_SECONDS = float(os.environ.get("FAKE_FPL_LATENCY", "0.3"))  # raise to model FPL under strain
app = FastAPI(title="Fake FPL")
_hits: dict[str, int] = {}
# ---------------------------------------------------------------------------


def _count(name: str) -> None:
    """Record that an endpoint was hit, so /_hits can report upstream load."""
    _hits[name] = _hits.get(name, 0) + 1


# Padded to the real payload's order of magnitude. The point of the test is how
# much a squad request drags over the wire, so the size has to be honest.
_PLAYERS = [
    {
        "id": i,
        "web_name": f"Player {i}",
        "team": (i % 20) + 1,
        "element_type": (i % 4) + 1,
        "now_cost": 50 + (i % 80),
        "form": "2.5",
        "status": "a",
        "filler": "x" * 1800,
    }
    for i in range(1, 800)
]

_BOOTSTRAP = {
    "events": [{"id": gw, "finished": gw < 10, "is_current": gw == 10} for gw in range(1, 39)],
    "elements": _PLAYERS,
    "teams": [{"id": t, "name": f"Team {t}", "short_name": f"T{t:02d}"} for t in range(1, 21)],
}


@app.get("/bootstrap-static/")
async def bootstrap():
    """The ~1.8MB payload, padded, because its size is what is being measured."""
    _count("bootstrap")
    await asyncio.sleep(LATENCY_SECONDS)
    return _BOOTSTRAP


@app.get("/entry/{fpl_id}/")
async def entry(fpl_id: int):
    """A manager's metadata. Any id is valid here, so every caller gets a hit."""
    _count("entry")
    await asyncio.sleep(LATENCY_SECONDS)
    return {
        "player_first_name": "Load",
        "player_last_name": f"Tester {fpl_id}",
        "name": f"Squad {fpl_id}",
        "summary_overall_rank": 1000 + fpl_id,
        "summary_overall_points": 500,
    }


@app.get("/entry/{fpl_id}/event/{gw}/picks/")
async def picks(fpl_id: int, gw: int):
    """A fixed 15-player squad. The contents do not matter, the round trip does."""
    _count("picks")
    await asyncio.sleep(LATENCY_SECONDS)
    return {
        "active_chip": None,
        "entry_history": {"bank": 15, "value": 1002},
        "picks": [
            {
                "element": i,
                "position": i,
                "multiplier": 2 if i == 1 else 1,
                "is_captain": i == 1,
                "is_vice_captain": i == 2,
            }
            for i in range(1, 16)
        ],
    }


@app.get("/_hits")
async def hits():
    """What the stand-in was actually asked for.

    The number that says whether caching upstream of it is working: a run of
    300 requests that reaches here 300 times means the cache did nothing.
    """
    return _hits


@app.post("/_reset")
async def reset():
    """Zero the counters, so a run's _hits describes that run alone."""
    _hits.clear()
    return {"status": "reset"}
