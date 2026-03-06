"""Solvers for FPL squad selection: best XI, best squad."""
import pandas as pd

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
    available = df[
        (df["status"] != "i") & (df["chance_of_playing"] > 0)
    ].copy()

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

        xi = pd.concat([
            gks.head(1),
            defs.head(n_def),
            mids.head(n_mid),
            fwds.head(n_fwd),
        ])
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
    bench_outfield = available[
        (~available["element"].isin(xi_ids))
        & (available["position"] != "GK")
    ].sort_values("predicted_points", ascending=False).head(3)
    bench = pd.concat([bench_gk, bench_outfield])

    # select only the fields the frontend needs
    columns = [
        "element", "web_name", "position", "team_name", "value",
        "predicted_points", "form", "status", "chance_of_playing",
        "opponent_name", "uncertainty", "predicted_range_low", "predicted_range_high",
    ]
    existing_cols = [c for c in columns if c in best_xi.columns]

    return {
        "formation": best_formation,
        "total_points": round(best_total, 2),
        "total_with_captain": round(best_total + best_xi.sort_values("predicted_points", ascending=False).iloc[0]["predicted_points"], 2),
        "captain_id": captain_id,
        "vice_id": vice_id,
        "starters": best_xi[existing_cols].to_dict(orient="records"),
        "bench": bench[existing_cols].to_dict(orient="records"),
    }
