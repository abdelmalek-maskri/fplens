# ml/pipelines/build_understat_gw.py (10)

import argparse
from pathlib import Path
import pandas as pd

US_COLS = ["xG", "xA", "npxG", "xGChain", "xGBuildup", "shots", "key_passes", "time"]

def run_one(season: str) -> Path:
    year = int(season.split("-")[0])

    us_with_gw = Path(f"data/processed/external/understat/player_matches_EPL_{year}_all_with_gw.csv")
    mp_path = Path(f"data/processed/mappings/fpl_to_understat_{season}.csv")
    out = Path(f"data/processed/external/understat/understat_gw_{season}.csv")

    us = pd.read_csv(us_with_gw, low_memory=False)
    us = us[us["GW"].notna()].copy()
    us["GW"] = us["GW"].astype(int)

    mp = pd.read_csv(mp_path, low_memory=False)
    mp = mp[mp["us_player_id"].notna()].copy()
    mp["us_player_id"] = mp["us_player_id"].astype(int)

    us["us_player_id"] = pd.to_numeric(us["us_player_id"], errors="coerce").astype("Int64")
    us = us.dropna(subset=["us_player_id"])
    us["us_player_id"] = us["us_player_id"].astype(int)

    # attach element via mapping
    us = us.merge(mp[["element", "us_player_id"]], on="us_player_id", how="inner")

    for c in US_COLS:
        us[c] = pd.to_numeric(us[c], errors="coerce")

    agg = us.groupby(["element", "GW"], as_index=False)[US_COLS].sum()
    agg = agg.rename(columns={c: f"us_{c.lower()}" for c in US_COLS})
    agg["season"] = season

    out.parent.mkdir(parents=True, exist_ok=True)
    agg.to_csv(out, index=False)

    print("Saved:", out, "rows:", len(agg))
    return out

def main():
    SEASONS = [
    "2016-17", "2017-18", "2018-19",
    "2019-20", "2020-21", "2021-22",
    "2022-23", "2023-24", "2024-25",
    "2025-26",
    ]

    for season in SEASONS:
        run_one(season)  

if __name__ == "__main__":
    main()
