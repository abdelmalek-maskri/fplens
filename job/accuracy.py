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
from job.models import DEFAULT_MODEL_ID

LOG = Path("data/predictions_log.csv")
XI_LOG = Path("data/xi_log.csv")

# Outside app/public/data on purpose: the snapshot replaces that whole directory
# every run, so anything else written there is wiped the next morning.
OUT = Path("app/public/accuracy.json")

# One small entry per scored gameweek, so the season's record survives. OUT holds
# a single gameweek in full and is overwritten weekly; without this the history
# would be thrown away every run. Roughly 700 bytes a gameweek, 26 KB a season.
HISTORY = Path("app/public/accuracy_history.json")

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


def pre_deadline_xi(
    log: pd.DataFrame, season: str, gw: int, deadline: str, default_model: str
) -> dict[str, pd.DataFrame]:
    """The last XI each model logged before the deadline, keyed by model id.

    Rows written before the log carried a model column came from the default
    model, so they are read as that rather than discarded.
    """
    rows = _before_deadline(log, season, gw, deadline)
    if rows.empty:
        return {}
    if "model" not in rows.columns:
        rows = rows.assign(model=default_model)
    rows = rows.assign(model=rows["model"].fillna(default_model))
    return {model: group[group.ts == group.ts.max()] for model, group in rows.groupby("model")}


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


def summarise(result: dict) -> dict:
    """The few numbers a season chart needs, without the per-player detail."""
    return {
        "gameweek": result["gameweek"],
        "deadline": result["deadline"],
        "final": result["final"],
        "models": {m: {k: v[k] for k in ("spearman", "mae", "count")} for m, v in result["models"].items()},
        "xi": ({k: result["xi"][k] for k in ("points", "average_manager")} if result["xi"] else None),
    }


def update_history(result: dict, path: Path = HISTORY) -> dict:
    """Add this gameweek to the season's record, replacing any earlier entry.

    The job runs daily, so the same gameweek is scored many times: first
    provisionally, then again once FPL settles the bonus points. Each run
    replaces its own entry rather than appending a duplicate.
    """
    try:
        history = json.loads(path.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        history = {}

    # Gameweek numbers repeat every year, so a new season starts a new record.
    weeks = history.get("gameweeks", []) if history.get("season") == result["season"] else []
    weeks = [w for w in weeks if w["gameweek"] != result["gameweek"]]
    weeks.append(summarise(result))
    weeks.sort(key=lambda w: w["gameweek"])

    out = {"season": result["season"], "gameweeks": weeks}
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(out, separators=(",", ":"), allow_nan=False), encoding="utf-8")
    return out


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
    xis = (
        pre_deadline_xi(xi_log, season, event["id"], event["deadline_time"], DEFAULT_MODEL_ID)
        if xi_log is not None
        else {}
    )
    scored_xis = {m: score_xi(x, actuals, players, event) for m, x in xis.items()}

    models = {}
    for model, f in forecasts.items():
        entry = score(f, actuals, players)
        # None where this model has no XI logged for the gameweek, which is the
        # case for every model but the default before per-model logging began.
        entry["xi"] = scored_xis.get(model)
        models[model] = entry

    result = {
        "season": season,
        "gameweek": event["id"],
        "deadline": event["deadline_time"],
        # data_checked is FPL's sign-off; before it, bonus points can still move
        "final": bool(event["data_checked"]),
        "models": models,
        # Kept alongside the per-model copies so anything reading the old shape
        # still finds the recommended team.
        "xi": scored_xis.get(DEFAULT_MODEL_ID),
    }

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(result, separators=(",", ":"), allow_nan=False), encoding="utf-8")
    history = update_history(result)
    print(
        f"{season} GW{event['id']}: scored {len(forecasts)} models, final={result['final']}, "
        f"{len(history['gameweeks'])} gameweek(s) on record"
    )
    return result


if __name__ == "__main__":
    build()
