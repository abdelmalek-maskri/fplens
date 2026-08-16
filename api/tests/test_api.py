"""Tests for FPLens API endpoints."""

from unittest.mock import MagicMock, patch

import numpy as np
import pandas as pd
import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def mock_model():
    model = MagicMock()
    model.predict.return_value = ([3.5, 2.1], None)
    model.base_models = {"lgb1": (MagicMock(feature_name_=["f1", "f2"]), "regressor")}
    model.base_names = ["lgb1"]
    return model


@pytest.fixture
def client(mock_model):
    with patch("api.main.MODEL_PATH") as mock_path, patch("api.main.joblib.load", return_value=mock_model):
        mock_path.exists.return_value = True
        from api.main import app

        with TestClient(app) as c:
            yield c


def test_health(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "ok"
    assert data["model_loaded"] is True


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
    assert r.json()["status"] == "refreshed"


def _make_inference_result(players=None):
    """Build a fake inference result dict matching run()'s return shape."""
    if players is None:
        players = [
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
                "rank": 1,
            }
        ]
    df = pd.DataFrame(players)
    X = pd.DataFrame(
        np.random.rand(len(players), 3),
        columns=["feat_a", "feat_b", "feat_c"],
    )
    return {
        "predictions": df,
        "feature_matrix": X,
        "element_ids": [p["element"] for p in players],
    }


def test_predictions_returns_list(client):
    fake_result = _make_inference_result()
    with patch("api.routers.predictions.get_predictions_df", return_value=fake_result["predictions"]):
        r = client.get("/api/predictions")
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    assert data[0]["web_name"] == "Salah"


_PREDICT_MOD = "ml.pipelines.inference.predict"
_FETCH_MOD = "ml.pipelines.inference.fetch_live_data"
_TEAM_INFERENCE = "api.routers.team.get_inference_result"


def test_live_data_fetched_once_across_routers(client):
    """Regression: team and prediction routes must share one cached live fetch.

    Previously team.py called predict.run() directly, which re-fetched live data
    behind the shared cache's back and wrote the same key with a shorter TTL.
    """
    fake_result = _make_inference_result()
    live_df = fake_result["predictions"].assign(chance_this_round=100, news="")

    with (
        patch(f"{_FETCH_MOD}.fetch_current_gw_data", return_value=live_df) as mock_fetch,
        patch(f"{_PREDICT_MOD}.fetch_current_gw_data", return_value=live_df),
        patch("api.inference.get_model_features", return_value=["feat_a", "feat_b", "feat_c"]),
        patch("api.inference.prepare_features", return_value=fake_result["feature_matrix"]),
        patch("api.inference.predict", return_value=fake_result["predictions"]),
        patch(f"{_FETCH_MOD}.fetch_player_history", return_value=[]),
        patch(f"{_FETCH_MOD}.fetch_fixtures", return_value={"teams": [], "fixtures": {}, "current_gw": 29}),
        patch(f"{_PREDICT_MOD}.compute_player_shap", create=True, return_value={}),
    ):
        assert client.get("/api/player/1").status_code == 200

        # The team route must populate the SHARED live_data key rather than
        # fetching privately — otherwise later requests refetch needlessly.
        assert "live_data" in client.get("/api/health").json()["cache_keys"]

        assert client.get("/api/predictions").status_code == 200

    assert mock_fetch.call_count == 1


class TestPlayerDetail:
    def test_returns_full_profile(self, client):
        fake_result = _make_inference_result()
        fake_history = [
            {
                "round": i,
                "total_points": i * 2,
                "minutes": 90,
                "expected_goals": "0.5",
                "expected_assists": "0.3",
                "bonus": 1,
            }
            for i in range(1, 11)
        ]
        fake_fixtures = {
            "teams": ["LIV"],
            "fixtures": {"LIV": [{"gw": 30, "opponent": "WHU", "home": True, "atkFdr": 2, "defFdr": 3}]},
            "current_gw": 29,
        }
        with (
            patch(_TEAM_INFERENCE, return_value=fake_result),
            patch(f"{_FETCH_MOD}.fetch_player_history", return_value=fake_history),
            patch(f"{_FETCH_MOD}.fetch_fixtures", return_value=fake_fixtures),
            patch(
                f"{_PREDICT_MOD}.compute_player_shap",
                create=True,
                return_value={1: [{"feature": "f", "display": "F", "value": 1.0, "impact": 0.5}]},
            ),
        ):
            r = client.get("/api/player/1")
        assert r.status_code == 200
        data = r.json()
        assert data["element"] == 1
        assert data["web_name"] == "Salah"
        assert len(data["pts_history"]) == 10
        assert len(data["pts_last5"]) == 5
        assert len(data["fixtures"]) == 1
        assert len(data["shap"]) == 1

    def test_404_for_unknown_player(self, client):
        fake_result = _make_inference_result()
        with patch(_TEAM_INFERENCE, return_value=fake_result):
            r = client.get("/api/player/99999")
        assert r.status_code == 404

    def test_empty_history_when_fetch_fails(self, client):
        fake_result = _make_inference_result()
        fake_fixtures = {"teams": [], "fixtures": {}, "current_gw": 29}
        with (
            patch(_TEAM_INFERENCE, return_value=fake_result),
            patch(f"{_FETCH_MOD}.fetch_player_history", return_value=None),
            patch(f"{_FETCH_MOD}.fetch_fixtures", return_value=fake_fixtures),
            patch(f"{_PREDICT_MOD}.compute_player_shap", create=True, return_value={}),
        ):
            r = client.get("/api/player/1")
        assert r.status_code == 200
        data = r.json()
        assert data["pts_history"] == []
        assert data["fixtures"] == []
        assert data["shap"] == []


def test_model_insights(client):
    r = client.get("/api/model-insights")
    assert r.status_code == 200
    data = r.json()
    assert "ablation" in data
    assert "shap_features" in data
    assert "model_variants" in data
