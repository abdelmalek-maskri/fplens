"""Squad optimisation. Needs a server because the answer depends on a budget
the caller picks, so there is nothing to precompute."""

from fastapi import APIRouter, Query

from api.schemas import BestSquad
from api.snapshot import load_predictions
from api.solvers import solve_best_squad

router = APIRouter(tags=["Squad"])


@router.get("/best-squad", response_model=BestSquad)
def get_best_squad(budget: float = Query(default=100.0, ge=50.0, le=120.0)):
    """ILP-optimised 15-man squad within budget constraints."""
    return solve_best_squad(load_predictions(), budget=budget)
