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

from job.fetch_live_data import FPL_BASE_URL, current_season, get_bootstrap_data

LOG = Path("data/predictions_log.csv")
XI_LOG = Path("data/xi_log.csv")

# Outside app/public/data on purpose: the snapshot replaces that whole directory
# every run, so anything else written there is wiped the next morning.
OUT = Path("app/public/accuracy.json")

POSITIONS = {1: "GK", 2: "DEF", 3: "MID", 4: "FWD"}


def fetch_actuals(gw: int) -> dict:
    """Per-player stats for a finished gameweek, keyed by element ID."""
    response = requests.get(f"{FPL_BASE_URL}/event/{gw}/live/", timeout=30)
    response.raise_for_status()
    return {p["id"]: p["stats"] for p in response.json()["elements"]}


def _before_deadline(log: pd.DataFrame, season: str, gw: int, deadline: str) -> pd.DataFrame:
    """Rows for this season's gameweek that were logged before its deadline.

    Gameweek numbers repeat every season, so filtering on the number alone would
    let last season's GW5 score this season's. Rows with no timestamp cannot
    prove they were made in time, so they are excluded rather than trusted.
    """
    rows = log[(log.season == season) & (log.gameweek == gw)].copy()
    rows["ts"] = pd.to_datetime(rows.generated_at, utc=True, errors="coerce")
    return rows[rows.ts < pd.Timestamp(deadline)]


def pre_deadline_forecasts(log: pd.DataFrame, season: str, gw: int, deadline: str) -> dict:
    """The latest run per model that was logged before the deadline."""
    rows = _before_deadline(log, season, gw, deadline)
    return {model: g[g.ts == g.ts.max()] for model, g in rows.groupby("model")}


def pre_deadline_xi(log: pd.DataFrame, season: str, gw: int, deadline: str) -> pd.DataFrame | None:
    """The last optimal XI logged before the deadline, or None if there wasn't one."""
    rows = _before_deadline(log, season, gw, deadline)
    return None if rows.empty else rows[rows.ts == rows.ts.max()]


def score_xi(xi: pd.DataFrame, actuals: dict, players: dict, event: dict) -> dict:
    """What a manager fielding this XI would have scored, next to the field.

    The captain counts double. If the captain did not play, FPL passes the
    armband to the vice, and if neither played nobody is doubled.
    """

    def played(eid):
        stats = actuals.get(eid)
        return bool(stats and stats["minutes"] > 0)

    captain = int(xi[xi.role == "captain"].element.iloc[0])
    vice = int(xi[xi.role == "vice"].element.iloc[0])
    armband = captain if played(captain) else vice if played(vice) else None

    rows = []
    for r in xi.itertuples():
        eid = int(r.element)
        stats = actuals.get(eid)
        info = players.get(eid, {})
        rows.append(
            {
                "element": eid,
                "name": info.get("web_name", str(eid)),
                "position": POSITIONS.get(info.get("element_type")),
                "actual": stats["total_points"] if stats else None,
                "captain": eid == armband,
            }
        )
    rows.sort(key=lambda p: (not p["captain"], -(p["actual"] or 0)))

    return {
        "points": sum((p["actual"] or 0) * (2 if p["captain"] else 1) for p in rows),
        "average_manager": event.get("average_entry_score"),
        "highest": event.get("highest_score"),
        "players": rows,
    }


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


def build(log_path: Path = LOG, xi_log_path: Path = XI_LOG, out_path: Path = OUT) -> dict | None:
    if not log_path.exists():
        print(f"No prediction log at {log_path}; nothing to score yet")
        return None

    bootstrap = get_bootstrap_data()
    log = pd.read_csv(log_path)
    # The XI log arrived later than the prediction log, so it may not exist yet
    xi_log = pd.read_csv(xi_log_path) if xi_log_path.exists() else None
    players = {p["id"]: p for p in bootstrap["elements"]}
    season = current_season(bootstrap["events"])

    for event in reversed(bootstrap["events"]):
        if not event["finished"]:
            continue
        forecasts = pre_deadline_forecasts(log, season, event["id"], event["deadline_time"])
        if forecasts:
            break
    else:
        print(f"No finished {season} gameweek has a pre-deadline forecast yet")
        return None

    actuals = fetch_actuals(event["id"])
    xi = pre_deadline_xi(xi_log, season, event["id"], event["deadline_time"]) if xi_log is not None else None
    result = {
        "season": season,
        "gameweek": event["id"],
        "deadline": event["deadline_time"],
        # data_checked is FPL's sign-off; before it, bonus points can still move
        "final": bool(event["data_checked"]),
        "models": {model: score(f, actuals, players) for model, f in forecasts.items()},
        "xi": score_xi(xi, actuals, players, event) if xi is not None else None,
    }

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(result, separators=(",", ":"), allow_nan=False), encoding="utf-8")
    print(f"{season} GW{event['id']}: scored {len(forecasts)} models, final={result['final']}")
    return result


if __name__ == "__main__":
    build()
