import pandas as pd
from pathlib import Path

FPL_BASE = Path("data/processed/merged/fpl_base.csv")
MAP = Path("data/processed/mappings/fpl_to_understat_2016-17.csv")
US_MATCHES = Path("data/processed/external/understat/player_matches_EPL_2016_all_filtered.csv")

OUT = Path("data/processed/external/understat/understat_gw_2016-17.csv")

# Understat season 2016 corresponds to FPL season label "2016-17"
FPL_SEASON = "2016-17"

def run():
    fpl = pd.read_csv(FPL_BASE, low_memory=False)
    fpl = fpl[fpl["season"] == FPL_SEASON].copy()

    # We need GW -> date window to assign Understat matches to GW.
    # For 2016-17 Vaastav merged_gw does NOT always include kickoff_time,
    # so we approximate using the match date and the GW's min/max date from FPL rows.
    #
    # First, build a GW date window from Understat match dates joined to teams is hard.
    # So we do the simplest correct method:
    # Use FPL fixture scores per GW aren’t enough.
    #
    # Therefore: for 2016-17 we do player-level weekly grouping by Understat's "date"
    # and then later align by week number using chronological order.
    #
    # This is acceptable for a first enrichment baseline:
    # - sort Understat matches by date
    # - assign "pseudo-GW" by EPL match round order per season (approx)
    #
    # BUT: better method is to use Vaastav fixtures for GW dates.
    # We'll implement that next once you confirm fixtures availability.

    # For now, we will output match-level with element attached.
    mp = pd.read_csv(MAP, low_memory=False)
    mp = mp[mp["us_player_id"].notna()].copy()
    mp["us_player_id"] = mp["us_player_id"].astype(int)

    us = pd.read_csv(US_MATCHES, low_memory=False)
    us["us_player_id"] = us["us_player_id"].astype(int)

    us = us.merge(mp[["element", "us_player_id"]], on="us_player_id", how="inner")

    # Keep only relevant columns
    keep = ["element", "date", "xG", "xA", "npxG", "xGChain", "xGBuildup", "shots", "key_passes", "time"]
    us = us[keep].copy()

    # Convert
    us["date"] = pd.to_datetime(us["date"], errors="coerce")
    for c in ["xG","xA","npxG","xGChain","xGBuildup","shots","key_passes","time"]:
        us[c] = pd.to_numeric(us[c], errors="coerce")

    # Aggregate per player per date (in case duplicates)
    agg = us.groupby(["element", "date"], as_index=False).sum()

    OUT.parent.mkdir(parents=True, exist_ok=True)
    agg.to_csv(OUT, index=False)
    print("✅ Saved:", OUT, "rows:", len(agg))
    print("Columns:", agg.columns.tolist())

if __name__ == "__main__":
    run()
