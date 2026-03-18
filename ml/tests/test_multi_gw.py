from unittest.mock import MagicMock, patch

import numpy as np
import pandas as pd

FIXTURES_DATA = {
    "teams": ["ARS", "BOU"],
    "team_full": {"ARS": "Arsenal", "BOU": "Bournemouth"},
    "fixtures": {
        "ARS": [
            {"gw": 31, "opponent": "BOU", "home": True, "atkFdr": 2, "defFdr": 3},
            {"gw": 32, "opponent": "MCI", "home": False, "atkFdr": 5, "defFdr": 4},
            {"gw": 33, "opponent": "LEE", "home": True, "atkFdr": 2, "defFdr": 2},
        ],
        "BOU": [
            {"gw": 31, "opponent": "ARS", "home": False, "atkFdr": 4, "defFdr": 4},
            {"gw": 32, "opponent": "LEE", "home": True, "atkFdr": 2, "defFdr": 2},
        ],
    },
    "current_gw": 31,
}


def _make_gw1_predictions(n=5):
    """Build a realistic gw1_predictions DataFrame, sorted by predicted_points desc."""
    elements = list(range(100, 100 + n))
    df = pd.DataFrame(
        {
            "element": elements,
            "web_name": [f"Player{i}" for i in range(n)],
            "team_name": ["Arsenal"] * n,
            "position": ["MID"] * n,
            "value": [7.0] * n,
            "predicted_points": np.linspace(4.0, 1.0, n),
            "uncertainty": [0.3] * n,
            "predicted_range_low": [1.0] * n,
            "predicted_range_high": [5.0] * n,
            "form": [3.0] * n,
            "status": ["a"] * n,
            "opponent_name": ["BOU"] * n,
            "chance_of_playing": [100.0] * n,
            "news": [""] * n,
        }
    )
    return df.sort_values("predicted_points", ascending=False).reset_index(drop=True)


def _make_feature_matrix(n=5):
    """Build a feature matrix in original API order (NOT sorted by predictions)."""
    elements = list(range(100, 100 + n))
    return pd.DataFrame(
        {
            "element": elements,
            "team_name": ["Arsenal"] * n,
            "minutes_lag1": np.random.rand(n) * 90,
            "value": [7.0] * n,
            "season": pd.Categorical(["2025-26"] * n),
            "position": pd.Categorical(["MID"] * n),
            "team": pd.Categorical([1] * n),
            "opponent_team": pd.Categorical([4.0] * n),
        }
    )


class TestAddFutureFixtureFeatures:
    @patch("ml.pipelines.inference.fetch_live_data.get_bootstrap_data")
    def test_adds_expected_columns(self, mock_bootstrap):
        mock_bootstrap.return_value = {
            "teams": [
                {"short_name": "ARS", "id": 1},
                {"short_name": "BOU", "id": 4},
                {"short_name": "MCI", "id": 11},
                {"short_name": "LEE", "id": 20},
            ]
        }
        from ml.pipelines.inference.multi_gw import _add_future_fixture_features

        df = pd.DataFrame({"team_name": ["Arsenal", "Bournemouth"]})
        result = _add_future_fixture_features(df, FIXTURES_DATA)

        for col in ["opponent_gw2", "was_home_gw2", "fdr_gw2", "opponent_gw3", "was_home_gw3", "fdr_gw3"]:
            assert col in result.columns, f"Missing column: {col}"

    @patch("ml.pipelines.inference.fetch_live_data.get_bootstrap_data")
    def test_uses_numeric_team_ids(self, mock_bootstrap):
        mock_bootstrap.return_value = {
            "teams": [
                {"short_name": "BOU", "id": 4},
                {"short_name": "MCI", "id": 11},
                {"short_name": "LEE", "id": 20},
            ]
        }
        from ml.pipelines.inference.multi_gw import _add_future_fixture_features

        df = pd.DataFrame({"team_name": ["Arsenal"]})
        result = _add_future_fixture_features(df, FIXTURES_DATA)
        # opponent_gw2 should be MCI's numeric ID (11), not "MCI"
        assert result["opponent_gw2"].iloc[0] == 11

    @patch("ml.pipelines.inference.fetch_live_data.get_bootstrap_data")
    def test_missing_fixtures_fills_defaults(self, mock_bootstrap):
        mock_bootstrap.return_value = {"teams": []}
        from ml.pipelines.inference.multi_gw import _add_future_fixture_features

        df = pd.DataFrame({"team_name": ["Unknown FC"]})
        result = _add_future_fixture_features(df, FIXTURES_DATA)
        assert result["opponent_gw2"].iloc[0] == 0
        assert result["fdr_gw2"].iloc[0] == 3


class TestPredictMultiGw:
    def test_horizon_capped_at_3(self):
        from ml.pipelines.inference.multi_gw import predict_multi_gw

        gw1 = _make_gw1_predictions(3)
        fm = _make_feature_matrix(3)

        mock_model = MagicMock()
        mock_model.feature_names_ = list(fm.columns)
        mock_model.predict.return_value = np.array([2.0, 1.5, 1.0])
        mock_model.get_cat_feature_indices = MagicMock(return_value=[])

        horizon_models = {2: mock_model, 3: mock_model}

        result = predict_multi_gw(gw1, fm, horizon_models, FIXTURES_DATA, horizon=10)
        # Each player should have at most 3 predicted values (capped)
        for player in result:
            assert len(player["predicted"]) <= 3

    def test_element_alignment(self):
        """GW+2/3 predictions must map to the correct player regardless of sort order."""
        from ml.pipelines.inference.multi_gw import predict_multi_gw

        gw1 = _make_gw1_predictions(3)
        fm = _make_feature_matrix(3)

        # Model returns predictions in feature_matrix order (100, 101, 102)
        # but gw1 is sorted by predicted_points (could be 102, 101, 100)
        mock_model = MagicMock()
        mock_model.feature_names_ = list(fm.columns)
        # Return distinct values so we can check alignment
        mock_model.predict.return_value = np.array([10.0, 20.0, 30.0])
        mock_model.get_cat_feature_indices = MagicMock(return_value=[])

        horizon_models = {2: mock_model, 3: mock_model}

        result = predict_multi_gw(gw1, fm, horizon_models, FIXTURES_DATA, horizon=2)
        # Element 100 (first in fm) should get prediction 10.0 at GW+2
        player_100 = next(p for p in result if p["element"] == 100)
        assert player_100["predicted"][1] == 10.0  # index 1 = GW+2

        player_102 = next(p for p in result if p["element"] == 102)
        assert player_102["predicted"][1] == 30.0
