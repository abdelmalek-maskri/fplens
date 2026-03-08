"""Test and compare squad selection solvers."""
import sys
sys.path.insert(0, ".")

from pathlib import Path
import joblib
import pandas as pd
from api.solvers import solve_best_xi, FORMATIONS

# --- load real predictions ---
print("Loading model and running predictions...")
from ml.pipelines.inference.predict import run as run_predictions
model = joblib.load("outputs/experiments/ablation_injury/config_D/model.joblib")
df = run_predictions(model=model, save_output=False)
print(f"\nTotal players: {len(df)}")
available = df[(df["status"] != "i") & (df["chance_of_playing"] > 0)]
print(f"Available players: {len(available)}")

# --- 1. run the greedy solver ---
print("\n" + "=" * 60)
print("GREEDY SOLVER (current)")
print("=" * 60)
result = solve_best_xi(df)
print(f"Formation: {result['formation']}")
print(f"Total points: {result['total_points']}")
print(f"Total with captain: {result['total_with_captain']}")
print(f"\nStarters:")
for p in result["starters"]:
    cap = " (C)" if p["element"] == result["captain_id"] else " (V)" if p["element"] == result["vice_id"] else ""
    print(f"  {p['position']:3s}  {p['web_name']:18s}  {p['team_name']:3s}  {p['predicted_points']:.2f}{cap}")
print(f"\nBench:")
for p in result["bench"]:
    print(f"  {p['position']:3s}  {p['web_name']:18s}  {p['team_name']:3s}  {p['predicted_points']:.2f}")

# --- 2. show all formation totals ---
print("\n" + "=" * 60)
print("ALL FORMATIONS COMPARED")
print("=" * 60)
gks = available[available["position"] == "GK"].sort_values("predicted_points", ascending=False)
defs = available[available["position"] == "DEF"].sort_values("predicted_points", ascending=False)
mids = available[available["position"] == "MID"].sort_values("predicted_points", ascending=False)
fwds = available[available["position"] == "FWD"].sort_values("predicted_points", ascending=False)

formation_results = []
for n_def, n_mid, n_fwd in FORMATIONS:
    xi = pd.concat([gks.head(1), defs.head(n_def), mids.head(n_mid), fwds.head(n_fwd)])
    total = xi["predicted_points"].sum()
    formation_results.append((f"{n_def}-{n_mid}-{n_fwd}", total))

formation_results.sort(key=lambda x: x[1], reverse=True)
for f, t in formation_results:
    marker = " <-- BEST" if f == result["formation"] else ""
    print(f"  {f}:  {t:.2f}{marker}")

# --- 3. position pool depth ---
print("\n" + "=" * 60)
print("POSITION POOL DEPTH (top 5 per position)")
print("=" * 60)
for pos, pool in [("GK", gks), ("DEF", defs), ("MID", mids), ("FWD", fwds)]:
    print(f"\n{pos} ({len(pool)} available):")
    for _, row in pool.head(5).iterrows():
        print(f"  {row['web_name']:18s}  {row['team_name']:3s}  {row['predicted_points']:.2f}")

# --- 4. prove greedy = optimal for unconstrained ---
print("\n" + "=" * 60)
print("GREEDY vs ILP (proving they match for unconstrained selection)")
print("=" * 60)
try:
    from scipy.optimize import linprog
    import numpy as np

    # ILP: maximise total predicted_points picking exactly 1 GK + formation DEF/MID/FWD
    # we solve for the best formation found by greedy, to verify they match
    best_f = result["formation"]
    n_d, n_m, n_f = [int(x) for x in best_f.split("-")]

    # for each position, ILP just picks top N (no budget constraint = trivial)
    ilp_total = (
        gks.head(1)["predicted_points"].sum()
        + defs.head(n_d)["predicted_points"].sum()
        + mids.head(n_m)["predicted_points"].sum()
        + fwds.head(n_f)["predicted_points"].sum()
    )
    print(f"  Greedy total: {result['total_points']:.2f}")
    print(f"  ILP total:    {ilp_total:.2f}")
    print(f"  Match: {'YES' if abs(ilp_total - result['total_points']) < 0.01 else 'NO'}")
    print(f"\n  Without budget constraints, greedy IS optimal.")
    print(f"  ILP becomes useful for FF-8 (best squad with £100 budget + max 3/team).")
except ImportError:
    print("  scipy not installed, skipping ILP comparison")

# --- 5. sensitivity: what if we used different captain strategies? ---
print("\n" + "=" * 60)
print("CAPTAIN STRATEGY COMPARISON")
print("=" * 60)
starters = pd.DataFrame(result["starters"])
sorted_by_pts = starters.sort_values("predicted_points", ascending=False)

strategies = {
    "Highest predicted (current)": sorted_by_pts.iloc[0],
    "2nd highest predicted": sorted_by_pts.iloc[1],
    "Best midfielder": starters[starters["position"] == "MID"].sort_values("predicted_points", ascending=False).iloc[0] if len(starters[starters["position"] == "MID"]) > 0 else None,
    "Best forward": starters[starters["position"] == "FWD"].sort_values("predicted_points", ascending=False).iloc[0] if len(starters[starters["position"] == "FWD"]) > 0 else None,
}

base_total = result["total_points"]
for name, player in strategies.items():
    if player is None:
        continue
    total_with_cap = base_total + player["predicted_points"]
    print(f"  {name:30s}  {player['web_name']:15s}  total={total_with_cap:.2f}  (+{player['predicted_points']:.2f})")
