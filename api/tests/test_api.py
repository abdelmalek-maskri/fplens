"""Tests for Fantasy Foresight API endpoints."""

from unittest.mock import MagicMock, patch

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
    with patch("api.main.joblib.load", return_value=mock_model):
        from api.main import app

        with TestClient(app) as c:
            yield c


def test_health(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "ok"
    assert data["model_loaded"] is True


def test_refresh_cache(client):
    r = client.post("/api/refresh")
    assert r.status_code == 200
    assert r.json()["status"] == "refreshed"


def test_predictions_returns_list(client):
    fake_df = pd.DataFrame(
        [
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
    )
    with patch("api.routers.predictions.run_predictions", return_value=fake_df):
        r = client.get("/api/predictions")
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    assert data[0]["web_name"] == "Salah"


def test_model_insights(client):
    r = client.get("/api/model-insights")
    assert r.status_code == 200
    data = r.json()
    assert "ablation" in data
    assert "shap_features" in data
    assert "model_variants" in data
