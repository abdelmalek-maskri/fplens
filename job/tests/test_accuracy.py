"""Tests for the gameweek accuracy scorer.

The two things that make a live score honest are picking only forecasts made
before the deadline, and never turning a missing player into a zero. Both are
covered here. Network is patched out.
"""

import json
from unittest.mock import patch

import pandas as pd

from job import accuracy

DEADLINE = "2026-09-18T17:30:00Z"


def _log():
    rows = [
        # (generated_at, element, predicted) — all gameweek 5, model config_d
        (None, 1, 99.0),  # no timestamp: cannot prove pre-deadline
        ("2026-09-17T10:00:00Z", 1, 3.0),  # older run
        ("2026-09-18T10:00:00Z", 1, 5.0),  # latest pre-deadline run
        ("2026-09-18T10:00:00Z", 2, 1.0),
        ("2026-09-18T10:00:00Z", 3, 2.0),
        ("2026-09-18T17:30:00Z", 1, 77.0),  # exactly at deadline: excluded
        ("2026-09-19T10:00:00Z", 1, 88.0),  # after
    ]
    return pd.DataFrame(
        [
            {"gameweek": 5, "model": "config_d", "element": e, "predicted_points": p, "generated_at": ts}
            for ts, e, p in rows
        ]
    )


def test_picks_latest_pre_deadline_run_only():
    forecasts = accuracy.pre_deadline_forecasts(_log(), 5, DEADLINE)
    chosen = forecasts["config_d"]
    assert sorted(chosen.element) == [1, 2, 3]
    assert chosen.set_index("element").predicted_points[1] == 5.0


def test_score_keeps_missing_as_none_and_ranks_by_spearman():
    forecast = accuracy.pre_deadline_forecasts(_log(), 5, DEADLINE)["config_d"]
    actuals = {1: {"total_points": 8, "minutes": 90}, 2: {"total_points": 0, "minutes": 0}}
    players = {1: {"web_name": "Haaland", "element_type": 4}}

    out = accuracy.score(forecast, actuals, players)
    by_id = {p["element"]: p for p in out["players"]}

    assert by_id[1] == {
        "element": 1,
        "name": "Haaland",
        "position": "FWD",
        "predicted": 5.0,
        "actual": 8,
        "minutes": 90,
    }
    assert by_id[3]["actual"] is None and by_id[3]["minutes"] is None
    assert out["count"] == 2
    assert out["mae"] == 2.0  # (|8-5| + |0-1|) / 2
    assert out["spearman"] == 1.0  # predicted 5 > 1 and actual 8 > 0 agree on order


def test_build_skips_finished_weeks_without_forecasts(tmp_path):
    log_path, out_path = tmp_path / "log.csv", tmp_path / "accuracy.json"
    _log().to_csv(log_path, index=False)

    bootstrap = {
        "elements": [],
        "events": [
            {"id": 4, "deadline_time": "2026-09-12T12:30:00Z", "finished": True, "data_checked": True},
            {"id": 5, "deadline_time": DEADLINE, "finished": True, "data_checked": False},
            {"id": 6, "deadline_time": "2026-10-10T10:00:00Z", "finished": False, "data_checked": False},
        ],
    }
    live = {1: {"total_points": 8, "minutes": 90}}

    with (
        patch("job.accuracy.get_bootstrap_data", return_value=bootstrap),
        patch("job.accuracy.fetch_actuals", return_value=live) as fetch,
    ):
        accuracy.build(log_path, out_path)

    fetch.assert_called_once_with(5)
    written = json.loads(out_path.read_text())
    assert written["gameweek"] == 5
    assert written["final"] is False
    assert written["models"]["config_d"]["count"] == 1


def test_build_writes_nothing_when_no_week_is_scorable(tmp_path):
    out_path = tmp_path / "accuracy.json"
    bootstrap = {"elements": [], "events": [{"id": 5, "deadline_time": DEADLINE, "finished": False}]}
    log_path = tmp_path / "log.csv"
    _log().to_csv(log_path, index=False)

    with patch("job.accuracy.get_bootstrap_data", return_value=bootstrap):
        assert accuracy.build(log_path, out_path) is None
    assert not out_path.exists()
