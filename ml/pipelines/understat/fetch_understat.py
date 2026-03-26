# ml/pipelines/understat/fetch_understat.py
"""Scrape per-player match data from Understat for all EPL seasons.

Writes to data/raw/understat/:
    players_EPL_{YEAR}.csv              - league player table
    player_matches_EPL_{YEAR}_all_filtered.csv  - match rows (EPL only)

YEAR is the season start year (e.g. 2023 for 2023-24).
"""

import argparse
import asyncio
from pathlib import Path
from typing import Any

import aiohttp
import pandas as pd
from understat import Understat

from ml.config.seasons import SEASONS_ALL

OUT_DIR = Path("data/raw/understat")

LEAGUE = "EPL"


# fetch all league players for one season.
async def _get_league_players(understat: Understat, league: str, year: int) -> list[dict[str, Any]]:
    return await understat.get_league_players(league, year)


# fetch the set of valid team names for one league-season.
async def _get_teams(understat: Understat, league: str, year: int) -> set[str]:
    teams = await understat.get_teams(league, year)

    # Understat commonly uses "title" for team name; fallback to "name" if ever present.
    out = set()
    for t in teams:
        if "title" in t and t["title"]:
            out.add(t["title"])
        elif "name" in t and t["name"]:
            out.add(t["name"])
    return out


# fetch all match rows for one Understat player.
async def _get_player_matches(understat: Understat, player_id: int) -> list[dict[str, Any]]:
    return await understat.get_player_matches(player_id)


def _filter_matches(
    matches: list[dict[str, Any]],
    *,
    year: int,
    league: str,
    team_names: set[str],
    player_id: int,
) -> list[dict[str, Any]]:
    """
    keep only:
    - season == year
    - both h_team and a_team are in EPL team list for that year
    """
    filtered: list[dict[str, Any]] = []

    for r in matches:
        # keep only rows from the requested Understat season.
        try:
            if int(r.get("season", -1)) != year:
                continue
        except Exception:
            # skip rows with missing or invalid season values.
            continue

        # keep only matches where both teams belong to this league-season.
        if r.get("h_team") not in team_names:
            continue
        if r.get("a_team") not in team_names:
            continue

        # copy the row and attach metadata needed downstream.
        rr = dict(r)
        rr["us_player_id"] = player_id
        rr["league"] = league
        filtered.append(rr)

    return filtered


async def fetch_all(
    *,
    year: int,
    league: str,
    max_players: int | None,
    concurrency: int,
) -> None:

    OUT_DIR.mkdir(parents=True, exist_ok=True)

    # limit open connections and use generous timeouts for slower responses.
    connector = aiohttp.TCPConnector(limit=concurrency)
    timeout = aiohttp.ClientTimeout(total=None, sock_connect=30, sock_read=120)

    # reuse one HTTP session for the whole season fetch.
    async with aiohttp.ClientSession(connector=connector, timeout=timeout) as session:
        understat = Understat(session)

        print(f"fetching Understat players: {league} {year}/{str(year + 1)[-2:]}")
        players = await _get_league_players(understat, league, year)
        players_df = pd.DataFrame(players)

        # save the raw league player table for this season.
        players_path = OUT_DIR / f"players_{league}_{year}.csv"
        players_df.to_csv(players_path, index=False)
        print(f"saved: {players_path} rows: {len(players_df)}")

        print(f"fetching Understat team names: {league} {year}")
        team_names = await _get_teams(understat, league, year)
        print("teams (sample):", sorted(team_names)[:5], "... total:", len(team_names))

        # we need player ids to fetch player-level match histories.
        if players_df.empty or "id" not in players_df.columns:
            raise ValueError("Understat league players response missing 'id' column or is empty.")

        # minutes may arrive as strings, so convert first.
        # if we later limit players, this lets us prioritise the most active ones.
        if "minutes" in players_df.columns:
            players_df["minutes"] = pd.to_numeric(players_df["minutes"], errors="coerce")
            players_df = players_df.sort_values("minutes", ascending=False, na_position="last")

        # optional debug: only fetch the top N players.
        if max_players is not None:
            players_df = players_df.head(max_players).copy()

        # build the list of valid Understat player ids.
        player_ids = [int(x) for x in players_df["id"].tolist() if pd.notna(x)]
        print(f"fetching matches for {len(player_ids)} players... (concurrency={concurrency})")

        # limit how many player match requests run at the same time.
        sem = asyncio.Semaphore(concurrency)

        async def fetch_one(pid: int) -> list[dict[str, Any]]:
            async with sem:
                try:
                    m = await _get_player_matches(understat, pid)
                    return _filter_matches(
                        m,
                        year=year,
                        league=league,
                        team_names=team_names,
                        player_id=pid,
                    )
                except Exception as e:
                    # do not crash the whole season because one player failed.
                    print(f"failed player_id={pid}: {e}")
                    return []

        # run many player requests concurrently.
        chunks: list[list[dict[str, Any]]] = await asyncio.gather(*(fetch_one(pid) for pid in player_ids))

        # flatten the nested list: one list per player -> one combined list of rows.
        all_rows: list[dict[str, Any]] = [r for chunk in chunks for r in chunk]

        matches_df = pd.DataFrame(all_rows)

        # save the filtered player-match table for this season.
        matches_path = OUT_DIR / f"player_matches_{league}_{year}_all_filtered.csv"
        matches_df.to_csv(matches_path, index=False)

        print(f"saved: {matches_path} rows: {len(matches_df)}")
        if not matches_df.empty:
            print("sample columns:", matches_df.columns.tolist()[:30])
        else:
            print("no matches after filtering (check team names / season value / Understat data).")


def parse_args() -> argparse.Namespace:
    ap = argparse.ArgumentParser()
    ap.add_argument("--league", default=LEAGUE, help='Understat league code (default: "EPL")')

    ap.add_argument(
        "--max-players",
        type=int,
        default=None,
        help="Optional limit for number of players to fetch matches for (default: all).",
    )

    ap.add_argument(
        "--concurrency",
        type=int,
        default=15,
        help="How many concurrent player match requests (default: 15).",
    )

    return ap.parse_args()


def main() -> None:
    args = parse_args()

    for season in SEASONS_ALL:
        # Understat expects the start year of the season, e.g. 2023 for 2023-24.
        year = int(season.split("-")[0])
        print(f"\n=== Fetching Understat data for season {season} ===")

        asyncio.run(
            fetch_all(
                year=year,
                league=args.league,
                max_players=args.max_players,
                concurrency=max(1, int(args.concurrency)),
            )
        )


if __name__ == "__main__":
    main()
