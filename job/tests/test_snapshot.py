"""Tests for the snapshot writer.

Prediction correctness lives in test_predict.py. What snapshot.py owns is the
file layout, JSON cleanliness, and the promise that a failed run leaves the
previous snapshot in place, so that is what these cover. Everything that does
I/O or runs a model is patched out.
"""

import json
from contextlib import contextmanager
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
def _stub(models=("config_d",), predict_side_effect=None):
    live = pd.DataFrame({"element": [1, 2, 3], "web_name": ["P1", "P2", "P3"]})
    info = [{"id": m, "name": m, "mae": 1.0, "spearman": 0.5} for m in models]

    with (
        patch.object(snapshot, "load_models", return_value=({m: object() for m in models}, info)),
        patch.object(snapshot, "get_bootstrap_data", return_value={"events": []}),
        patch.object(snapshot, "get_current_gameweek", return_value={"id": 12}),
        patch.object(snapshot, "fetch_current_gw_data", return_value=live),
        patch.object(snapshot, "get_model_features", return_value=[]),
        patch.object(snapshot, "prepare_features", return_value=live),
        patch.object(snapshot, "predict", side_effect=predict_side_effect or (lambda *a, **k: _predictions())),
    ):
        yield


def test_writes_one_file_per_model_plus_manifest(tmp_path):
    out = tmp_path / "data"
    with _stub(models=("config_d", "baseline")):
        snapshot.build(out_dir=out, log_predictions=False)

    written = sorted(p.name for p in out.iterdir())
    assert written == ["manifest.json", "models.json", "predictions_baseline.json", "predictions_config_d.json"]


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


def test_refuses_to_publish_an_empty_snapshot(tmp_path):
    """Replacing a good snapshot with nothing is worse than not running."""
    out = tmp_path / "data"
    with patch.object(snapshot, "load_models", return_value=({}, [])), pytest.raises(RuntimeError, match="No models"):
        snapshot.build(out_dir=out, log_predictions=False)


def test_prediction_log_appends_rather_than_overwrites(tmp_path, monkeypatch):
    log = tmp_path / "predictions_log.csv"
    monkeypatch.setattr(snapshot, "PREDICTION_LOG", log)

    out = tmp_path / "data"
    with _stub():
        snapshot.build(out_dir=out)
        snapshot.build(out_dir=out)

    rows = pd.read_csv(log)
    assert len(rows) == 6, "two runs of three players should append, not replace"
    assert set(rows.columns) == {"gameweek", "model", "element", "predicted_points"}
