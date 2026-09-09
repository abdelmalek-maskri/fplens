"""The response models must keep describing what the code actually returns.

These validate real solver output rather than hand-written dicts, so the tests
fail if OUTPUT_COLS gains a column the schema does not declare. A response_model
silently drops undeclared fields, which would break the frontend without any
error, so the drift guard below matters more than the round-trip cases.
"""

import numpy as np
import pandas as pd
import pytest
from pydantic import ValidationError

from api.schemas import BestSquad, Player, Team, TransferSuggestion
from api.solvers import OUTPUT_COLS, solve_best_squad, suggest_transfers


def _make_pool(n=100):
    positions = (["GK"] * 10 + ["DEF"] * 30 + ["MID"] * 40 + ["FWD"] * 20)[:n]
    return pd.DataFrame(
        {
            "element": range(1, n + 1),
            "web_name": [f"Player{i}" for i in range(1, n + 1)],
            "team_name": [f"T{(i % 20) + 1}" for i in range(n)],
            "position": positions,
            "predicted_points": np.linspace(4.0, 1.0, n),
            "value": np.linspace(4.0, 8.0, n),
            "status": ["a"] * n,
            "chance_of_playing": [100.0] * n,
            "form": [3.0] * n,
            "opponent_name": ["OPP"] * n,
            "uncertainty": [0.5] * n,
            "predicted_range_low": np.linspace(3.0, 0.5, n),
            "predicted_range_high": np.linspace(5.0, 1.5, n),
        }
    )


def test_player_declares_every_solver_output_column():
    """The drift guard. Any new OUTPUT_COLS entry must be added to Player."""
    missing = set(OUTPUT_COLS) - set(Player.model_fields)
    assert not missing, f"Player is missing solver columns: {sorted(missing)}"


def test_best_squad_output_validates():
    BestSquad.model_validate(solve_best_squad(_make_pool()))


def test_best_squad_keeps_all_15_through_the_model():
    validated = BestSquad.model_validate(solve_best_squad(_make_pool()))
    assert len(validated.squad) == 15
    assert len(validated.best_xi.starters) == 11
    assert len(validated.best_xi.bench) == 4


def test_transfer_suggestions_validate_and_keep_the_in_alias():
    pool = _make_pool()
    picks = [
        {
            "element": int(r.element),
            "web_name": r.web_name,
            "player_position": r.position,
            "team_name": r.team_name,
            "value": float(r.value),
            "predicted_points": float(r.predicted_points),
        }
        for r in pool.tail(15).itertuples()
    ]

    suggestions = suggest_transfers(user_picks=picks, all_predictions=pool, bank=5.0)
    assert suggestions, "fixture should produce at least one upgrade"

    for s in suggestions:
        model = TransferSuggestion.model_validate(s)
        # `in` is a keyword internally but must serialise back under its alias.
        assert "in" in model.model_dump(by_alias=True)


def test_team_accepts_a_squad_with_no_predictions():
    """team.py returns picks unenriched when the prediction frame fails to load."""
    team = Team.model_validate(
        {
            "fpl_id": 12345,
            "manager": "A Manager",
            "team_name": "A Team",
            "overall_rank": None,
            "overall_points": None,
            "bank": 1.5,
            "total_value": 99.5,
            "gameweek": 12,
            "picks_gameweek": 11,
            "active_chip": None,
            "picks": [
                {
                    "element": 1,
                    "position": 1,
                    "multiplier": 1,
                    "is_captain": False,
                    "is_vice_captain": False,
                }
            ],
        }
    )
    assert team.transfer_suggestions == []
    assert team.picks[0].player_position == ""


def test_team_rejects_a_pick_missing_its_identity():
    with pytest.raises(ValidationError):
        Team.model_validate(
            {
                "fpl_id": 1,
                "manager": "M",
                "team_name": "T",
                "gameweek": 1,
                "picks_gameweek": 1,
                "picks": [{"position": 1, "multiplier": 1}],
            }
        )
