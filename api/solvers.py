"""Solvers for FPL squad selection: best XI, best squad, transfer suggestions."""

import numpy as np
import pandas as pd
from scipy.optimize import Bounds, LinearConstraint, milp

FORMATIONS = [
    (3, 4, 3),
    (3, 5, 2),
    (4, 3, 3),
    (4, 4, 2),
    (4, 5, 1),
    (5, 3, 2),
    (5, 4, 1),
]


def solve_best_xi(df: pd.DataFrame) -> dict:
    """Pick optimal starting 11 from all available players.
    greedy solver: try all 7 valid FPL formations,
    pick the one with highest total predicted_points.
    Always 1 GK. Captain = highest predicted, vice = second highest.
    """
    # filter out injured and unavailable players
    available = df[(df["status"] != "i") & (df["chance_of_playing"] > 0)].copy()

    # sort each position pool by predicted_points descending
    gks = available[available["position"] == "GK"].sort_values("predicted_points", ascending=False)
    defs = available[available["position"] == "DEF"].sort_values("predicted_points", ascending=False)
    mids = available[available["position"] == "MID"].sort_values("predicted_points", ascending=False)
    fwds = available[available["position"] == "FWD"].sort_values("predicted_points", ascending=False)

    best_total = -1
    best_xi = None
    best_formation = None

    for n_def, n_mid, n_fwd in FORMATIONS:
        # check we have enough players
        if len(gks) < 1 or len(defs) < n_def or len(mids) < n_mid or len(fwds) < n_fwd:
            continue

        xi = pd.concat(
            [
                gks.head(1),
                defs.head(n_def),
                mids.head(n_mid),
                fwds.head(n_fwd),
            ]
        )
        total = xi["predicted_points"].sum()

        if total > best_total:
            best_total = total
            best_xi = xi
            best_formation = f"{n_def}-{n_mid}-{n_fwd}"

    if best_xi is None:
        return {"error": "Not enough available players to form a valid XI"}

    # captain and vice: highest predicted_points
    sorted_xi = best_xi.sort_values("predicted_points", ascending=False)
    captain_id = int(sorted_xi.iloc[0]["element"])
    vice_id = int(sorted_xi.iloc[1]["element"])

    # bench: best remaining players (1 GK + 3 outfield)
    xi_ids = set(best_xi["element"].tolist())
    bench_gk = gks[~gks["element"].isin(xi_ids)].head(1)
    bench_outfield = (
        available[(~available["element"].isin(xi_ids)) & (available["position"] != "GK")]
        .sort_values("predicted_points", ascending=False)
        .head(3)
    )
    bench = pd.concat([bench_gk, bench_outfield])

    # select only the fields the frontend needs
    columns = [
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
        "uncertainty",
        "predicted_range_low",
        "predicted_range_high",
    ]
    existing_cols = [c for c in columns if c in best_xi.columns]

    return {
        "formation": best_formation,
        "total_points": round(best_total, 2),
        "total_with_captain": round(
            best_total + best_xi.sort_values("predicted_points", ascending=False).iloc[0]["predicted_points"], 2
        ),
        "captain_id": captain_id,
        "vice_id": vice_id,
        "starters": best_xi[existing_cols].to_dict(orient="records"),
        "bench": bench[existing_cols].to_dict(orient="records"),
    }


# --- FPL squad constraints ---
POSITION_LIMITS = {"GK": 2, "DEF": 5, "MID": 5, "FWD": 3}  # total = 15
MAX_PER_TEAM = 3
DEFAULT_BUDGET = 100.0


def solve_best_squad(df: pd.DataFrame, budget: float = DEFAULT_BUDGET) -> dict:
    """Pick optimal 15-man squad using Integer Linear Programming. maximise total predicted_points subject to:
      - budget constraint (sum of values <= budget)
      - max 3 players per team
      - exactly 2 GK, 5 DEF, 5 MID, 3 FWD
      - each player binary (picked or not)
    Then picks best starting XI from the 15 using solve_best_xi logic.
    """
    # filter out injured and unavailable
    available = df[(df["status"] != "i") & (df["chance_of_playing"] > 0)].reset_index(drop=True)

    n = len(available)
    if n < 15:
        return {"error": "Not enough available players"}

    # objective: maximise predicted_points (milp minimises, so negate)
    c = -available["predicted_points"].values

    # --- constraints ---
    constraint_matrices = []
    lower_bounds = []
    upper_bounds = []

    # 1. budget: sum(value * x) <= budget
    budget_row = available["value"].values.reshape(1, -1)
    constraint_matrices.append(budget_row)
    lower_bounds.append(-np.inf)
    upper_bounds.append(budget)

    # 2. position constraints: exactly N per position
    for pos, count in POSITION_LIMITS.items():
        pos_row = (available["position"] == pos).astype(float).values.reshape(1, -1)
        constraint_matrices.append(pos_row)
        lower_bounds.append(count)
        upper_bounds.append(count)

    # 3. team constraints: at most 3 per team
    teams = available["team_name"].unique()
    for team in teams:
        team_row = (available["team_name"] == team).astype(float).values.reshape(1, -1)
        constraint_matrices.append(team_row)
        lower_bounds.append(0)
        upper_bounds.append(MAX_PER_TEAM)

    # stack all constraints
    A = np.vstack(constraint_matrices)
    constraints = LinearConstraint(A, lower_bounds, upper_bounds)

    # all variables are binary (0 or 1)
    integrality = np.ones(n)  # 1 = integer
    bounds = Bounds(lb=0, ub=1)

    # solve
    result = milp(c, constraints=constraints, integrality=integrality, bounds=bounds)

    if not result.success:
        return {"error": f"ILP solver failed: {result.message}"}

    # extract selected players
    selected_mask = result.x > 0.5  # binary, but solver returns floats
    squad = available[selected_mask].copy()

    if len(squad) != 15:
        return {"error": f"Solver selected {len(squad)} players instead of 15"}

    total_value = squad["value"].sum()
    total_points = squad["predicted_points"].sum()

    # pick best XI from the 15-man squad
    xi_result = solve_best_xi(squad)

    # select output columns
    columns = [
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
        "uncertainty",
        "predicted_range_low",
        "predicted_range_high",
    ]
    existing_cols = [c for c in columns if c in squad.columns]

    return {
        "squad": squad[existing_cols].to_dict(orient="records"),
        "total_value": round(total_value, 1),
        "total_points": round(total_points, 2),
        "budget_remaining": round(budget - total_value, 1),
        "best_xi": xi_result,
    }


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
    "uncertainty",
    "predicted_range_low",
    "predicted_range_high",
]


def suggest_transfers(
    user_picks: list[dict],
    all_predictions: pd.DataFrame,
    bank: float = 0.0,
    max_suggestions: int = 5,
) -> list[dict]:
    """suggest transfer-in/out pairs that maximise predicted points gain, and
    for each squad player, find same-position replacements not already in the
    squad with higher predicted_points and affordable within bank + selling value.

    Returns:
        list of {out: {player}, in: {player}, points_gain, cost_saving} sorted by points_gain desc
    """
    # filter available players (not injured)
    available = all_predictions[(all_predictions["status"] != "i") & (all_predictions["chance_of_playing"] > 0)].copy()

    # current squad element IDs
    squad_ids = {p["element"] for p in user_picks}

    # count how many players per team in current squad (for max 3/team rule)
    team_counts = {}
    for p in user_picks:
        team = p.get("team_name", "")
        team_counts[team] = team_counts.get(team, 0) + 1

    existing_cols = [c for c in OUTPUT_COLS if c in available.columns]

    suggestions = []
    for pick in user_picks:
        out_pos = pick.get("player_position", "")
        out_value = pick.get("value", 0)  # current value in £m
        out_pts = pick.get("predicted_points", 0)

        if not out_pos:
            continue

        # budget available if we sell this player: bank + their value
        budget_for_replacement = bank + out_value

        # find same-position players not in squad, affordable, not injured
        candidates = available[
            (available["position"] == out_pos)
            & (~available["element"].isin(squad_ids))
            & (available["value"] <= budget_for_replacement)
        ].copy()

        # enforce max 3 per team: exclude players from teams already at 3
        # (selling frees a slot on that team, so only check the incoming team)
        teams_at_limit = {t for t, c in team_counts.items() if c >= MAX_PER_TEAM}
        # selling this player frees their team slot
        out_team = pick.get("team_name", "")
        teams_at_limit_after_sell = teams_at_limit - {out_team}
        if teams_at_limit_after_sell:
            candidates = candidates[~candidates["team_name"].isin(teams_at_limit_after_sell)]

        if candidates.empty:
            continue

        # best candidate = highest predicted_points
        best = candidates.sort_values("predicted_points", ascending=False).iloc[0]
        points_gain = best["predicted_points"] - out_pts

        # only suggest if there's a positive gain
        if points_gain <= 0:
            continue

        out_data = {
            k: pick.get(k, pick.get(k.replace("player_position", "position"), ""))
            for k in existing_cols
            if k in pick or k == "position"
        }
        # normalise out_data keys
        out_data = {
            "element": pick["element"],
            "web_name": pick.get("web_name", ""),
            "position": out_pos,
            "team_name": pick.get("team_name", ""),
            "value": out_value,
            "predicted_points": out_pts,
        }

        in_data = {c: best[c] for c in existing_cols if c in best.index}

        suggestions.append(
            {
                "out": out_data,
                "in": in_data,
                "points_gain": round(float(points_gain), 2),
                "cost_saving": round(float(out_value - best["value"]), 1),
            }
        )

    # sort by points_gain descending, deduplicate by in-player
    suggestions.sort(key=lambda s: s["points_gain"], reverse=True)

    # remove duplicate in-players (same player suggested for multiple outs)
    seen_in = set()
    unique = []
    for s in suggestions:
        in_id = s["in"]["element"]
        if in_id not in seen_in:
            seen_in.add(in_id)
            unique.append(s)
        if len(unique) >= max_suggestions:
            break

    return unique
