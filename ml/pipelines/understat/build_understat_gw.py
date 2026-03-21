# ml/pipelines/understat/build_understat_gw.py

from pathlib import Path
import pandas as pd
from ml.config.seasons import SEASONS_ALL
from ml.utils.io import safe_read_csv

# Understat match-level stats we want to aggregate into GW features
US_COLS = ["xG", "xA", "npxG", "xGChain", "xGBuildup", "shots", "key_passes", "time"]

def run_one(season: str) -> Path:
    year = int(season.split("-")[0])
    us_with_gw = Path(f"data/processed/understat/player_matches_EPL_{year}_all_with_gw.csv")
    mp_path = Path(f"data/processed/mappings/fpl_to_understat_{season}.csv")
    out = Path(f"data/processed/understat/understat_gw_{season}.csv")

    # load Understat match-level data
    us = safe_read_csv(us_with_gw)

    # keep only rows with a valid Gameweek
    us = us[us["GW"].notna()].copy()
    us["GW"] = us["GW"].astype(int)

    # load FPL ↔ Understat mapping
    mp = safe_read_csv(mp_path)

    # Keep only players that were successfully mapped
    mp = mp[mp["us_player_id"].notna()].copy()
    mp["us_player_id"] = mp["us_player_id"].astype(int)

    # clean Understat player IDs before merging
    us["us_player_id"] = pd.to_numeric(us["us_player_id"], errors="coerce").astype("Int64")

    # drop rows where player ID could not be parsed
    us = us.dropna(subset=["us_player_id"])
    us["us_player_id"] = us["us_player_id"].astype(int)

    # attach FPL player IDs (element) using the mapping
    # this converts Understat player IDs → FPL player IDs
    # only keeps rows where mapping exists (inner join)
    us = us.merge(mp[["element", "us_player_id"]], on="us_player_id", how="inner")

    # ensure all stats are numeric 
    for c in US_COLS:
        us[c] = pd.to_numeric(us[c], errors="coerce")

    # aggregate match-level stats → gameweek-level stats
    # for each (player, GW), sum all match contributions
    agg = us.groupby(["element", "GW"], as_index=False)[US_COLS].sum()

    # prefix columns to avoid clashes with FPL features later
    agg = agg.rename(columns={c: f"us_{c.lower()}" for c in US_COLS})

    # add season column for multi-season datasets
    agg["season"] = season

    out.parent.mkdir(parents=True, exist_ok=True)
    agg.to_csv(out, index=False)

    print("saved:", out, "rows:", len(agg))
    return out

def main():
    for season in SEASONS_ALL:
        run_one(season)

if __name__ == "__main__":
    main()