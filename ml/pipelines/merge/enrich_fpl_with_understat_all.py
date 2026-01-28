# ml/pipelines/enrich_fpl_with_understat_all.py (11) 

import argparse
from pathlib import Path
import pandas as pd
from ml.config.seasons import SEASONS_ALL

FPL_BASE = Path("data/processed/merged/fpl_base.csv")
OUT = Path("data/processed/merged/fpl_base_enriched.csv")


def run(seasons):
    #load base FPL table
    fpl = pd.read_csv(FPL_BASE, low_memory=False)
    fpl["GW"] = pd.to_numeric(fpl["GW"], errors="coerce")
    fpl["element"] = pd.to_numeric(fpl["element"], errors="coerce")

    parts = []

    for season in seasons:
        sub = fpl[fpl["season"] == season].copy()
        us_path = Path(f"data/processed/external/understat/understat_gw_{season}.csv")

        #skip seasons without Understat GW data
        if not us_path.exists():
            print(f"Missing Understat GW for {season} (skipping)")
            parts.append(sub)
            continue

        us = pd.read_csv(us_path, low_memory=False)
        us["GW"] = pd.to_numeric(us["GW"], errors="coerce")
        us["element"] = pd.to_numeric(us["element"], errors="coerce")

        # merge on season + player + GW
        merged = sub.merge(us, on=["season", "element", "GW"], how="left")

        # Backfill expected stats where FPL data is missing
        if "expected_goals" in merged.columns and "us_xg" in merged.columns:
            merged["expected_goals"] = pd.to_numeric(
                merged["expected_goals"], errors="coerce"
            ).fillna(merged["us_xg"])

        if "expected_assists" in merged.columns and "us_xa" in merged.columns:
            merged["expected_assists"] = pd.to_numeric(
                merged["expected_assists"], errors="coerce"
            ).fillna(merged["us_xa"])

        if (
            "expected_goal_involvements" in merged.columns
            and "us_xg" in merged.columns
            and "us_xa" in merged.columns
        ):
            merged["expected_goal_involvements"] = pd.to_numeric(
                merged["expected_goal_involvements"], errors="coerce"
            ).fillna(merged["us_xg"] + merged["us_xa"])

        parts.append(merged)

        coverage = (
            float(merged["us_xg"].notna().mean())
            if "us_xg" in merged.columns
            else 0.0
        )
        print(f"{season}: Understat merged (xG coverage={coverage:.3f})")

    # Recombine all seasons
    full = pd.concat(parts, ignore_index=True)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    full.to_csv(OUT, index=False)

    print("Saved:", OUT)
    print("Shape:", full.shape)


def main():
    SEASONS = [
    "2016-17", "2017-18", "2018-19",
    "2019-20", "2020-21", "2021-22",
    "2022-23", "2023-24", "2024-25",
    "2025-26",
    ]

    run(SEASONS) 


if __name__ == "__main__":
    main()
