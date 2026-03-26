# ml/pipelines/enrich_fpl_with_understat_all.py

from pathlib import Path

import pandas as pd

from ml.config.seasons import SEASONS_ALL
from ml.utils.io import safe_read_csv

FPL_BASE = Path("data/processed/fpl/fpl_base.csv")
OUT = Path("data/processed/merged/fpl_understat_merged.csv")


def run(seasons):
    fpl = safe_read_csv(FPL_BASE)
    fpl["GW"] = pd.to_numeric(fpl["GW"], errors="coerce")
    fpl["element"] = pd.to_numeric(fpl["element"], errors="coerce")

    parts = []

    for season in seasons:
        sub = fpl[fpl["season"] == season].copy()
        us_path = Path(f"data/processed/understat/understat_gw_{season}.csv")

        # skip seasons without Understat GW data
        if not us_path.exists():
            print(f"missing Understat GW for {season} (skipping)")
            parts.append(sub)
            continue

        us = safe_read_csv(us_path)
        us["GW"] = pd.to_numeric(us["GW"], errors="coerce")
        us["element"] = pd.to_numeric(us["element"], errors="coerce")

        # merge on season + player + GW
        n_before = len(sub)
        merged = sub.merge(us, on=["season", "element", "GW"], how="left")
        if len(merged) != n_before:
            raise RuntimeError(
                f"{season}: merge fan-out detected! "
                f"FPL rows={n_before}, after merge={len(merged)}. "
                f"Understat GW file likely has duplicate (element, GW) rows."
            )

        # backfill expected stats where FPL data is missing
        if "expected_goals" in merged.columns and "us_xg" in merged.columns:
            merged["expected_goals"] = pd.to_numeric(merged["expected_goals"], errors="coerce").fillna(merged["us_xg"])

        if "expected_assists" in merged.columns and "us_xa" in merged.columns:
            merged["expected_assists"] = pd.to_numeric(merged["expected_assists"], errors="coerce").fillna(
                merged["us_xa"]
            )

        if "expected_goal_involvements" in merged.columns and "us_xg" in merged.columns and "us_xa" in merged.columns:
            merged["expected_goal_involvements"] = pd.to_numeric(
                merged["expected_goal_involvements"], errors="coerce"
            ).fillna(merged["us_xg"] + merged["us_xa"])

        parts.append(merged)

        coverage = float(merged["us_xg"].notna().mean()) if "us_xg" in merged.columns else 0.0
        print(f"{season}: Understat merged (xG coverage={coverage:.3f})")

    # Recombine all seasons
    full = pd.concat(parts, ignore_index=True)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    full.to_csv(OUT, index=False)
    print("saved:", OUT)
    print("shape:", full.shape)
    if "us_xg" in full.columns:
        print("overall xG coverage:", full["us_xg"].notna().mean())
        if "minutes" in full.columns:
            print("xG coverage (minutes > 0):", full.loc[full["minutes"] > 0, "us_xg"].notna().mean())


def main():
    run(SEASONS_ALL)


if __name__ == "__main__":
    main()
