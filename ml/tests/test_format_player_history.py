"""Tests for format_player_history() in fetch_live_data."""

from ml.pipelines.inference.fetch_live_data import format_player_history


def _make_gw(round_num, pts=2, mins=90, xg="0.5", xa="0.1", bonus=1):
    return {
        "round": round_num,
        "total_points": pts,
        "minutes": mins,
        "expected_goals": xg,
        "expected_assists": xa,
        "bonus": bonus,
    }


class TestFormatPlayerHistory:
    def test_none_history_returns_empty(self):
        result = format_player_history(999, None)
        assert result["element"] == 999
        assert result["pts_history"] == []
        assert result["pts_last5"] == []
        assert result["gw_labels"] == []
        assert result["minutes_history"] == []
        assert result["xg_history"] == []
        assert result["xa_history"] == []
        assert result["bonus_history"] == []

    def test_empty_list_returns_empty(self):
        result = format_player_history(100, [])
        assert result["pts_history"] == []

    def test_short_history_under_5_gws(self):
        raw = [_make_gw(28, pts=5), _make_gw(29, pts=8)]
        result = format_player_history(100, raw)
        assert result["pts_history"] == [5, 8]
        assert result["pts_last5"] == [5, 8]  # < 5, returns all
        assert result["gw_labels"] == ["GW28", "GW29"]
        assert len(result["minutes_history"]) == 2

    def test_exactly_5_gws(self):
        raw = [_make_gw(i, pts=i) for i in range(25, 30)]
        result = format_player_history(200, raw)
        assert result["pts_last5"] == [25, 26, 27, 28, 29]
        assert result["pts_history"] == [25, 26, 27, 28, 29]

    def test_more_than_10_gws_takes_last_10(self):
        raw = [_make_gw(i, pts=i) for i in range(1, 16)]  # 15 GWs
        result = format_player_history(300, raw)
        assert len(result["pts_history"]) == 10
        assert result["pts_history"] == list(range(6, 16))
        assert result["pts_last5"] == list(range(11, 16))
        assert result["gw_labels"] == [f"GW{i}" for i in range(6, 16)]

    def test_xg_xa_converted_to_float(self):
        raw = [_make_gw(1, xg="1.23", xa="0.45")]
        result = format_player_history(400, raw)
        assert result["xg_history"] == [1.23]
        assert result["xa_history"] == [0.45]

    def test_missing_fields_default_to_zero(self):
        raw = [{"round": 1}]  # minimal dict, missing most fields
        result = format_player_history(500, raw)
        assert result["pts_history"] == [0]
        assert result["minutes_history"] == [0]
        assert result["xg_history"] == [0.0]
        assert result["bonus_history"] == [0]
