import pandas as pd
from pathlib import Path

FPL_BASE = Path("data/processed/merged/fpl_base.csv")
MAP = Path("data/processed/mappings/fpl_to_understat_2016-17.csv")
US = Path("data/processed/external/understat/understat_matches_mapped_2016-17.csv")


OUT = Path("data/processed/merged/fpl_base_enriched.csv")

FPL_SEASON = "2016-17"

US_COLS = ["xG", "xA", "npxG", "xGChain", "xGBuildup", "shots", "key_passes", "time"]

def run():
    fpl = pd.read_csv(FPL_BASE, low_memory=False)
    fpl["GW"] = pd.to_numeric(fpl["GW"], errors="coerce")
    fpl = fpl[fpl["season"] == FPL_SEASON].copy()

    mp = pd.read_csv(MAP, low_memory=False)
    mp = mp[mp["us_player_id"].notna()].copy()
    mp["us_player_id"] = mp["us_player_id"].astype(int)

    us = pd.read_csv(US, low_memory=False)
    us = us[us["GW"].notna()].copy()
    us["GW"] = us["GW"].astype(int)
    us["us_player_id"] = us["us_player_id"].astype(int)

    us = us.merge(mp[["element", "us_player_id"]], on="us_player_id", how="inner")

    for c in US_COLS:
        us[c] = pd.to_numeric(us[c], errors="coerce")

    # sum per player per GW (handles double gameweeks)
    agg = us.groupby(["element", "GW"], as_index=False)[US_COLS].sum()
    agg = agg.rename(columns={c: f"us_{c.lower()}" for c in US_COLS})

    enriched = fpl.merge(agg, on=["element", "GW"], how="left")

    # Backfill expected_* only where missing
    if "expected_goals" in enriched.columns:
        enriched["expected_goals"] = enriched["expected_goals"].fillna(enriched["us_xg"])
    if "expected_assists" in enriched.columns:
        enriched["expected_assists"] = enriched["expected_assists"].fillna(enriched["us_xa"])
    if "expected_goal_involvements" in enriched.columns:
        enriched["expected_goal_involvements"] = enriched["expected_goal_involvements"].fillna(
            enriched["us_xg"] + enriched["us_xa"]
        )

    OUT.parent.mkdir(parents=True, exist_ok=True)
    enriched.to_csv(OUT, index=False)

    print("✅ Saved:", OUT)
    print("Shape:", enriched.shape)
    print("Understat coverage (us_xg non-null):", float(enriched["us_xg"].notna().mean()))

if __name__ == "__main__":
    run()
