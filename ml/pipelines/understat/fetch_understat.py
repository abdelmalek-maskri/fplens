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

# ---------------------------------------------------------------------------
OUT_DIR = Path("data/raw/understat")

LEAGUE = "EPL"
# ---------------------------------------------------------------------------


async def _get_league_players(understat: Understat, league: str, year: int) -> list[dict[str, Any]]:
    """Every player Understat lists for one league-season."""
    return await understat.get_league_players(league, year)


async def _get_teams(understat: Understat, league: str, year: int) -> set[str]:
    """The club names Understat uses for one league-season."""
    teams = await understat.get_teams(league, year)

    # Understat names the field "title", but has used "name" in older
    # seasons, and a season that returns neither would silently filter out
    # every match below.
    out = set()
    for t in teams:
        if "title" in t and t["title"]:
            out.add(t["title"])
        elif "name" in t and t["name"]:
            out.add(t["name"])
    return out


async def _get_player_matches(understat: Understat, player_id: int) -> list[dict[str, Any]]:
    """One player's full match history, across all competitions."""
    return await understat.get_player_matches(player_id)


def _filter_matches(
    matches: list[dict[str, Any]],
    *,
    year: int,
    league: str,
    team_names: set[str],
    player_id: int,
) -> list[dict[str, Any]]:
    """Keep only this season's Premier League matches for one player.

    A player's Understat history spans every competition and club they have
    ever played for, so most of what comes back belongs to another league or
    another year.
    """
    filtered: list[dict[str, Any]] = []

    for r in matches:
        try:
            if int(r.get("season", -1)) != year:
                continue
        except Exception:
            # A row with no usable season cannot be placed, and one bad row
            # should not end the player.
            continue

        # Both clubs, not either: a cup tie against a Premier League side is
        # not a Premier League match.
        if r.get("h_team") not in team_names:
            continue
        if r.get("a_team") not in team_names:
            continue

        # Copied rather than mutated, because the caller still holds the
        # original list.
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
    """Scrape one season's players and their match histories."""
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    # No total timeout: a season is hundreds of requests and the whole run
    # legitimately takes minutes. The per-socket limits are what catch a
    # connection that has actually stalled.
    connector = aiohttp.TCPConnector(limit=concurrency)
    timeout = aiohttp.ClientTimeout(total=None, sock_connect=30, sock_read=120)

    async with aiohttp.ClientSession(connector=connector, timeout=timeout) as session:
        understat = Understat(session)

        print(f"fetching Understat players: {league} {year}/{str(year + 1)[-2:]}")
        players = await _get_league_players(understat, league, year)
        players_df = pd.DataFrame(players)

        # Written before the matches, so a run that fails partway still
        # leaves the player table and does not have to re-fetch it.
        players_path = OUT_DIR / f"players_{league}_{year}.csv"
        players_df.to_csv(players_path, index=False)
        print(f"saved: {players_path} rows: {len(players_df)}")

        print(f"fetching Understat team names: {league} {year}")
        team_names = await _get_teams(understat, league, year)
        print("teams (sample):", sorted(team_names)[:5], "... total:", len(team_names))

        # Without ids there is nothing to fetch matches for, so this fails
        # loudly rather than writing an empty match file.
        if players_df.empty or "id" not in players_df.columns:
            raise ValueError("Understat league players response missing 'id' column or is empty.")

        # Sorted by minutes so that --max-players takes the players who
        # actually played rather than whoever Understat listed first.
        if "minutes" in players_df.columns:
            players_df["minutes"] = pd.to_numeric(players_df["minutes"], errors="coerce")
            players_df = players_df.sort_values("minutes", ascending=False, na_position="last")

        if max_players is not None:
            players_df = players_df.head(max_players).copy()

        player_ids = [int(x) for x in players_df["id"].tolist() if pd.notna(x)]
        print(f"fetching matches for {len(player_ids)} players... (concurrency={concurrency})")

        # Understat is a free site nobody here pays for, so the request rate
        # is capped rather than left to asyncio.gather below.
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
                    # One unreachable player costs that player's rows, not
                    # the other 500 already fetched.
                    print(f"failed player_id={pid}: {e}")
                    return []

        chunks: list[list[dict[str, Any]]] = await asyncio.gather(*(fetch_one(pid) for pid in player_ids))

        all_rows: list[dict[str, Any]] = [r for chunk in chunks for r in chunk]

        matches_df = pd.DataFrame(all_rows)

        matches_path = OUT_DIR / f"player_matches_{league}_{year}_all_filtered.csv"
        matches_df.to_csv(matches_path, index=False)

        print(f"saved: {matches_path} rows: {len(matches_df)}")
        if not matches_df.empty:
            print("sample columns:", matches_df.columns.tolist()[:30])
        else:
            print("no matches after filtering (check team names / season value / Understat data).")


def parse_args() -> argparse.Namespace:
    """Command-line options, mainly for limiting a debug run."""
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
    """Scrape Understat for every season."""
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
