"""Roll Understat per-match stats up to one row per player per gameweek.

Understat records a row per match; FPL thinks in gameweeks. The two differ
whenever a gameweek contains more than one fixture for a club, so this is a
sum rather than a join.
"""

from pathlib import Path

import pandas as pd

from ml.config.seasons import SEASONS_ALL
from ml.utils.io import safe_read_csv

# The columns worth carrying across. Understat publishes more, but these are
# the ones the feature builder reads.
US_COLS = ["xG", "xA", "npxG", "xGChain", "xGBuildup", "shots", "key_passes", "time"]


def run_one(season: str) -> Path:
    """Aggregate one season's Understat matches to gameweek rows."""
    year = int(season.split("-")[0])
    us_with_gw = Path(f"data/processed/understat/player_matches_EPL_{year}_all_with_gw.csv")
    mp_path = Path(f"data/processed/mappings/fpl_to_understat_{season}.csv")
    out = Path(f"data/processed/understat/understat_gw_{season}.csv")

    us = safe_read_csv(us_with_gw)

    # A match with no gameweek never got mapped to a fixture, so there is no
    # row for it to belong to.
    us = us[us["GW"].notna()].copy()
    us["GW"] = us["GW"].astype(int)

    mp = safe_read_csv(mp_path)

    mp = mp[mp["us_player_id"].notna()].copy()
    mp["us_player_id"] = mp["us_player_id"].astype(int)

    us["us_player_id"] = pd.to_numeric(us["us_player_id"], errors="coerce").astype("Int64")

    us = us.dropna(subset=["us_player_id"])
    us["us_player_id"] = us["us_player_id"].astype(int)

    # Inner, deliberately. An Understat player with no FPL counterpart has
    # nowhere to go, and an FPL player with no Understat row is handled later
    # by leaving their xG columns absent rather than inventing zeros here.
    us = us.merge(mp[["element", "us_player_id"]], on="us_player_id", how="inner")

    for c in US_COLS:
        us[c] = pd.to_numeric(us[c], errors="coerce")

    # Summed, not averaged: a double gameweek is two matches of real xG, and
    # a player who plays twice should show twice the output.
    agg = us.groupby(["element", "GW"], as_index=False)[US_COLS].sum()

    # Prefixed because FPL publishes its own expected_goals, and a merge that
    # silently suffixes one of them produces a column nobody reads.
    agg = agg.rename(columns={c: f"us_{c.lower()}" for c in US_COLS})

    agg["season"] = season

    out.parent.mkdir(parents=True, exist_ok=True)
    agg.to_csv(out, index=False)

    print("saved:", out, "rows:", len(agg))
    return out


def main():
    """Aggregate Understat matches to gameweeks for every season."""
    for season in SEASONS_ALL:
        run_one(season)


if __name__ == "__main__":
    main()
