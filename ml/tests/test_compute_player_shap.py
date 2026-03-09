"""Tests for compute_player_shap() in predict.py."""

import builtins
from unittest.mock import MagicMock, patch

import numpy as np
import pandas as pd

from ml.pipelines.inference.predict import (
    FEATURE_DISPLAY_NAMES,
    _get_lgbm_from_model,
    compute_player_shap,
)


class TestGetLgbmFromModel:
    def test_extracts_lgbm_from_stacked_ensemble(self):
        lgbm_mock = MagicMock()
        model = MagicMock()
        model.base_models = {"lgbm": (lgbm_mock, "lgbm"), "rf": (MagicMock(), "sklearn")}
        assert _get_lgbm_from_model(model) is lgbm_mock

    def test_falls_back_to_first_base_model(self):
        rf_mock = MagicMock()
        model = MagicMock()
        model.base_models = {"rf": (rf_mock, "sklearn")}
        assert _get_lgbm_from_model(model) is rf_mock

    def test_returns_plain_model(self):
        model = MagicMock(spec=[])  # no base_models attribute
        assert _get_lgbm_from_model(model) is model

    def test_empty_base_models_returns_model(self):
        model = MagicMock()
        model.base_models = {}
        assert _get_lgbm_from_model(model) is model


class TestComputePlayerShap:
    def _make_data(self, n_players=3, n_features=5):
        features = [f"feat_{i}" for i in range(n_features)]
        X = pd.DataFrame(
            np.random.rand(n_players, n_features),
            columns=features,
        )
        element_ids = list(range(100, 100 + n_players))
        return X, element_ids

    def _make_mock_shap(self, shap_values):
        """Create a mock shap module with TreeExplainer returning given values."""
        mock_shap = MagicMock()
        mock_shap.TreeExplainer.return_value.shap_values.return_value = shap_values
        return mock_shap

    def test_returns_top_n_features_per_player(self):
        X, eids = self._make_data(n_players=2, n_features=5)
        shap_values = np.array(
            [
                [0.1, -0.5, 0.3, 0.8, -0.2],
                [0.9, 0.1, -0.4, 0.2, 0.3],
            ]
        )
        mock_shap = self._make_mock_shap(shap_values)

        model = MagicMock(spec=[])
        with patch.dict("sys.modules", {"shap": mock_shap}):
            result = compute_player_shap(model, X, eids, top_n=3)

        assert len(result) == 2
        assert len(result[100]) == 3
        assert len(result[101]) == 3
        # Player 100: top 3 by abs should be feat_3 (0.8), feat_1 (-0.5), feat_2 (0.3)
        features_100 = [f["feature"] for f in result[100]]
        assert features_100[0] == "feat_3"
        assert features_100[1] == "feat_1"

    def test_impact_preserves_sign(self):
        X, eids = self._make_data(n_players=1, n_features=3)
        shap_values = np.array([[0.5, -0.8, 0.1]])
        mock_shap = self._make_mock_shap(shap_values)

        model = MagicMock(spec=[])
        with patch.dict("sys.modules", {"shap": mock_shap}):
            result = compute_player_shap(model, X, eids, top_n=3)

        impacts = [f["impact"] for f in result[100]]
        assert impacts[0] == -0.8  # negative preserved
        assert impacts[1] == 0.5  # positive preserved

    def test_includes_display_name(self):
        X = pd.DataFrame({"minutes_lag1": [90.0], "unknown_feat": [1.0]})
        shap_values = np.array([[0.5, 0.3]])
        mock_shap = self._make_mock_shap(shap_values)

        model = MagicMock(spec=[])
        with patch.dict("sys.modules", {"shap": mock_shap}):
            result = compute_player_shap(model, X, [100], top_n=2)

        displays = {f["feature"]: f["display"] for f in result[100]}
        assert displays["minutes_lag1"] == "Minutes (last GW)"
        assert displays["unknown_feat"] == "Unknown Feat"  # auto-generated

    def test_returns_empty_on_explainer_failure(self):
        X, eids = self._make_data()
        mock_shap = MagicMock()
        mock_shap.TreeExplainer.side_effect = Exception("explainer failed")

        model = MagicMock(spec=[])
        with patch.dict("sys.modules", {"shap": mock_shap}):
            result = compute_player_shap(model, X, eids)
        assert result == {}

    def test_returns_empty_when_shap_not_installed(self):
        X, eids = self._make_data()
        model = MagicMock(spec=[])
        real_import = builtins.__import__

        def _block_shap(name, *args, **kwargs):
            if name == "shap":
                raise ImportError("No module named 'shap'")
            return real_import(name, *args, **kwargs)

        with patch("builtins.__import__", side_effect=_block_shap):
            result = compute_player_shap(model, X, eids)
        assert result == {}

    def test_returns_empty_for_non_positive_top_n(self):
        X, eids = self._make_data()
        model = MagicMock(spec=[])
        assert compute_player_shap(model, X, eids, top_n=0) == {}
        assert compute_player_shap(model, X, eids, top_n=-1) == {}

    def test_handles_list_shap_values(self):
        """shap_values() returns a list for multi-class models."""
        X, eids = self._make_data(n_players=1, n_features=3)
        shap_list = [np.array([[0.5, -0.8, 0.1]])]  # list wrapping
        mock_shap = MagicMock()
        mock_shap.TreeExplainer.return_value.shap_values.return_value = shap_list

        model = MagicMock(spec=[])
        with patch.dict("sys.modules", {"shap": mock_shap}):
            result = compute_player_shap(model, X, eids, top_n=2)
        assert len(result[100]) == 2
        assert result[100][0]["impact"] == -0.8

    def test_handles_explanation_object(self):
        """shap_values() returns an Explanation object in newer SHAP versions."""
        X, eids = self._make_data(n_players=1, n_features=3)
        explanation = MagicMock()
        explanation.values = np.array([[0.3, -0.6, 0.9]])
        mock_shap = MagicMock()
        mock_shap.TreeExplainer.return_value.shap_values.return_value = explanation

        model = MagicMock(spec=[])
        with patch.dict("sys.modules", {"shap": mock_shap}):
            result = compute_player_shap(model, X, eids, top_n=2)
        assert len(result[100]) == 2
        assert result[100][0]["impact"] == 0.9

    def test_sorted_by_absolute_impact(self):
        X, eids = self._make_data(n_players=1, n_features=4)
        shap_values = np.array([[0.1, -0.9, 0.5, -0.3]])
        mock_shap = self._make_mock_shap(shap_values)

        model = MagicMock(spec=[])
        with patch.dict("sys.modules", {"shap": mock_shap}):
            result = compute_player_shap(model, X, eids, top_n=4)

        abs_impacts = [abs(f["impact"]) for f in result[100]]
        assert abs_impacts == sorted(abs_impacts, reverse=True)


class TestFeatureDisplayNames:
    def test_covers_key_features(self):
        key_features = ["minutes_lag1", "value", "form", "total_points_season_avg"]
        for f in key_features:
            assert f in FEATURE_DISPLAY_NAMES

    def test_all_values_are_strings(self):
        for k, v in FEATURE_DISPLAY_NAMES.items():
            assert isinstance(k, str)
            assert isinstance(v, str)
