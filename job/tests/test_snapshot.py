"""Tests for the snapshot writer.

Prediction correctness lives in test_predict.py. What snapshot.py owns is the
file layout, JSON cleanliness, and the promise that a failed run leaves the
previous snapshot in place, so that is what these cover. Everything that does
I/O or runs a model is patched out.
"""

import json
from contextlib import contextmanager
from pathlib import Path
from unittest.mock import patch

import pandas as pd
import pytest

from job import snapshot


def _predictions(n=3):
    return pd.DataFrame(
        {
            "element": range(1, n + 1),
            "web_name": [f"P{i}" for i in range(1, n + 1)],
            "predicted_points": [5.5, 3.25, float("nan")][:n],
        }
    )


@contextmanager
def _stub(models=("config_d",), predict_side_effect=None, features=("element", "web_name")):
    """`features` is what each model expects; the live frame only ever has
    element and web_name, so anything else in it counts as zero-filled."""
    live = pd.DataFrame({"element": [1, 2, 3], "web_name": ["P1", "P2", "P3"]})
    info = [{"id": m, "name": m, "mae": 1.0, "spearman": 0.5} for m in models]

    with (
        patch.object(snapshot, "load_models", return_value=({m: object() for m in models}, info)),
        patch.object(
            snapshot,
            "get_bootstrap_data",
            # GW1's deadline is what the season label is derived from.
            return_value={"events": [{"id": 1, "deadline_time": "2026-08-14T17:30:00Z"}], "elements": []},
        ),
        patch.object(
            snapshot,
            "get_current_gameweek",
            return_value={"id": 12, "deadline_time": "2026-11-21T11:30:00Z"},
        ),
        patch.object(snapshot, "fetch_all_player_histories", return_value={}),
        patch.object(snapshot, "fetch_current_gw_data", return_value=live),
        patch.object(snapshot, "compute_player_shap", return_value={}),
        patch.object(snapshot, "get_player_fdr", return_value=[]),
        patch.object(snapshot, "load_horizon_models", return_value={}),
        patch.object(snapshot, "predict_multi_gw", return_value=[]),
        patch.object(snapshot, "solve_best_squad", return_value={"squad": []}),
        # Passthrough: the real one would add the fdr_* columns and change the
        # zero-fill counts these tests assert on.
        patch.object(snapshot, "add_future_fixture_features", side_effect=lambda df, _fx: df),
        patch.object(snapshot, "get_model_features", return_value=list(features)),
        patch.object(snapshot, "prepare_features", return_value=live),
        patch.object(snapshot, "predict", side_effect=predict_side_effect or (lambda *a, **k: _predictions())),
        patch.object(snapshot, "fetch_fixtures", return_value={"teams": [], "fixtures": {}}),
        patch.object(snapshot, "_build_model_insights", return_value={"ablation": {}}),
    ):
        yield


def test_writes_one_file_per_model_plus_manifest(tmp_path):
    out = tmp_path / "data"
    with _stub(models=("config_d", "baseline")):
        snapshot.build(out_dir=out, log_predictions=False)

    written = sorted(p.name for p in out.iterdir())
    assert written == [
        "best_squad.json",
        "fixtures.json",
        "manifest.json",
        "model_insights.json",
        "models.json",
        "multi_gw.json",
        "players.json",
        "predictions_baseline.json",
        "predictions_config_d.json",
    ]


def test_manifest_records_the_gameweek_and_models(tmp_path):
    out = tmp_path / "data"
    with _stub():
        snapshot.build(out_dir=out, log_predictions=False)

    manifest = json.loads((out / "manifest.json").read_text())
    assert manifest["gameweek"] == 12
    assert [m["id"] for m in manifest["models"]] == ["config_d"]
    assert manifest["generated_at"].endswith("+00:00")


def test_nan_becomes_null_because_json_has_no_nan(tmp_path):
    out = tmp_path / "data"
    with _stub():
        snapshot.build(out_dir=out, log_predictions=False)

    raw = (out / "predictions_config_d.json").read_text()
    assert "NaN" not in raw, "json.dumps emits bare NaN, which no JSON parser accepts"
    assert json.loads(raw)[2]["predicted_points"] is None


def test_no_staging_directory_is_left_behind(tmp_path):
    out = tmp_path / "data"
    with _stub():
        snapshot.build(out_dir=out, log_predictions=False)

    assert not (tmp_path / "data.staging").exists()


def test_a_failed_run_leaves_the_previous_snapshot_serving(tmp_path):
    """The architecture's failure story: a bad ingest degrades to stale, not empty."""
    out = tmp_path / "data"
    with _stub():
        snapshot.build(out_dir=out, log_predictions=False)
    before = (out / "predictions_config_d.json").read_text()

    def boom(*_a, **_k):
        raise RuntimeError("FPL API down")

    with _stub(predict_side_effect=boom), pytest.raises(RuntimeError):
        snapshot.build(out_dir=out, log_predictions=False)

    assert (out / "manifest.json").exists()
    assert (out / "predictions_config_d.json").read_text() == before


def test_the_previous_snapshot_survives_a_failed_swap(tmp_path):
    """The staging dance exists so a bad run degrades to stale, never to empty.
    Deleting the old directory before the rename broke exactly that."""
    out = tmp_path / "data"
    with _stub():
        snapshot.build(out_dir=out, log_predictions=False)
    before = (out / "manifest.json").read_text()

    with _stub(), patch.object(Path, "rename", side_effect=OSError("disk full")), pytest.raises(OSError):
        snapshot.build(out_dir=out, log_predictions=False)

    assert out.exists(), "the old snapshot was destroyed"
    assert (out / "manifest.json").read_text() == before


def test_no_previous_directory_is_left_behind(tmp_path):
    out = tmp_path / "data"
    with _stub():
        snapshot.build(out_dir=out, log_predictions=False)
        snapshot.build(out_dir=out, log_predictions=False)

    assert not (tmp_path / "data.previous").exists()


def test_refuses_to_publish_an_empty_snapshot(tmp_path):
    """Replacing a good snapshot with nothing is worse than not running."""
    out = tmp_path / "data"
    with patch.object(snapshot, "load_models", return_value=({}, [])), pytest.raises(RuntimeError, match="No models"):
        snapshot.build(out_dir=out, log_predictions=False)


def test_manifest_records_how_much_of_the_input_was_fabricated(tmp_path):
    """Config D is served with 42 of 155 features zero-filled. The snapshot has
    to say so, or the site presents a degraded model as a healthy one."""
    out = tmp_path / "data"
    with _stub(features=("element", "web_name", "us_xg_roll3", "fdr_gw2")):
        snapshot.build(out_dir=out, log_predictions=False)

    model = json.loads((out / "manifest.json").read_text())["models"][0]
    assert model["features_expected"] == 4
    assert model["features_zero_filled"] == 2
    assert model["zero_filled"] == ["fdr_gw2", "us_xg_roll3"]


def test_max_zero_filled_refuses_to_publish(tmp_path):
    out = tmp_path / "data"
    with (
        _stub(features=("element", "web_name", "us_xg_roll3", "fdr_gw2")),
        pytest.raises(RuntimeError, match="exceeds --max-zero-filled"),
    ):
        snapshot.build(out_dir=out, log_predictions=False, max_zero_filled=1)

    assert not out.exists(), "a rejected snapshot must not be written"


def test_max_zero_filled_allows_a_clean_run(tmp_path):
    out = tmp_path / "data"
    with _stub():
        snapshot.build(out_dir=out, log_predictions=False, max_zero_filled=0)

    assert (out / "manifest.json").exists()


def test_players_file_carries_history_fixtures_and_shap():
    preds = pd.DataFrame({"element": [1], "web_name": ["P1"], "team_name": ["ARS"], "predicted_points": [5.0]})
    histories = {1: [{"round": 3, "total_points": 6, "minutes": 90, "expected_goals": "0.4", "bonus": 1}]}
    fixtures = {"fixtures": {"ARS": [{"gw": 4, "opponent": "CHE"}]}}
    shap = {1: [{"feature": "form", "impact": 0.3}]}

    with patch.object(snapshot, "get_player_fdr", return_value=fixtures["fixtures"]["ARS"]):
        players = snapshot._build_players(preds, histories, fixtures, shap)

    p = players[1]
    assert p["pts_history"] == [6]
    assert p["gw_labels"] == ["GW3"]
    assert p["xg_history"] == [0.4], "expected_goals arrives from the API as a string"
    assert p["shap"] == shap[1]
    assert p["fixtures"] == fixtures["fixtures"]["ARS"]
    assert p["predicted_points"] == 5.0, "the prediction row is carried through"


def test_players_file_handles_a_player_with_no_history():
    """New signings and academy players have no gameweek history at all."""
    preds = pd.DataFrame({"element": [99], "web_name": ["New"], "team_name": ["ARS"], "predicted_points": [0.5]})

    with patch.object(snapshot, "get_player_fdr", return_value=[]):
        p = snapshot._build_players(preds, {}, {"fixtures": {}}, {})[99]

    assert p["pts_history"] == []
    assert p["shap"] == []


def test_snapshot_never_writes_guardian_content(tmp_path):
    """The Guardian's free tier forbids retaining content past 24 hours and this
    output is committed, so headlines must not reach it."""
    out = tmp_path / "data"
    with _stub():
        snapshot.build(out_dir=out, log_predictions=False)

    assert not (out / "news.json").exists()
    assert "news" not in [p.stem for p in out.iterdir()]


def test_prediction_log_records_when_each_forecast_was_made(tmp_path, monkeypatch):
    """The job runs daily, so a gameweek collects several forecasts. Without a
    timestamp there is no way to pick the last one before the deadline, which
    is the only thing the log is for."""
    log = tmp_path / "predictions_log.csv"
    monkeypatch.setattr(snapshot, "PREDICTION_LOG", log)

    out = tmp_path / "data"
    with _stub():
        snapshot.build(out_dir=out)

    rows = pd.read_csv(log)
    assert set(rows.columns) == {
        "season",
        "gameweek",
        "deadline",
        "generated_at",
        "model",
        "element",
        "predicted_points",
    }
    assert rows["generated_at"].notna().all()
    assert rows["season"].iloc[0] == "2026-27"


def test_prediction_log_migrates_an_older_schema(tmp_path, monkeypatch):
    """Appending wider rows to a four-column file leaves it unreadable, so the
    first run after the change rewrites it instead."""
    log = tmp_path / "predictions_log.csv"
    monkeypatch.setattr(snapshot, "PREDICTION_LOG", log)
    pd.DataFrame([{"gameweek": 4, "model": "config_d", "element": 1, "predicted_points": 2.5}]).to_csv(log, index=False)

    out = tmp_path / "data"
    with _stub():
        snapshot.build(out_dir=out)

    rows = pd.read_csv(log)
    assert len(rows) == 4, "the old row is kept alongside the three new ones"
    assert rows["generated_at"].isna().sum() == 1, "the old row has no timestamp to backfill"
    assert rows["generated_at"].notna().sum() == 3


def test_prediction_log_appends_rather_than_overwrites(tmp_path, monkeypatch):
    log = tmp_path / "predictions_log.csv"
    monkeypatch.setattr(snapshot, "PREDICTION_LOG", log)

    out = tmp_path / "data"
    with _stub():
        snapshot.build(out_dir=out)
        snapshot.build(out_dir=out)

    rows = pd.read_csv(log)
    assert len(rows) == 6, "two runs of three players should append, not replace"
    assert rows["generated_at"].nunique() >= 1, "each run stamps its own rows"
