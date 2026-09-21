"""Score the last finished gameweek against what the models predicted for it.

Runs after the snapshot in the daily job. Reads the prediction log, finds the
newest finished gameweek that has a forecast made before its deadline, fetches
the actual points, and writes app/public/accuracy.json for the Accuracy page.

Run with ``python -m job.accuracy``.
"""

import json
import math
from pathlib import Path

import pandas as pd
import requests

from job.fetch_live_data import FPL_BASE_URL, get_bootstrap_data

LOG = Path("data/predictions_log.csv")

# Outside app/public/data on purpose: the snapshot replaces that whole directory
# every run, so anything else written there is wiped the next morning.
OUT = Path("app/public/accuracy.json")

POSITIONS = {1: "GK", 2: "DEF", 3: "MID", 4: "FWD"}


def fetch_actuals(gw: int) -> dict:
    """Per-player stats for a finished gameweek, keyed by element ID."""
    response = requests.get(f"{FPL_BASE_URL}/event/{gw}/live/", timeout=30)
    response.raise_for_status()
    return {p["id"]: p["stats"] for p in response.json()["elements"]}


def pre_deadline_forecasts(log: pd.DataFrame, gw: int, deadline: str) -> dict:
    """The latest run per model that was logged before the deadline.

    Rows with no timestamp cannot prove they were made in time, so they are
    excluded rather than trusted.
    """
    rows = log[log.gameweek == gw].copy()
    rows["ts"] = pd.to_datetime(rows.generated_at, utc=True, errors="coerce")
    rows = rows[rows.ts < pd.Timestamp(deadline)]
    return {model: g[g.ts == g.ts.max()] for model, g in rows.groupby("model")}


def score(forecast: pd.DataFrame, actuals: dict, players: dict) -> dict:
    rows = []
    for r in forecast.itertuples():
        eid = int(r.element)
        stats = actuals.get(eid)
        info = players.get(eid, {})
        rows.append(
            {
                "element": eid,
                "name": info.get("web_name", str(eid)),
                "position": POSITIONS.get(info.get("element_type")),
                "predicted": round(float(r.predicted_points), 2),
                # A player missing from the live feed is unknown, not zero
                "actual": stats["total_points"] if stats else None,
                "minutes": stats["minutes"] if stats else None,
            }
        )
    rows.sort(key=lambda p: -p["predicted"])

    scored = pd.DataFrame([p for p in rows if p["actual"] is not None])
    # Spearman leads because MAE rewards predicting low on a target that is 60% zeros
    rho = scored.actual.corr(scored.predicted, method="spearman") if len(scored) > 1 else math.nan
    return {
        "spearman": None if math.isnan(rho) else round(float(rho), 3),
        "mae": round(float((scored.actual - scored.predicted).abs().mean()), 3) if len(scored) else None,
        "count": int(len(scored)),
        "players": rows,
    }


def build(log_path: Path = LOG, out_path: Path = OUT) -> dict | None:
    if not log_path.exists():
        print(f"No prediction log at {log_path}; nothing to score yet")
        return None

    bootstrap = get_bootstrap_data()
    log = pd.read_csv(log_path)
    players = {p["id"]: p for p in bootstrap["elements"]}

    for event in reversed(bootstrap["events"]):
        if not event["finished"]:
            continue
        forecasts = pre_deadline_forecasts(log, event["id"], event["deadline_time"])
        if forecasts:
            break
    else:
        print("No finished gameweek has a pre-deadline forecast yet")
        return None

    actuals = fetch_actuals(event["id"])
    result = {
        "gameweek": event["id"],
        "deadline": event["deadline_time"],
        # data_checked is FPL's sign-off; before it, bonus points can still move
        "final": bool(event["data_checked"]),
        "models": {model: score(f, actuals, players) for model, f in forecasts.items()},
    }

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(result, separators=(",", ":"), allow_nan=False), encoding="utf-8")
    print(f"GW{event['id']}: scored {len(forecasts)} models, final={result['final']}")
    return result


if __name__ == "__main__":
    build()
