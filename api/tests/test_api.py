"""Tests for the two endpoints that still need a server."""

import json
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from api.main import app

PLAYERS = [
    {
        "element": 1,
        "web_name": "Salah",
        "position": "MID",
        "team_name": "LIV",
        "value": 13.0,
        "predicted_points": 6.5,
        "status": "a",
        "chance_of_playing": 100,
        "form": 8.0,
        "opponent_name": "ARS",
        "uncertainty": 0.5,
        "predicted_range_low": 5.7,
        "predicted_range_high": 7.3,
    }
]


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture
def snapshot(tmp_path):
    """A snapshot directory on disk, since that is now the API's data source."""
    (tmp_path / "manifest.json").write_text(json.dumps({"gameweek": 4, "default_model": "config_d"}))
    (tmp_path / "predictions_config_d.json").write_text(json.dumps(PLAYERS))
    with patch("api.snapshot.SNAPSHOT_DIR", tmp_path):
        yield tmp_path


def test_health(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_refresh_disabled_when_secret_unset(client):
    """No REFRESH_SECRET means the endpoint is off, not open with a default."""
    with patch("api.main.REFRESH_SECRET", ""):
        r = client.post("/api/refresh", headers={"X-Refresh-Secret": "anything"})
    assert r.status_code == 503


def test_refresh_rejects_wrong_secret(client):
    with patch("api.main.REFRESH_SECRET", "s3cret"):
        assert client.post("/api/refresh").status_code == 403
        assert client.post("/api/refresh", headers={"X-Refresh-Secret": "wrong"}).status_code == 403


def test_refresh_accepts_correct_secret(client):
    with patch("api.main.REFRESH_SECRET", "s3cret"):
        r = client.post("/api/refresh", headers={"X-Refresh-Secret": "s3cret"})
    assert r.status_code == 200


def test_api_serves_only_the_endpoints_that_need_a_server(client):
    """Everything else moved to the snapshot. If a read endpoint reappears here,
    something has been added back that should be a file."""
    paths = {r.path for r in app.routes if hasattr(r, "methods") and r.path.startswith("/api")}
    assert paths == {"/api/best-squad", "/api/team/{fpl_id}", "/api/health", "/api/refresh"}


def test_api_loads_no_model(client):
    """The whole point of the rebuild: no joblib in this process."""
    assert not hasattr(app.state, "models")
    assert not hasattr(app.state, "horizon_models")


class TestBestSquad:
    def test_reads_predictions_from_the_snapshot(self, client, snapshot):
        empty_xi = {
            "formation": "4-4-2",
            "total_points": 0.0,
            "total_with_captain": 0.0,
            "captain_id": 1,
            "vice_id": 1,
            "starters": [],
            "bench": [],
        }
        result = {
            "squad": [],
            "total_value": 0.0,
            "total_points": 0.0,
            "budget_remaining": 85.0,
            "best_xi": empty_xi,
        }
        with patch("api.routers.squad.solve_best_squad", return_value=result) as solve:
            r = client.get("/api/best-squad?budget=85")
        assert r.status_code == 200
        df = solve.call_args.args[0]
        assert list(df["web_name"]) == ["Salah"], "the solver is fed the snapshot, not a model"
        assert solve.call_args.kwargs["budget"] == 85.0

    def test_503_when_no_snapshot_has_been_built(self, client, tmp_path):
        with patch("api.snapshot.SNAPSHOT_DIR", tmp_path / "missing"):
            r = client.get("/api/best-squad")
        assert r.status_code == 503
        assert "make snapshot" in r.json()["detail"]

    def test_rejects_a_budget_outside_the_allowed_range(self, client):
        assert client.get("/api/best-squad?budget=10").status_code == 422


class TestTeam:
    def _fpl_response(self):
        return {
            "fpl_id": 123,
            "manager": "A Manager",
            "team_name": "A Team",
            "overall_rank": 1000,
            "overall_points": 500,
            "bank": 1.5,
            "total_value": 99.5,
            "gameweek": 4,
            "picks_gameweek": 3,
            "active_chip": None,
            "picks": [{"element": 1, "position": 1, "multiplier": 1, "is_captain": True, "is_vice_captain": False}],
        }

    def test_enriches_picks_from_the_snapshot(self, client, snapshot):
        with patch("api.routers.team.fetch_user_team", return_value=self._fpl_response()):
            r = client.get("/api/team/123")
        assert r.status_code == 200
        pick = r.json()["picks"][0]
        assert pick["web_name"] == "Salah"
        assert pick["player_position"] == "MID"
        assert pick["predicted_points"] == 6.5

    def test_still_returns_the_squad_when_predictions_are_missing(self, client, tmp_path):
        """A manager should still see their team if the snapshot is absent."""
        with (
            patch("api.snapshot.SNAPSHOT_DIR", tmp_path / "missing"),
            patch("api.routers.team.fetch_user_team", return_value=self._fpl_response()),
        ):
            r = client.get("/api/team/123")
        assert r.status_code == 200
        assert r.json()["picks"][0]["web_name"] == ""
        assert r.json()["transfer_suggestions"] == []

    def test_404_for_an_unknown_fpl_id(self, client, snapshot):
        with patch("api.routers.team.fetch_user_team", side_effect=Exception("404 Not Found")):
            r = client.get("/api/team/123")
        assert r.status_code == 404

    def test_502_when_fpl_is_unreachable(self, client, snapshot):
        with patch("api.routers.team.fetch_user_team", side_effect=RuntimeError("boom")):
            r = client.get("/api/team/123")
        assert r.status_code == 502

    def test_rejects_an_out_of_range_fpl_id(self, client):
        assert client.get("/api/team/99999999").status_code == 422
