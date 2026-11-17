"""Solvers for FPL squad selection: best XI, best squad, transfer suggestions."""

import numpy as np
import pandas as pd


class SolverError(RuntimeError):
    """The squad constraints could not be satisfied.

    A plain exception, not fastapi.HTTPException: this module runs in the
    scheduled job, which has no web framework installed. The job should fail
    loudly and leave the previous snapshot in place.
    """


# ---------------------------------------------------------------------------
FORMATIONS = [
    (3, 4, 3),
    (3, 5, 2),
    (4, 3, 3),
    (4, 4, 2),
    (4, 5, 1),
    (5, 3, 2),
    (5, 4, 1),
]

OUTPUT_COLS = [
    "element",
    "web_name",
    "position",
    "team_name",
    "value",
    "predicted_points",
    "form",
    "status",
    "chance_of_playing",
    "opponent_name",
]

POSITION_LIMITS = {"GK": 2, "DEF": 5, "MID": 5, "FWD": 3}
MAX_PER_TEAM = 3
DEFAULT_BUDGET = 100.0
# ---------------------------------------------------------------------------


def _available_players(df: pd.DataFrame) -> pd.DataFrame:
    """Filter out injured/unavailable. NaN chance = healthy = 100%."""
    return df[(df["status"] != "i") & (df["chance_of_playing"].fillna(100) > 0)].copy()


def _existing_cols(df: pd.DataFrame) -> list[str]:
    """The subset of output columns this frame actually has."""
    return [c for c in OUTPUT_COLS if c in df.columns]


def _solve_best_xi(df: pd.DataFrame) -> dict:
    """Pick optimal starting 11 from all available players.
    Greedy: try all 7 valid FPL formations, pick highest total predicted_points.
    Always 1 GK. Captain = highest predicted, vice = second highest.
    """
    available = _available_players(df)

    # Sorted once, then every formation below reads from the top. Taking the
    # best N per position is exact for an unconstrained XI, because no
    # formation can prefer a lower-scoring player at the same position.
    gks = available[available["position"] == "GK"].sort_values("predicted_points", ascending=False)
    defs = available[available["position"] == "DEF"].sort_values("predicted_points", ascending=False)
    mids = available[available["position"] == "MID"].sort_values("predicted_points", ascending=False)
    fwds = available[available["position"] == "FWD"].sort_values("predicted_points", ascending=False)

    best_total = -1
    best_xi = None
    best_formation = None

    for n_def, n_mid, n_fwd in FORMATIONS:
        # A formation nobody has the players for, which happens when enough
        # of a squad is injured.
        if len(gks) < 1 or len(defs) < n_def or len(mids) < n_mid or len(fwds) < n_fwd:
            continue

        xi = pd.concat([gks.head(1), defs.head(n_def), mids.head(n_mid), fwds.head(n_fwd)])
        total = xi["predicted_points"].sum()

        if total > best_total:
            best_total = total
            best_xi = xi
            best_formation = f"{n_def}-{n_mid}-{n_fwd}"

    if best_xi is None:
        raise SolverError("Not enough available players to form a valid XI")

    # The captain's points are doubled, so the highest predicted scorer takes
    # the armband and the next one covers them not playing.
    sorted_xi = best_xi.sort_values("predicted_points", ascending=False)
    captain_id = int(sorted_xi.iloc[0]["element"])
    vice_id = int(sorted_xi.iloc[1]["element"])

    # FPL benches exactly four, one of whom must be the reserve keeper.
    xi_ids = set(best_xi["element"].tolist())
    bench_gk = gks[~gks["element"].isin(xi_ids)].head(1)
    bench_outfield = (
        available[(~available["element"].isin(xi_ids)) & (available["position"] != "GK")]
        .sort_values("predicted_points", ascending=False)
        .head(3)
    )
    bench = pd.concat([bench_gk, bench_outfield])
    cols = _existing_cols(best_xi)

    return {
        "formation": best_formation,
        "total_points": round(best_total, 2),
        "total_with_captain": round(best_total + sorted_xi.iloc[0]["predicted_points"], 2),
        "captain_id": captain_id,
        "vice_id": vice_id,
        "starters": best_xi[cols].to_dict(orient="records"),
        "bench": bench[cols].to_dict(orient="records"),
    }


def solve_best_squad(df: pd.DataFrame, budget: float = DEFAULT_BUDGET) -> dict:
    """Pick optimal 15-man squad using Integer Linear Programming.
    Maximise total predicted_points subject to FPL constraints:
    budget, max 3/team, exactly 2 GK + 5 DEF + 5 MID + 3 FWD.
    Then picks best starting XI from the 15 using solve_best_xi.
    """
    available = _available_players(df).reset_index(drop=True)
    n = len(available)
    if n < 15:
        raise SolverError("Not enough available players")

    # Imported here, not at module level: the API uses suggest_transfers from
    # this file but never the ILP, and keeping scipy out of its import graph
    # keeps it off the serving requirements.
    from scipy.optimize import Bounds, LinearConstraint, milp

    # scipy's milp only minimises, so the objective is negated and the
    # result is the squad with the most predicted points.
    c = -available["predicted_points"].values

    constraints_A = []
    lb = []
    ub = []

    # The budget, as one row: the selected players' prices must not exceed it.
    constraints_A.append(available["value"].values.reshape(1, -1))
    lb.append(-np.inf)
    ub.append(budget)

    # Exactly, not at most. FPL squads are 2/5/5/3 with no flexibility.
    for pos, count in POSITION_LIMITS.items():
        row = (available["position"] == pos).astype(float).values.reshape(1, -1)
        constraints_A.append(row)
        lb.append(count)
        ub.append(count)

    # At most three from any one club, which is the rule that stops the
    # solver buying the whole of the best-performing team.
    for team in available["team_name"].unique():
        row = (available["team_name"] == team).astype(float).values.reshape(1, -1)
        constraints_A.append(row)
        lb.append(0)
        ub.append(MAX_PER_TEAM)

    A = np.vstack(constraints_A)
    constraints = LinearConstraint(A, lb, ub)
    # Every variable is integer and bounded to [0, 1], which makes this a
    # pick-or-not decision per player rather than a fractional share.
    integrality = np.ones(n)
    bounds = Bounds(lb=0, ub=1)

    result = milp(c, constraints=constraints, integrality=integrality, bounds=bounds)
    if not result.success:
        raise SolverError(f"ILP solver failed: {result.message}")

    # The solver returns floats even for integer variables, so a selected
    # player comes back as 0.9999999 rather than 1.
    squad = available[result.x > 0.5].copy()
    if len(squad) != 15:
        raise SolverError(f"Solver selected {len(squad)} players instead of 15")

    total_value = squad["value"].sum()
    total_points = squad["predicted_points"].sum()
    xi_result = _solve_best_xi(squad)
    cols = _existing_cols(squad)

    return {
        "squad": squad[cols].to_dict(orient="records"),
        "total_value": round(total_value, 1),
        "total_points": round(total_points, 2),
        "budget_remaining": round(budget - total_value, 1),
        "best_xi": xi_result,
    }


def suggest_transfers(
    user_picks: list[dict],
    all_predictions: pd.DataFrame,
    bank: float = 0.0,
    max_suggestions: int = 5,
) -> list[dict]:
    """Find transfer-in/out pairs that maximise predicted points gain.
    For each squad player, find same-position replacements not already in the
    squad with higher predicted_points and affordable within bank + selling value.
    """
    available = _available_players(all_predictions)
    squad_ids = {p["element"] for p in user_picks}

    team_counts: dict[str, int] = {}
    for p in user_picks:
        t = p.get("team_name", "")
        team_counts[t] = team_counts.get(t, 0) + 1

    cols = _existing_cols(available)
    suggestions = []

    for pick in user_picks:
        out_pos = pick.get("player_position", "")
        out_value = pick.get("value", 0)
        out_pts = pick.get("predicted_points", 0)
        if not out_pos:
            continue

        # Selling frees their price as well as the bank, so a replacement can
        # cost more than the bank alone would allow.
        budget_for_replacement = bank + out_value

        candidates = available[
            (available["position"] == out_pos)
            & (~available["element"].isin(squad_ids))
            & (available["value"] <= budget_for_replacement)
        ].copy()

        # Clubs already at three are closed, except the one being sold from:
        # that transfer frees a slot, so a same-club replacement is legal.
        teams_at_limit = {t for t, c in team_counts.items() if c >= MAX_PER_TEAM}
        out_team = pick.get("team_name", "")
        blocked_teams = teams_at_limit - {out_team}
        if blocked_teams:
            candidates = candidates[~candidates["team_name"].isin(blocked_teams)]

        if candidates.empty:
            continue

        best = candidates.sort_values("predicted_points", ascending=False).iloc[0]
        points_gain = best["predicted_points"] - out_pts
        if points_gain <= 0:
            continue

        out_data = {
            "element": pick["element"],
            "web_name": pick.get("web_name", ""),
            "position": out_pos,
            "team_name": out_team,
            "value": out_value,
            "predicted_points": out_pts,
        }

        in_data = {}
        for c in cols:
            if c in best.index:
                v = best[c]
                in_data[c] = v.item() if hasattr(v, "item") else v

        suggestions.append(
            {
                "out": out_data,
                "in": in_data,
                "points_gain": round(float(points_gain), 2),
                "cost_saving": round(float(out_value - best["value"]), 1),
            }
        )

    # Best gain first, then one suggestion per incoming player. The same
    # target is usually the best replacement for several squad members, and
    # a list repeating them reads as four transfers when it is one.
    suggestions.sort(key=lambda s: s["points_gain"], reverse=True)
    seen_in: set[int] = set()
    unique = []
    for s in suggestions:
        in_id = s["in"]["element"]
        if in_id not in seen_in:
            seen_in.add(in_id)
            unique.append(s)
        if len(unique) >= max_suggestions:
            break

    return unique
