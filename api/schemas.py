"""Response models for the one endpoint that needs a server at request time.

`/team/{fpl_id}` is the only route validated against these. BestXI and
BestSquad describe what job.solvers emits into best_squad.json, so the tests
can check that shape without the API serving it: everything identical for
every caller is a precomputed file, not an endpoint.

Player fields are optional with defaults because solvers._existing_cols filters
OUTPUT_COLS down to whatever the prediction frame actually has, so a model
missing a column simply omits it rather than failing.
"""

from pydantic import BaseModel, ConfigDict, Field


class Player(BaseModel):
    """A player as the solvers emit them, per solvers.OUTPUT_COLS."""

    element: int
    web_name: str = ""
    position: str = ""
    team_name: str = ""
    value: float = 0
    predicted_points: float = 0
    form: float = 0
    status: str = "a"
    chance_of_playing: float | None = 100
    opponent_name: str = ""


class BestXI(BaseModel):
    """The eleven to start, plus the formation they make up."""

    formation: str
    total_points: float
    total_with_captain: float
    captain_id: int
    vice_id: int
    starters: list[Player]
    bench: list[Player]


class BestSquad(BaseModel):
    """Fifteen players inside the budget, with the XI picked from them."""

    squad: list[Player]
    total_value: float
    total_points: float
    budget_remaining: float
    best_xi: BestXI


class TransferOut(BaseModel):
    """The outgoing side of a suggestion: a subset of Player, built from the
    user's pick rather than from the prediction frame."""

    element: int
    web_name: str = ""
    position: str = ""
    team_name: str = ""
    value: float = 0
    predicted_points: float = 0


class TransferSuggestion(BaseModel):
    """One swap: who leaves, who arrives, and what it is predicted to gain."""

    # `in` is a keyword, so the field is in_ and serialises under its alias.
    model_config = ConfigDict(populate_by_name=True)

    out: TransferOut
    in_: Player = Field(alias="in")
    points_gain: float
    cost_saving: float


class Pick(BaseModel):
    """One of the 15 squad slots.

    `position` is the squad slot (1-15, where 1-11 start) as returned by the FPL API. The playing position ("GK"/"DEF"/...) is `player_position`, added during enrichment. The two names are easy to confuse and the frontend reads both.
    """

    element: int
    position: int
    multiplier: int
    is_captain: bool
    is_vice_captain: bool

    # Added by team.py when predictions are available.
    web_name: str = ""
    player_position: str = ""
    team_name: str = ""
    predicted_points: float = 0
    form: float = 0
    status: str = "a"
    chance_of_playing: float | None = 100
    opponent_name: str = ""
    value: float = 0


class Team(BaseModel):
    """A manager's squad, enriched with predictions when they are available.

    There is deliberately no `free_transfers` field. The frontend reads one and falls back to 1, but no upstream call in this codebase ever supplies it, so the interface always shows 1 regardless of the truth.
    """

    fpl_id: int
    manager: str
    team_name: str
    overall_rank: int | None = None
    overall_points: int | None = None
    bank: float = 0
    total_value: float = 0
    gameweek: int
    picks_gameweek: int
    active_chip: str | None = None
    picks: list[Pick]

    # Only populated when the prediction frame loaded; empty otherwise.
    transfer_suggestions: list[TransferSuggestion] = []
