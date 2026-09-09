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
import json
import math
import shutil
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

from job.fetch_live_data import fetch_current_gw_data, get_bootstrap_data, get_current_gameweek
from job.models import MODEL_REGISTRY, load_models, selected_model_ids
from job.predict import get_model_features, predict, prepare_features

DEFAULT_OUT = Path("app/public/data")

# Appended to rather than overwritten: this is the record of what was predicted
# before the gameweek was played, which is the only way to score the model on
# real outcomes later. Nothing else in the project keeps it.
PREDICTION_LOG = Path("data/predictions_log.csv")

# Carried into each prediction file. Kept in sync with api.inference.PLAYER_INFO_COLS.
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

    gameweek = get_current_gameweek(get_bootstrap_data()["events"])["id"]

    print(f"Fetching live data for GW{gameweek}...")
    live_df = fetch_current_gw_data(include_history=True, include_understat=True)
    keep = [c for c in PLAYER_INFO_COLS if c in live_df.columns]
    player_info = live_df[keep].copy()

    live_cols = set(live_df.columns)
    per_model: dict[str, pd.DataFrame] = {}
    coverage: dict[str, list[str]] = {}

    for model_id, model in models.items():
        print(f"Predicting with {model_id}...")
        feats = get_model_features(model)
        # align_features fills these with 0 without saying which, so capture the
        # names here. A model quietly running on a quarter zeros still returns
        # confident-looking numbers, which is the failure worth surfacing.
        coverage[model_id] = sorted(set(feats) - live_cols)
        X = prepare_features(live_df, feats)
        per_model[model_id] = predict(model, X, player_info)

    for m in model_info:
        zero_filled = coverage.get(m["id"], [])
        m["features_expected"] = len(get_model_features(models[m["id"]]))
        m["features_zero_filled"] = len(zero_filled)
        m["zero_filled"] = zero_filled

    _report_coverage(model_info, max_zero_filled)

    manifest = {
        "gameweek": gameweek,
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
