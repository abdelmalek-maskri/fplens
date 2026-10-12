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
SEASON = "2026-27"


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
            {
                "season": SEASON,
                "gameweek": 5,
                "model": "config_d",
                "element": e,
                "predicted_points": p,
                "generated_at": ts,
            }
            for ts, e, p in rows
        ]
    )


def test_picks_latest_pre_deadline_run_only():
    forecasts = accuracy.pre_deadline_forecasts(_log(), SEASON, 5, DEADLINE)
    chosen = forecasts["config_d"]
    assert sorted(chosen.element) == [1, 2, 3]
    assert chosen.set_index("element").predicted_points[1] == 5.0


def test_score_keeps_missing_as_none_and_ranks_by_spearman():
    forecast = accuracy.pre_deadline_forecasts(_log(), SEASON, 5, DEADLINE)["config_d"]
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


def _xi_log():
    rows = [(1, "captain"), (2, "vice"), (3, "starter")]
    return pd.DataFrame(
        [
            {"season": SEASON, "gameweek": 5, "generated_at": "2026-09-18T10:00:00Z", "element": e, "role": r}
            for e, r in rows
        ]
    )


def test_xi_doubles_the_captain():
    actuals = {
        1: {"total_points": 8, "minutes": 90},
        2: {"total_points": 3, "minutes": 90},
        3: {"total_points": 1, "minutes": 5},
    }
    out = accuracy.score_xi(_xi_log(), actuals, {}, {"average_entry_score": 48, "highest_score": 126})
    assert out["points"] == 8 * 2 + 3 + 1
    assert out["average_manager"] == 48
    assert [p["captain"] for p in out["players"]] == [True, False, False]


def test_xi_armband_passes_to_vice_when_captain_does_not_play():
    actuals = {
        1: {"total_points": 0, "minutes": 0},
        2: {"total_points": 3, "minutes": 90},
        3: {"total_points": 1, "minutes": 5},
    }
    out = accuracy.score_xi(_xi_log(), actuals, {}, {})
    assert out["points"] == 0 + 3 * 2 + 1
    assert {p["element"]: p["captain"] for p in out["players"]} == {1: False, 2: True, 3: False}


def test_xi_nobody_doubled_when_neither_plays():
    actuals = {
        1: {"total_points": 0, "minutes": 0},
        2: {"total_points": 0, "minutes": 0},
        3: {"total_points": 5, "minutes": 90},
    }
    out = accuracy.score_xi(_xi_log(), actuals, {}, {})
    assert out["points"] == 5
    assert not any(p["captain"] for p in out["players"])


def test_xi_missing_player_counts_zero_but_stays_null():
    actuals = {1: {"total_points": 4, "minutes": 90}}
    out = accuracy.score_xi(_xi_log(), actuals, {}, {})
    assert out["points"] == 8
    assert {p["element"]: p["actual"] for p in out["players"]} == {1: 4, 2: None, 3: None}


def test_pre_deadline_xi_is_empty_without_a_timely_run():
    late = _xi_log().assign(generated_at="2026-09-19T10:00:00Z")
    assert accuracy.pre_deadline_xi(late, SEASON, 5, DEADLINE, "config_d") == {}
    assert accuracy.pre_deadline_xi(_xi_log(), SEASON, 5, DEADLINE, "config_d") != {}


def test_rows_logged_before_the_model_column_count_as_the_default():
    """The XI log gained a model column after it had already been running."""
    legacy = _xi_log()
    assert "model" not in legacy.columns

    out = accuracy.pre_deadline_xi(legacy, SEASON, 5, DEADLINE, "config_d")
    assert list(out) == ["config_d"]


def test_each_model_gets_its_own_xi():
    mine = _xi_log().assign(model="config_d")
    theirs = _xi_log().assign(model="baseline", element=[7, 8, 9])
    out = accuracy.pre_deadline_xi(pd.concat([mine, theirs]), SEASON, 5, DEADLINE, "config_d")

    assert sorted(out) == ["baseline", "config_d"]
    assert sorted(out["baseline"].element) == [7, 8, 9]


def test_build_skips_finished_weeks_without_forecasts(tmp_path):
    log_path, out_path = tmp_path / "log.csv", tmp_path / "accuracy.json"
    _log().to_csv(log_path, index=False)

    bootstrap = {
        "elements": [],
        "events": [
            {"id": 1, "deadline_time": "2026-08-14T17:30:00Z", "finished": True, "data_checked": True},
            {"id": 5, "deadline_time": DEADLINE, "finished": True, "data_checked": False},
            {"id": 6, "deadline_time": "2026-10-10T10:00:00Z", "finished": False, "data_checked": False},
        ],
    }
    live = {1: {"total_points": 8, "minutes": 90}}

    with (
        patch("job.accuracy.get_bootstrap_data", return_value=bootstrap),
        patch("job.accuracy.fetch_actuals", return_value=live) as fetch,
    ):
        accuracy.build(log_path, tmp_path / "no_xi.csv", out_path)

    fetch.assert_called_once_with(5)
    written = json.loads(out_path.read_text())
    assert written["gameweek"] == 5
    assert written["final"] is False
    assert written["models"]["config_d"]["count"] == 1
    assert written["xi"] is None  # no XI log yet is a valid state


def test_build_writes_nothing_when_no_week_is_scorable(tmp_path):
    out_path = tmp_path / "accuracy.json"
    bootstrap = {"elements": [], "events": [{"id": 5, "deadline_time": DEADLINE, "finished": False}]}
    log_path = tmp_path / "log.csv"
    _log().to_csv(log_path, index=False)

    with patch("job.accuracy.get_bootstrap_data", return_value=bootstrap):
        assert accuracy.build(log_path, tmp_path / "no_xi.csv", out_path) is None
    assert not out_path.exists()


def test_last_seasons_gameweek_five_is_not_scored_as_this_one():
    """Gameweek numbers repeat, so the season has to be part of the filter."""
    old = _log().assign(season="2025-26", predicted_points=99.0)
    forecasts = accuracy.pre_deadline_forecasts(pd.concat([old, _log()]), SEASON, 5, DEADLINE)
    assert (forecasts["config_d"].predicted_points != 99.0).all()

    old_xi = _xi_log().assign(season="2025-26")
    assert accuracy.pre_deadline_xi(old_xi, SEASON, 5, DEADLINE, "config_d") == {}


def _result(gw, final=True, spearman=0.7, points=40):
    return {
        "season": SEASON,
        "gameweek": gw,
        "deadline": DEADLINE,
        "final": final,
        "models": {"config_d": {"spearman": spearman, "mae": 1.2, "count": 600, "players": [1, 2]}},
        "xi": {"points": points, "average_manager": 48, "highest": 126, "players": [1, 2]},
    }


def test_history_keeps_one_entry_per_gameweek(tmp_path):
    """The job runs daily, so the same gameweek is scored again and again."""
    path = tmp_path / "history.json"
    accuracy.update_history(_result(5), path)
    accuracy.update_history(_result(5), path)
    out = accuracy.update_history(_result(6), path)

    assert [w["gameweek"] for w in out["gameweeks"]] == [5, 6]


def test_a_provisional_score_is_replaced_by_the_final_one(tmp_path):
    """Bonus points move until FPL signs off, so a later run must win."""
    path = tmp_path / "history.json"
    accuracy.update_history(_result(5, final=False, points=40), path)
    out = accuracy.update_history(_result(5, final=True, points=43), path)

    assert len(out["gameweeks"]) == 1
    assert out["gameweeks"][0]["final"] is True
    assert out["gameweeks"][0]["xi"]["points"] == 43


def test_a_new_season_starts_a_fresh_record(tmp_path):
    """Gameweek numbers repeat every year."""
    path = tmp_path / "history.json"
    accuracy.update_history(_result(5), path)

    next_year = _result(5) | {"season": "2027-28"}
    out = accuracy.update_history(next_year, path)

    assert out["season"] == "2027-28"
    assert len(out["gameweeks"]) == 1


def test_history_drops_the_per_player_detail(tmp_path):
    """595 KB a gameweek is the full file; the record has to stay small."""
    path = tmp_path / "history.json"
    out = accuracy.update_history(_result(5), path)
    week = out["gameweeks"][0]

    assert "players" not in week["models"]["config_d"]
    assert "players" not in week["xi"]
    assert path.stat().st_size < 1024
