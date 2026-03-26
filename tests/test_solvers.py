import numpy as np
import pandas as pd
import pytest

from api.solvers import solve_best_squad, suggest_transfers


def _make_pool(n=100):
    """Build a pool with enough players across 20 teams for ILP feasibility."""
    positions = (["GK"] * 10 + ["DEF"] * 30 + ["MID"] * 40 + ["FWD"] * 20)[:n]
    teams = [f"T{(i % 20) + 1}" for i in range(n)]
    return pd.DataFrame({
        "element": range(1, n + 1),
        "web_name": [f"Player{i}" for i in range(1, n + 1)],
        "team_name": teams,
        "position": positions,
        "predicted_points": np.linspace(4.0, 1.0, n),
        "value": np.linspace(4.0, 8.0, n),
        "status": ["a"] * n,
        "chance_of_playing": [100.0] * n,
        "form": [3.0] * n,
    })


class TestSolveBestSquad:
    def test_picks_15_players(self):
        result = solve_best_squad(_make_pool())
        assert len(result["squad"]) == 15

    def test_position_limits(self):
        result = solve_best_squad(_make_pool())
        squad = pd.DataFrame(result["squad"])
        assert len(squad[squad.position == "GK"]) == 2
        assert len(squad[squad.position == "DEF"]) == 5
        assert len(squad[squad.position == "MID"]) == 5
        assert len(squad[squad.position == "FWD"]) == 3

    def test_budget_respected(self):
        result = solve_best_squad(_make_pool(), budget=100.0)
        assert result["total_value"] <= 100.0

    def test_max_3_per_team(self):
        result = solve_best_squad(_make_pool())
        squad = pd.DataFrame(result["squad"])
        for team, group in squad.groupby("team_name"):
            assert len(group) <= 3, f"Team {team} has {len(group)} players"

    def test_includes_best_xi(self):
        result = solve_best_squad(_make_pool())
        assert "best_xi" in result
        assert len(result["best_xi"]["starters"]) == 11

    def test_tight_budget_picks_cheaper(self):
        pool = _make_pool()
        loose = solve_best_squad(pool, budget=200.0)
        tight = solve_best_squad(pool, budget=90.0)
        assert tight["total_value"] <= loose["total_value"]


class TestSuggestTransfers:
    def _pick(self, pool, element_id):
        row = pool[pool.element == element_id].iloc[0]
        return {
            "element": int(row.element),
            "player_position": row.position,
            "value": float(row.value),
            "predicted_points": float(row.predicted_points),
            "team_name": row.team_name,
            "web_name": row.web_name,
        }

    def test_returns_suggestions(self):
        pool = _make_pool()
        weak = pool[pool.position == "MID"].iloc[-1]
        user_picks = [self._pick(pool, int(weak.element))]
        result = suggest_transfers(user_picks, pool, bank=20.0)
        assert len(result) >= 1
        assert result[0]["in"]["predicted_points"] > result[0]["out"]["predicted_points"]

    def test_position_matching(self):
        pool = _make_pool()
        weak_gk = pool[pool.position == "GK"].iloc[-1]
        user_picks = [self._pick(pool, int(weak_gk.element))]
        result = suggest_transfers(user_picks, pool, bank=20.0)
        for s in result:
            assert s["out"]["position"] == s["in"]["position"]

    def test_max_suggestions_limit(self):
        pool = _make_pool()
        weak = pool.nsmallest(10, "predicted_points")
        user_picks = [self._pick(pool, int(row.element)) for _, row in weak.iterrows()]
        result = suggest_transfers(user_picks, pool, bank=20.0, max_suggestions=2)
        assert len(result) <= 2
