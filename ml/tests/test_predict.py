from types import SimpleNamespace
from unittest.mock import MagicMock

import numpy as np
import pandas as pd
import pytest

from ml.pipelines.inference.predict import (
    align_features,
    get_model_features,
    prepare_features,
)


class TestGetModelFeatures:
    def test_lightgbm(self):
        model = SimpleNamespace(feature_name_=["a", "b", "c"])
        assert get_model_features(model) == ["a", "b", "c"]

    def test_catboost(self):
        model = SimpleNamespace(feature_names_=["x", "y"])
        assert get_model_features(model) == ["x", "y"]

    def test_sklearn(self):
        model = SimpleNamespace(feature_names_in_=np.array(["f1", "f2"]))
        assert get_model_features(model) == ["f1", "f2"]

    def test_stacked_ensemble(self):
        lgbm = SimpleNamespace(feature_name_=["a", "b"])
        model = SimpleNamespace(
            base_models={"lgbm": (lgbm, "regressor")},
            base_names=["lgbm"],
        )
        assert get_model_features(model) == ["a", "b"]

    def test_unknown_model_raises(self):
        model = SimpleNamespace()
        with pytest.raises(ValueError, match="Cannot extract feature names"):
            get_model_features(model)


class TestAlignFeatures:
    def test_adds_missing_fills_zero(self):
        df = pd.DataFrame({"a": [1], "b": [2]})
        result = align_features(df, ["a", "b", "c"])
        assert list(result.columns) == ["a", "b", "c"]
        assert result["c"].iloc[0] == 0

    def test_drops_extra_columns(self):
        df = pd.DataFrame({"a": [1], "b": [2], "extra": [99]})
        result = align_features(df, ["a", "b"])
        assert list(result.columns) == ["a", "b"]

    def test_reorders_to_expected(self):
        df = pd.DataFrame({"b": [2], "a": [1]})
        result = align_features(df, ["a", "b"])
        assert list(result.columns) == ["a", "b"]

    def test_no_mutation_of_input(self):
        df = pd.DataFrame({"a": [1]})
        align_features(df, ["a", "b"])
        assert list(df.columns) == ["a"]


class TestPrepareFeatures:
    def test_converts_cat_cols(self):
        df = pd.DataFrame(
            {
                "season": ["2025-26"],
                "position": ["MID"],
                "team": [5],
                "opponent_team": [10.0],
                "numeric_feat": [1.5],
            }
        )
        result = prepare_features(df, ["season", "position", "team", "opponent_team", "numeric_feat"])
        assert result["season"].dtype.name == "category"
        assert result["position"].dtype.name == "category"

    def test_fills_numeric_nan(self):
        df = pd.DataFrame(
            {
                "a": [1.0, np.nan],
                "b": [np.nan, 3.0],
            }
        )
        result = prepare_features(df, ["a", "b"])
        assert result["a"].isna().sum() == 0
        assert result["b"].isna().sum() == 0
