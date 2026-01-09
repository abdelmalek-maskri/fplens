import asyncio
import pandas as pd
from pathlib import Path

import aiohttp
import nest_asyncio
from understat import Understat

nest_asyncio.apply()

OUT_DIR = Path("data/processed/external/understat")
OUT_DIR.mkdir(parents=True, exist_ok=True)

LEAGUE = "EPL"
SEASON = 2016  # Understat uses starting year (2016 == 2016/17)

async def fetch_players(season=SEASON, league=LEAGUE):
    async with aiohttp.ClientSession() as session:
        understat = Understat(session)

        # aggregated players (season summary)
        players = await understat.get_league_players(league, season)

        return players

async def fetch_player_matches(player_id: int):
    async with aiohttp.ClientSession() as session:
        understat = Understat(session)
        matches = await understat.get_player_matches(player_id)
        return matches

async def fetch_team_names(season=SEASON, league=LEAGUE):
    async with aiohttp.ClientSession() as session:
        understat = Understat(session)
        teams = await understat.get_teams(league, season)
        # Understat uses "title" for team name in most responses
        return {t["title"] for t in teams}


def run():
    print(f"📥 Fetching Understat players: {LEAGUE} {SEASON}/{str(SEASON+1)[-2:]}")
    players = asyncio.run(fetch_players())

    print(f"📥 Fetching Understat team names: {LEAGUE} {SEASON}")
    team_names = asyncio.run(fetch_team_names())
    print("Teams:", sorted(list(team_names))[:5], "... total:", len(team_names))

    players_df = pd.DataFrame(players)
    players_path = OUT_DIR / f"players_{LEAGUE}_{SEASON}.csv"
    players_df.to_csv(players_path, index=False)
    print("✅ Saved:", players_path, "rows:", len(players_df))

    TOP_N = None
    print(f"📥 Fetching matches for top {TOP_N} players (by minutes)...")

    # Understat minutes often stored as string; convert safely
    players_df["minutes"] = pd.to_numeric(players_df.get("minutes"), errors="coerce")
    top_players = players_df.sort_values("minutes", ascending=False)

    all_rows = []
    for _, row in top_players.iterrows():
        pid = int(row["id"])
        m = asyncio.run(fetch_player_matches(pid))

        # keep only matches from this EPL season, and where both teams are EPL teams
        m_filtered = []
        for r in m:
            if int(r.get("season", -1)) != SEASON:
                continue
            if r.get("h_team") not in team_names:
                continue
            if r.get("a_team") not in team_names:
                continue
            r["us_player_id"] = pid
            r["league"] = LEAGUE
            m_filtered.append(r)

        all_rows.extend(m_filtered)


    matches_df = pd.DataFrame(all_rows)
    suffix = "all" if TOP_N is None else f"top{TOP_N}"
    matches_path = OUT_DIR / f"player_matches_{LEAGUE}_{SEASON}_{suffix}_filtered.csv"
    matches_df.to_csv(matches_path, index=False)
    print("✅ Saved:", matches_path, "rows:", len(matches_df))

    print("\nSample columns:", matches_df.columns.tolist()[:30])

if __name__ == "__main__":
    run()
