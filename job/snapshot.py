"""Write the JSON the website reads.

Run once per gameweek deadline, not per request. The live fetch costs roughly
one FPL API call per player, so it happens once here and every model predicts
on top of the same frame, mirroring how the API's cache used to work.

    python3 -m job.snapshot
    python3 -m job.snapshot --out app/public/data --models config_d,baseline

The output directory is built in a sibling temp directory and swapped into
place at the end, so a run that dies partway leaves the previous snapshot
serving rather than a half-written mixture of two gameweeks.
"""

import argparse
import csv
import json
import logging
import math
import shutil
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

from job.fetch_live_data import (
    fetch_all_player_histories,
    fetch_current_gw_data,
    fetch_fixtures,
    get_bootstrap_data,
    get_current_gameweek,
    get_player_fdr,
)
from job.models import MODEL_REGISTRY, load_models, selected_model_ids
from job.multi_gw import add_future_fixture_features, load_horizon_models, predict_multi_gw
from job.predict import compute_player_shap, get_model_features, predict, prepare_features
from job.solvers import solve_best_squad

logger = logging.getLogger(__name__)

DEFAULT_OUT = Path("app/public/data")

OUTPUTS = Path("outputs")
SHAP_IMPORTANCE_PATH = OUTPUTS / "evaluation/shap/config_D/global_importance.csv"

# The API capped this at 10 and the UI asks for 6. Writing the maximum lets the
# frontend slice to whatever it wants from one file.
FIXTURE_GWS = 10

# News is deliberately not written here. The Guardian's free tier forbids
# retaining content beyond 24 hours and this snapshot is committed, so headlines
# would be kept permanently in git history. /api/news serves it live instead.
# The model's news features are unaffected: those are derived aggregates built
# inside fetch_current_gw_data, not article text.

# GW+2 and GW+3 are the only horizons with trained models.
MULTI_GW_HORIZON = 3

# The squad budget. Fixed, so the optimal squad is the same for everyone and can
# be precomputed rather than solved per request.
SQUAD_BUDGET = 100.0

# Appended to rather than overwritten: this is the record of what was predicted
# before the gameweek was played, which is the only way to score the model on
# real outcomes later. Nothing else in the project keeps it.
PREDICTION_LOG = Path("data/predictions_log.csv")

# Player info carried into each prediction file alongside the predicted points.
PLAYER_INFO_COLS = [
    "element",
    "web_name",
    "name",
    "team_name",
    "position",
    "value",
    "status",
    "form",
    "total_points",
    "chance_this_round",
    "news",
    "opponent_name",
    "selected_by_percent",
    "goals_scored",
    "expected_goals",
    "assists",
    "expected_assists",
    "transfers_in_event",
    "transfers_out_event",
    "ict_index",
    "minutes",
    "bonus",
    "bps",
    "clean_sheets",
    "goals_conceded",
]


def _clean(value):
    """JSON has no NaN or Infinity, and pandas produces both."""
    if isinstance(value, float) and not math.isfinite(value):
        return None
    if hasattr(value, "item"):
        return _clean(value.item())
    return value


def _records(df: pd.DataFrame) -> list[dict]:
    return [{k: _clean(v) for k, v in row.items()} for row in df.to_dict(orient="records")]


def _write_json(path: Path, payload) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, separators=(",", ":")), encoding="utf-8")


def _append_prediction_log(gameweek: int, per_model: dict[str, pd.DataFrame]) -> None:
    rows = []
    for model_id, df in per_model.items():
        for r in df[["element", "predicted_points"]].itertuples(index=False):
            rows.append(
                {
                    "gameweek": gameweek,
                    "model": model_id,
                    "element": int(r.element),
                    "predicted_points": round(float(r.predicted_points), 4),
                }
            )

    log = pd.DataFrame(rows)
    PREDICTION_LOG.parent.mkdir(parents=True, exist_ok=True)
    header = not PREDICTION_LOG.exists()
    log.to_csv(PREDICTION_LOG, mode="a", header=header, index=False)


def _build_model_insights() -> dict:
    """Training metrics, ablation results and global SHAP importance.

    Pure disk reads from outputs/. This never needed a request to serve it; the
    endpoint was re-reading these six files on every call.
    """
    ablation_path = OUTPUTS / "experiments/ablation/ablation_summary.json"
    ablation = json.loads(ablation_path.read_text()) if ablation_path.exists() else {}

    shap_features = []
    if SHAP_IMPORTANCE_PATH.exists():
        with open(SHAP_IMPORTANCE_PATH) as f:
            shap_features = list(csv.DictReader(f))
    else:
        logger.warning("SHAP importances missing at %s; that tab will render empty", SHAP_IMPORTANCE_PATH)

    variants = []
    for config in ["A", "B", "C", "D"]:
        summary_path = OUTPUTS / f"experiments/ablation/config_{config}/summary.json"
        if summary_path.exists():
            variants.append(json.loads(summary_path.read_text()))

    return {"ablation": ablation, "shap_features": shap_features, "model_variants": variants}


def _build_players(predictions: pd.DataFrame, histories: dict, fixtures: dict, shap: dict) -> dict:
    """Full detail for every player, keyed by element id.

    One file rather than 654: gzipped it is around 100KB, so a visitor pays it
    once and every subsequent player is free. The alternative was a file each,
    which is a smaller first click but rewrites 654 files every gameweek.

    Mirrors what /api/player/{id} assembled per request. Like that endpoint,
    it uses the default model only, so the numbers here do not follow the
    dashboard's model selector.
    """
    fx_by_team = fixtures.get("fixtures", {})
    players = {}

    for row in predictions.to_dict(orient="records"):
        eid = int(row["element"])
        player = {k: _clean(v) for k, v in row.items()}

        last10 = (histories.get(eid) or [])[-10:]
        player["pts_history"] = [g.get("total_points", 0) for g in last10]
        player["pts_last5"] = player["pts_history"][-5:]
        player["gw_labels"] = [f"GW{g.get('round', 0)}" for g in last10]
        player["minutes_history"] = [g.get("minutes", 0) for g in last10]
        player["xg_history"] = [float(g.get("expected_goals", 0) or 0) for g in last10]
        player["xa_history"] = [float(g.get("expected_assists", 0) or 0) for g in last10]
        player["bonus_history"] = [g.get("bonus", 0) for g in last10]

        player["fixtures"] = get_player_fdr(fx_by_team, player.get("team_name", ""))
        player["shap"] = shap.get(eid, [])
        players[eid] = player

    return players


def _report_coverage(model_info: list[dict], max_zero_filled: int | None) -> None:
    """Say how much of each model's input was fabricated, and optionally refuse.

    Zero-filling is not inherently wrong: a feature the live API cannot supply
    has to be something. It becomes wrong when nobody knows it happened, because
    the model was evaluated with those columns present and is being served
    without them.
    """
    worst = 0
    for m in model_info:
        n, total = m["features_zero_filled"], m["features_expected"]
        worst = max(worst, n)
        if not n:
            continue
        pct = 100 * n / total if total else 0
        print(f"  WARNING: {m['id']} has {n}/{total} features zero-filled ({pct:.0f}%)")
        print(f"           {', '.join(m['zero_filled'][:8])}{' ...' if n > 8 else ''}")

    if max_zero_filled is not None and worst > max_zero_filled:
        raise RuntimeError(
            f"{worst} zero-filled features exceeds --max-zero-filled {max_zero_filled}. The snapshot was not written."
        )


def build(
    out_dir: Path = DEFAULT_OUT,
    model_ids: list[str] | None = None,
    log_predictions: bool = True,
    max_zero_filled: int | None = None,
) -> dict:
    """Fetch live data once, predict with each model, write the snapshot.

    Returns the manifest. Raises if no model could be loaded, since an empty
    snapshot would replace a good one with nothing, or if max_zero_filled is set
    and any model exceeds it.
    """
    model_ids = model_ids if model_ids is not None else selected_model_ids()
    models, model_info = load_models(model_ids)
    if not models:
        raise RuntimeError(f"No models could be loaded from {model_ids}. Train them or check outputs/.")

    bootstrap = get_bootstrap_data()
    event = get_current_gameweek(bootstrap["events"])
    gameweek = event["id"]

    print(f"Fetching live data for GW{gameweek}...")
    # Fetched here rather than inside fetch_current_gw_data because the player
    # detail file needs them too, and they cost ~600 API calls.
    histories = fetch_all_player_histories([p["id"] for p in bootstrap["elements"]])
    live_df = fetch_current_gw_data(include_history=True, include_understat=True, histories=histories)
    keep = [c for c in PLAYER_INFO_COLS if c in live_df.columns]
    player_info = live_df[keep].copy()

    # The GW+1 models were trained with GW+2/GW+3 fixture difficulty, but only the
    # multi-horizon path ever built those columns, so the default model has always
    # been served with them zero-filled. Fixtures are published weeks ahead, so
    # this is knowable at prediction time, not leakage.
    fixtures = fetch_fixtures(bootstrap, num_gws=FIXTURE_GWS)
    live_df = add_future_fixture_features(live_df, fixtures)

    live_cols = set(live_df.columns)
    per_model: dict[str, pd.DataFrame] = {}
    coverage: dict[str, list[str]] = {}
    default_id = model_info[0]["id"]
    default_X = None

    for model_id, model in models.items():
        print(f"Predicting with {model_id}...")
        feats = get_model_features(model)
        # align_features fills these with 0 without saying which, so capture the
        # names here. A model quietly running on a quarter zeros still returns
        # confident-looking numbers, which is the failure worth surfacing.
        coverage[model_id] = sorted(set(feats) - live_cols)
        X = prepare_features(live_df, feats)
        per_model[model_id] = predict(model, X, player_info)
        if model_id == default_id:
            default_X = X

    for m in model_info:
        zero_filled = coverage.get(m["id"], [])
        m["features_expected"] = len(get_model_features(models[m["id"]]))
        m["features_zero_filled"] = len(zero_filled)
        m["zero_filled"] = zero_filled

    _report_coverage(model_info, max_zero_filled)

    print("Building player detail...")
    element_ids = [int(e) for e in live_df["element"]]
    shap = compute_player_shap(models[default_id], default_X, element_ids, top_n=5)
    players = _build_players(per_model[default_id], histories, fixtures, shap)

    print("Solving the optimal squad...")
    best_squad = solve_best_squad(per_model[default_id], budget=SQUAD_BUDGET)

    print("Predicting GW+2 and GW+3...")
    multi_gw = predict_multi_gw(
        per_model[default_id], live_df, load_horizon_models(), fixtures, horizon=MULTI_GW_HORIZON
    )

    manifest = {
        "gameweek": gameweek,
        # Carried so the header can show the countdown without an API call.
        "deadline": event.get("deadline_time"),
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "models": model_info,
        "default_model": model_info[0]["id"] if model_info else None,
    }

    # Build beside the target, then swap, so a crash cannot leave the site
    # serving half of one gameweek and half of another.
    out_dir = Path(out_dir)
    staging = out_dir.with_name(out_dir.name + ".staging")
    if staging.exists():
        shutil.rmtree(staging)
    staging.mkdir(parents=True)

    for model_id, df in per_model.items():
        _write_json(staging / f"predictions_{model_id}.json", _records(df))
    _write_json(staging / "models.json", model_info)
    _write_json(staging / "players.json", players)
    _write_json(staging / "multi_gw.json", multi_gw)
    _write_json(staging / "best_squad.json", best_squad)
    _write_json(staging / "fixtures.json", fixtures)
    _write_json(staging / "model_insights.json", _build_model_insights())
    _write_json(staging / "manifest.json", manifest)

    if out_dir.exists():
        shutil.rmtree(out_dir)
    staging.rename(out_dir)

    if log_predictions:
        _append_prediction_log(gameweek, per_model)

    print(f"Wrote {len(per_model)} prediction files for GW{gameweek} to {out_dir}")
    return manifest


def main() -> None:
    parser = argparse.ArgumentParser(description="Build the JSON snapshot the website reads.")
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT, help=f"output directory (default: {DEFAULT_OUT})")
    parser.add_argument(
        "--models",
        default=None,
        help=f"comma-separated model IDs (default: the showcase set). Valid: {','.join(MODEL_REGISTRY)}",
    )
    parser.add_argument("--no-log", action="store_true", help="skip appending to the prediction log")
    parser.add_argument(
        "--max-zero-filled",
        type=int,
        default=None,
        help="fail instead of publishing if any model has more than N features zero-filled",
    )
    args = parser.parse_args()

    ids = [m.strip() for m in args.models.split(",")] if args.models else None
    build(
        out_dir=args.out,
        model_ids=ids,
        log_predictions=not args.no_log,
        max_zero_filled=args.max_zero_filled,
    )


if __name__ == "__main__":
    main()
