"""
Fetch live player data from the FPL API for inference.

Calls the official FPL bootstrap-static endpoint to get all ~800 current
players, fetches per-player GW history (via ThreadPoolExecutor), computes
rolling/lag features to match the training format, adds injury features
from live status data, and optionally enriches with Understat xG features
from the pre-computed seasonal CSV.

Main entry point: fetch_current_gw_data() returns a DataFrame ready for predict.py.
Also provides fetch_fixtures(), fetch_user_team(), and format_player_history()
for the API's fixture, team, and player detail endpoints.
"""

import logging
import re
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from pathlib import Path

import numpy as np
import pandas as pd
import requests

logger = logging.getLogger(__name__)

# Paths
OUTPUT_DIR = Path("data/inference")

# FPL API endpoints
FPL_BASE_URL = "https://fantasy.premierleague.com/api"
BOOTSTRAP_URL = f"{FPL_BASE_URL}/bootstrap-static/"
FIXTURES_URL = f"{FPL_BASE_URL}/fixtures/"

# Feature engineering constants, must match build_extended_features.py exactly
HISTORY_NUM_COLS = [
    "total_points",
    "minutes",
    "starts",
    "expected_goals",
    "expected_assists",
    "expected_goal_involvements",
    "expected_goals_conceded",
    "influence",
    "creativity",
    "threat",
    "ict_index",
    "bps",
    "bonus",
]
SEASON_AVG_COLS = [
    "total_points",
    "minutes",
    "expected_goals",
    "expected_assists",
    "influence",
    "creativity",
    "threat",
    "bps",
]
ROLL_WINDOWS = [3, 5, 10]


def get_bootstrap_data() -> dict:

    # Fetch bootstrap-static data from FPL API.
    # Contains: all players, teams, gameweeks, game settings.
    print("Fetching FPL bootstrap-static data...")
    response = requests.get(BOOTSTRAP_URL)

    if response.status_code != 200:
        raise RuntimeError(f"FPL API error: {response.status_code}")

    return response.json()


def get_current_gameweek(events: list[dict]) -> dict:
    """
    Determine the next gameweek to predict for.
    For predictions we want the NEXT unplayed GW, not the one just finished.
    Priority: is_next > first unfinished > is_current > last event.
    """
    # Best case: FPL API marks the upcoming GW explicitly
    for event in events:
        if event.get("is_next"):
            return event

    # Fallback: first GW that isn't finished yet
    for event in events:
        if not event["finished"]:
            return event

    # Final fallback: whatever is current (end-of-season edge case)
    for event in events:
        if event["is_current"]:
            return event

    return events[-1]


def get_fixtures_for_gw(gw: int) -> pd.DataFrame:
    # Fetch fixtures for a specific gameweek.
    response = requests.get(FIXTURES_URL, params={"event": gw})

    if response.status_code != 200:
        return pd.DataFrame()

    fixtures = response.json()
    return pd.DataFrame(fixtures)


def build_team_lookup(teams: list[dict]) -> dict:
    # Build team ID to name/short_name lookup.
    return {
        t["id"]: {
            "name": t["name"],
            "short_name": t["short_name"],
            "strength": t["strength"],
        }
        for t in teams
    }


# -- Player History Fetching ---------------------------------------------------


def fetch_player_history(element_id: int) -> list[dict] | None:
    # Fetch per-GW history for a single player from /api/element-summary/{id}/
    url = f"{FPL_BASE_URL}/element-summary/{element_id}/"
    try:
        resp = requests.get(url, timeout=10)
        if resp.status_code == 200:
            return resp.json().get("history", [])
    except Exception:
        logger.debug("Failed to fetch history for element %d", element_id, exc_info=True)
    return None


def fetch_all_player_histories(
    element_ids: list[int],
    max_workers: int = 20,
) -> dict[int, list[dict]]:
    """Batch fetch per-GW histories for all players using a thread pool.
    Returns {element_id: [gw_dict, ...]} for players with history.
    ~600 players at 20 concurrent → ~30 seconds.
    """
    histories: dict[int, list[dict]] = {}
    total = len(element_ids)
    print(f"Fetching {total} player histories ({max_workers} concurrent)...")

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {executor.submit(fetch_player_history, eid): eid for eid in element_ids}
        for i, future in enumerate(as_completed(futures), 1):
            eid = futures[future]
            try:
                result = future.result()
                if result is not None:
                    histories[eid] = result
            except Exception:
                logger.debug("Failed to get result for element %d", eid, exc_info=True)
            if i % 100 == 0:
                print(f"    {i}/{total} fetched...")

    print(f"Fetched history for {len(histories)}/{total} players")
    return histories


def format_player_history(element_id: int, raw_history: list[dict] | None) -> dict:
    """Format raw FPL history into frontend-friendly shape, it takes the last 10 GWs of data and returns arrays for sparklines/charts.
    Handles missing history (new signings) and players with < 10 GWs.
    """
    empty = {
        "element": element_id,
        "pts_history": [],
        "pts_last5": [],
        "gw_labels": [],
        "minutes_history": [],
        "xg_history": [],
        "xa_history": [],
        "bonus_history": [],
    }
    if not raw_history:
        return empty

    last10 = raw_history[-10:]
    pts = [gw.get("total_points", 0) for gw in last10]
    return {
        "element": element_id,
        "pts_history": pts,
        "pts_last5": pts[-5:] if len(pts) >= 5 else pts,
        "gw_labels": [f"GW{gw.get('round', 0)}" for gw in last10],
        "minutes_history": [gw.get("minutes", 0) for gw in last10],
        "xg_history": [float(gw.get("expected_goals", 0)) for gw in last10],
        "xa_history": [float(gw.get("expected_assists", 0)) for gw in last10],
        "bonus_history": [gw.get("bonus", 0) for gw in last10],
    }


def fetch_and_format_player_history(element_id: int) -> dict:
    """Fetch + format a single player's history in one call."""
    raw = fetch_player_history(element_id)
    return format_player_history(element_id, raw)


def fetch_and_format_all_histories(
    element_ids: list[int],
    max_workers: int = 20,
) -> dict[int, dict]:
    """Batch fetch + format histories for all requested players, it returns {element_id: formatted_history_dict} for every element_id,
    including empty-history entries for players whose fetch failed.
    """
    raw_histories = fetch_all_player_histories(element_ids, max_workers)
    return {eid: format_player_history(eid, raw_histories.get(eid)) for eid in element_ids}


# -- Feature Extraction --------------------------------------------------------


def extract_player_features(
    elements: list[dict],
    teams: dict,
    current_gw: int,
    fixtures_df: pd.DataFrame,
    season: str = "2025-26",
) -> pd.DataFrame:
    """
    Extract features from FPL player data for the current gameweek.
    Features include:
    - Basic info (name, team, position, price)
    - Form and recent performance
    - Injury/availability status
    - Fixture difficulty
    """

    rows = []
    # Position mapping (FPL uses 1-4)
    pos_map = {1: "GK", 2: "DEF", 3: "MID", 4: "FWD"}

    for player in elements:
        team_id = player["team"]
        team_info = teams.get(team_id, {})

        # Find fixture for this team
        fixture = fixtures_df[(fixtures_df["team_h"] == team_id) | (fixtures_df["team_a"] == team_id)]

        if len(fixture) > 0:
            fixture = fixture.iloc[0]
            is_home = fixture["team_h"] == team_id
            opponent_id = fixture["team_a"] if is_home else fixture["team_h"]
            opponent_info = teams.get(opponent_id, {})
        else:
            is_home = None
            opponent_id = None
            opponent_info = {}

        row = {
            # Identifiers
            "element": player["id"],
            "first_name": player["first_name"],
            "second_name": player["second_name"],
            "name": f"{player['first_name']} {player['second_name']}",
            "web_name": player["web_name"],
            "season": season,
            "GW": current_gw,
            # Basic info
            "position": pos_map.get(player["element_type"], "UNK"),
            "team": team_id,
            "team_name": team_info.get("short_name", ""),
            "value": player["now_cost"] / 10.0,  # Convert to millions
            # Fixture info
            "was_home": 1 if is_home else 0 if is_home is not None else None,
            "opponent_team": opponent_id,
            "opponent_name": opponent_info.get("short_name", ""),
            # Form & performance (from API)
            "form": float(player["form"]) if player["form"] else 0.0,
            "points_per_game": float(player["points_per_game"]) if player["points_per_game"] else 0.0,
            "selected_by_percent": float(player["selected_by_percent"]) if player["selected_by_percent"] else 0.0,
            "total_points": player["total_points"],
            "minutes": player["minutes"],
            "goals_scored": player["goals_scored"],
            "assists": player["assists"],
            "clean_sheets": player["clean_sheets"],
            "goals_conceded": player["goals_conceded"],
            "bonus": player["bonus"],
            "bps": player["bps"],  # bonus point system
            # Expected stats
            "expected_goals": float(player["expected_goals"]) if player["expected_goals"] else 0.0,
            "expected_assists": float(player["expected_assists"]) if player["expected_assists"] else 0.0,
            "expected_goal_involvements": float(player["expected_goal_involvements"])
            if player["expected_goal_involvements"]
            else 0.0,
            "expected_goals_conceded": float(player["expected_goals_conceded"])
            if player["expected_goals_conceded"]
            else 0.0,
            # ICT index
            "influence": float(player["influence"]) if player["influence"] else 0.0,
            "creativity": float(player["creativity"]) if player["creativity"] else 0.0,
            "threat": float(player["threat"]) if player["threat"] else 0.0,
            "ict_index": float(player["ict_index"]) if player["ict_index"] else 0.0,  # Influence Creativity Threat
            # INJURY/AVAILABILITY FEATURES
            "status": player["status"],  # 'a', 'd', 'i', 'u', 's', 'n'
            "chance_of_playing_this_round": player["chance_of_playing_this_round"],
            "chance_of_playing_next_round": player["chance_of_playing_next_round"],
            "news": player["news"],
            "news_added": player["news_added"],
            # Transfers
            "transfers_in_event": player["transfers_in_event"],
            "transfers_out_event": player["transfers_out_event"],
        }

        rows.append(row)

    return pd.DataFrame(rows)


def add_injury_features(df: pd.DataFrame) -> pd.DataFrame:

    # Add engineered injury features matching the training data format.
    # These mirror the features from build_injury_features.py.
    df = df.copy()

    # Status encoding (higher = worse availability)
    status_map = {"a": 0, "d": 1, "i": 2, "u": 3, "s": 4, "n": 5}
    df["status_encoded"] = df["status"].map(status_map).fillna(0).astype(int)

    # Binary flags
    df["is_available"] = (df["status"] == "a").astype(int)
    df["is_injured"] = (df["status"] == "i").astype(int)
    df["is_doubtful"] = (df["status"] == "d").astype(int)

    # Chance of playing (fill NaN with 100 for available players)
    df["chance_this_round"] = df["chance_of_playing_this_round"].fillna(df["is_available"] * 100)
    df["chance_next_round"] = df["chance_of_playing_next_round"].fillna(df["is_available"] * 100)

    # Has news flag
    df["has_news"] = (df["news"].notna() & (df["news"] != "")).astype(int)

    # Injury type extraction patterns
    injury_patterns = {
        "hamstring": r"hamstring",
        "knee": r"knee|acl|mcl|pcl|meniscus",
        "ankle": r"ankle",
        "groin": r"groin|adductor",
        "calf": r"calf",
        "thigh": r"thigh|quad",
        "back": r"back|spine",
        "shoulder": r"shoulder",
        "foot": r"foot|toe|metatarsal",
        "illness": r"ill|virus|flu|covid|sick",
        "head": r"head|concussion",
        "muscle": r"muscle",
        "fitness": r"fitness|match fit",
        "personal": r"personal|family|compassionate",
        "loan": r"loan",
    }

    def extract_injury_type(news: str) -> str:
        if pd.isna(news) or news == "":
            return "none"
        news_lower = str(news).lower()
        for injury_type, pattern in injury_patterns.items():
            if re.search(pattern, news_lower):
                return injury_type
        if re.search(r"injur", news_lower):
            return "other_injury"
        return "other"

    def extract_return_weeks(news: str) -> float:
        if pd.isna(news) or news == "":
            return 0.0
        news_str = str(news)
        if re.search(r"unknown|indefinite", news_str, re.IGNORECASE):
            return 12.0
        match = re.search(r"(\d+)-(\d+)\s*weeks?", news_str, re.IGNORECASE)
        if match:
            return min((float(match.group(1)) + float(match.group(2))) / 2, 26.0)
        match = re.search(r"(\d+)\s*weeks?", news_str, re.IGNORECASE)
        if match:
            return min(float(match.group(1)), 26.0)
        return 2.0 if len(news_str) > 0 else 0.0

    def simple_sentiment(news: str) -> float:
        if pd.isna(news) or news == "":
            return 0.0
        news_lower = str(news).lower()
        negative = [
            "injury",
            "injured",
            "out",
            "miss",
            "ruled out",
            "sidelined",
            "surgery",
            "operation",
            "torn",
            "broken",
            "fracture",
            "unknown return",
            "indefinite",
            "long-term",
            "serious",
        ]
        positive = [
            "return",
            "back",
            "fit",
            "available",
            "training",
            "recovered",
            "cleared",
            "ready",
            "resumed",
            "minor",
        ]
        neg_count = sum(1 for word in negative if word in news_lower)
        pos_count = sum(1 for word in positive if word in news_lower)
        total = neg_count + pos_count
        return (pos_count - neg_count) / total if total > 0 else 0.0

    # Apply NLP extraction
    df["injury_type"] = df["news"].apply(extract_injury_type)
    df["expected_return_weeks"] = df["news"].apply(extract_return_weeks)
    df["news_sentiment"] = df["news"].apply(simple_sentiment)

    # One-hot encode injury types
    injury_types = [
        "none",
        "hamstring",
        "knee",
        "ankle",
        "groin",
        "calf",
        "thigh",
        "back",
        "shoulder",
        "foot",
        "illness",
        "head",
        "muscle",
        "fitness",
        "personal",
        "loan",
        "other",
        "other_injury",
    ]

    for itype in injury_types:
        df[f"injury_{itype}"] = (df["injury_type"] == itype).astype(int)

    return df


# -- Rolling Feature Computation -----------------------------------------------


def _compute_player_features(history: list[dict]) -> dict:
    # Compute all rolling/lag/availability features from a player's GW history.

    if not history:
        return {}

    sorted_gws = sorted(history, key=lambda x: x["round"])
    features: dict[str, float] = {}

    # Per-column lag, rolling, and season-avg features
    for col in HISTORY_NUM_COLS:
        values = [float(gw.get(col, 0) or 0) for gw in sorted_gws]
        n = len(values)

        # lag1 = last completed GW
        features[f"{col}_lag1"] = values[-1]

        # rollN = mean of last N completed GWs (min_periods=1)
        for w in ROLL_WINDOWS:
            window = values[-w:] if n >= w else values
            features[f"{col}_roll{w}"] = sum(window) / len(window)

        # season_avg = expanding mean of all completed GWs
        if col in SEASON_AVG_COLS:
            features[f"{col}_season_avg"] = sum(values) / n

    # played_lag1
    features["played_lag1"] = int(features.get("minutes_lag1", 0) > 0)

    # --- Availability features ---
    starts = [int(gw.get("starts", 0) or 0) for gw in sorted_gws]
    minutes_vals = [float(gw.get("minutes", 0) or 0) for gw in sorted_gws]

    # consecutive_starts: count backwards from last GW
    consec = 0
    for s in reversed(starts):
        if s == 1:
            consec += 1
        else:
            break
    features["consecutive_starts"] = consec

    # minutes_trend: (last - first) / max(first, 1) over last 3 GWs
    trend_w = minutes_vals[-3:] if len(minutes_vals) >= 3 else minutes_vals
    if len(trend_w) >= 2:
        features["minutes_trend"] = (trend_w[-1] - trend_w[0]) / max(trend_w[0], 1)
    else:
        features["minutes_trend"] = 0.0

    # games_since_start: count backwards until a start
    gss = 0
    for s in reversed(starts):
        if s == 1:
            break
        gss += 1
    features["games_since_start"] = gss

    # --- Momentum features (roll3 - roll10) ---
    features["points_momentum"] = features.get("total_points_roll3", 0) - features.get("total_points_roll10", 0)
    features["bps_momentum"] = features.get("bps_roll3", 0) - features.get("bps_roll10", 0)
    features["xg_momentum"] = features.get("expected_goals_roll3", 0) - features.get("expected_goals_roll10", 0)

    return features


def _fill_approximate_features(df: pd.DataFrame) -> None:
    """Fill any missing rolling/lag/availability features with API-based approximations.
    Used as fallback for players without GW history (new signings, etc).
    """
    games_played = (df["minutes"] / 90).clip(lower=1)

    for col in HISTORY_NUM_COLS:
        # Fallback value: season total / games played (per-game average)
        if col in df.columns:
            per_game = df[col] / games_played
        else:
            per_game = pd.Series(0, index=df.index)

        # lag1
        lag_col = f"{col}_lag1"
        if lag_col not in df.columns:
            df[lag_col] = per_game
        else:
            df[lag_col] = df[lag_col].fillna(per_game)

        # rollN — for total_points use form (per-game avg), otherwise per_game
        for w in ROLL_WINDOWS:
            roll_col = f"{col}_roll{w}"
            fallback = df["form"] if col == "total_points" and "form" in df.columns else per_game
            if roll_col not in df.columns:
                df[roll_col] = fallback
            else:
                df[roll_col] = df[roll_col].fillna(fallback)

        # season_avg
        if col in SEASON_AVG_COLS:
            avg_col = f"{col}_season_avg"
            if avg_col not in df.columns:
                df[avg_col] = per_game
            else:
                df[avg_col] = df[avg_col].fillna(per_game)

    # Binary / availability fallbacks
    if "played_lag1" not in df.columns:
        df["played_lag1"] = (df["minutes"] > 0).astype(int)
    else:
        df["played_lag1"] = df["played_lag1"].fillna((df["minutes"] > 0).astype(int))

    for col in [
        "consecutive_starts",
        "minutes_trend",
        "games_since_start",
        "points_momentum",
        "bps_momentum",
        "xg_momentum",
    ]:
        if col not in df.columns:
            df[col] = 0
        else:
            df[col] = df[col].fillna(0)


def compute_rolling_features(
    df: pd.DataFrame,
    histories: dict[int, list[dict]] | None = None,
) -> pd.DataFrame:
    """Compute rolling/lag/availability features for all players.
    When histories is provided (from fetch_all_player_histories), computes
    proper per-GW windowed features matching training exactly.
    Falls back to API-aggregate approximations for players without history.
    """
    df = df.copy()

    if histories:
        # Compute proper features from per-GW history for each player
        feature_rows = []
        for _, row in df.iterrows():
            eid = int(row["element"])
            player_history = histories.get(eid, [])
            feature_rows.append(_compute_player_features(player_history) if player_history else {})

        features_df = pd.DataFrame(feature_rows, index=df.index)

        # Merge computed features into df
        for col in features_df.columns:
            df[col] = features_df[col]

        n_with = sum(1 for eid in df["element"].astype(int) if histories.get(eid))
        print(f"  {n_with}/{len(df)} players with proper rolling features")
        if n_with < len(df):
            print(f"  {len(df) - n_with} players using fallback approximations")

    # Fill missing values for players without history (or when histories=None)
    _fill_approximate_features(df)

    return df


# --- Understat enrichment ---

US_BASE_COLS = [
    "us_xg",
    "us_xa",
    "us_npxg",
    "us_xgchain",
    "us_xgbuildup",
    "us_shots",
    "us_key_passes",
    "us_time",
]
US_ROLL_WINDOWS = [3, 5, 10]


def _fetch_live_understat(season: str, fpl_elements: list[dict]) -> pd.DataFrame | None:
    """Fetch current-season Understat data live and map to FPL element IDs.

    Returns a DataFrame with columns [element, GW, us_xg, us_xa, ...] or None on failure.
    """
    try:
        import asyncio

        import aiohttp
        from understat import Understat

        from ml.utils.name_normalize import norm
    except ImportError:
        logger.info("understat/aiohttp not installed, skipping live fetch")
        return None

    year = int(season.split("-")[0])
    US_MATCH_COLS = ["xG", "xA", "npxG", "xGChain", "xGBuildup", "shots", "key_passes", "time"]

    async def _fetch():
        connector = aiohttp.TCPConnector(limit=15)
        timeout = aiohttp.ClientTimeout(total=None, sock_connect=30, sock_read=120)
        async with aiohttp.ClientSession(connector=connector, timeout=timeout) as session:
            us = Understat(session)

            players = await us.get_league_players("EPL", year)
            if not players:
                return None

            teams = await us.get_teams("EPL", year)
            team_names = {t.get("title", t.get("name", "")) for t in teams}

            fpl_lookup = {}
            for p in fpl_elements:
                full = norm(f"{p['first_name']} {p['second_name']}")
                web = norm(p["web_name"])
                fpl_lookup[full] = p["id"]
                if len(web) >= 4:
                    fpl_lookup.setdefault(web, p["id"])

            us_to_fpl = {}
            for up in players:
                us_name = norm(up.get("player_name", ""))
                us_id = int(up["id"])
                if us_name in fpl_lookup:
                    us_to_fpl[us_id] = fpl_lookup[us_name]
                else:
                    tokens = us_name.split()
                    if len(tokens) >= 2:
                        surname = tokens[-1]
                        if len(surname) >= 4 and surname in fpl_lookup:
                            us_to_fpl[us_id] = fpl_lookup[surname]

            print(f"  Understat live: matched {len(us_to_fpl)}/{len(players)} players to FPL")

            sem = asyncio.Semaphore(15)
            matched_ids = list(us_to_fpl.keys())

            async def fetch_one(pid):
                async with sem:
                    try:
                        return await us.get_player_matches(pid)
                    except Exception:
                        return []

            all_matches = await asyncio.gather(*(fetch_one(pid) for pid in matched_ids))

            rows = []
            for pid, matches in zip(matched_ids, all_matches):
                fpl_id = us_to_fpl[pid]
                for m in matches:
                    try:
                        if int(m.get("season", -1)) != year:
                            continue
                    except (ValueError, TypeError):
                        continue
                    if m.get("h_team") not in team_names or m.get("a_team") not in team_names:
                        continue
                    row = {"element": fpl_id}
                    for col in US_MATCH_COLS:
                        row[col] = float(m.get(col, 0) or 0)
                    row["date"] = m.get("date", "")
                    rows.append(row)

            return rows

    def _run_in_thread():
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            return loop.run_until_complete(_fetch())
        finally:
            loop.close()

    try:
        print("  Fetching live Understat data...")
        from concurrent.futures import ThreadPoolExecutor as _TPE

        with _TPE(max_workers=1) as executor:
            rows = executor.submit(_run_in_thread).result(timeout=120)

        if not rows:
            return None

        matches_df = pd.DataFrame(rows)

        gw_windows_path = Path(f"data/processed/fpl/gw_windows_{season}.csv")
        if gw_windows_path.exists():
            gw_win = pd.read_csv(gw_windows_path)
            gw_win["start_date"] = pd.to_datetime(gw_win["start_date"])
            gw_win["end_date"] = pd.to_datetime(gw_win["end_date"])
            matches_df["match_date"] = pd.to_datetime(matches_df["date"].str[:10])

            def assign_gw(match_date):
                for _, gw_row in gw_win.iterrows():
                    if gw_row["start_date"] - pd.Timedelta(days=1) <= match_date <= gw_row["end_date"] + pd.Timedelta(days=1):
                        return int(gw_row["GW"])
                return None

            matches_df["GW"] = matches_df["match_date"].apply(assign_gw)
            matches_df = matches_df.dropna(subset=["GW"])
            matches_df["GW"] = matches_df["GW"].astype(int)
        else:
            logger.warning("GW windows not found at %s, cannot assign GWs", gw_windows_path)
            return None

        agg = matches_df.groupby(["element", "GW"], as_index=False)[US_MATCH_COLS].sum()
        agg = agg.rename(columns={c: f"us_{c.lower()}" for c in US_MATCH_COLS})

        print(f"  Understat live: {len(agg)} player-GW rows from {len(matches_df)} matches")
        return agg

    except Exception as e:
        logger.warning("Live Understat fetch failed: %s", e, exc_info=True)
        return None


def enrich_with_understat(
    df: pd.DataFrame,
    current_gw: int,
    season: str = "2025-26",
    fpl_elements: list[dict] | None = None,
) -> pd.DataFrame:
    """Enrich live player data with Understat features.

    Tries live Understat API fetch first; falls back to pre-computed CSV.
    Computes lag1 + rolling features to match training.
    """
    us = None

    if fpl_elements:
        live_us = _fetch_live_understat(season, fpl_elements)
        if live_us is not None and not live_us.empty:
            us = live_us
            print("  Using live Understat data")

    if us is None:
        us_path = Path(f"data/processed/understat/understat_gw_{season}.csv")
        if not us_path.exists():
            logger.warning("Understat CSV not found at %s, skipping", us_path)
            return df
        us = pd.read_csv(us_path, low_memory=False)
        print("  Using pre-computed Understat CSV")

    us["GW"] = pd.to_numeric(us["GW"], errors="coerce")
    us["element"] = pd.to_numeric(us["element"], errors="coerce")
    for col in US_BASE_COLS:
        us[col] = pd.to_numeric(us[col], errors="coerce").fillna(0)

    us = us[us["GW"] < current_gw].sort_values(["element", "GW"])
    if us.empty:
        logger.warning("No Understat data before GW %d, skipping", current_gw)
        return df

    all_gws = range(1, current_gw + 1)
    elements = us["element"].unique()
    idx = pd.MultiIndex.from_product([elements, all_gws], names=["element", "GW"])
    full = pd.DataFrame(index=idx).reset_index()
    full = full.merge(us[["element", "GW"] + US_BASE_COLS], on=["element", "GW"], how="left")
    full = full.sort_values(["element", "GW"])

    g = full.groupby("element", sort=False)
    for col in US_BASE_COLS:
        full[f"{col}_lag1"] = g[col].shift(1)
        for w in US_ROLL_WINDOWS:
            full[f"{col}_roll{w}"] = g[col].transform(
                lambda x, _w=w: x.shift(1).rolling(window=_w, min_periods=1).mean()
            )

    latest = full[full["GW"] == current_gw].copy()
    feat_cols = [c for c in latest.columns if c.endswith(("_lag1", "_roll3", "_roll5", "_roll10"))]
    feat = latest[["element"] + feat_cols]

    df = df.copy()
    df["element"] = pd.to_numeric(df["element"], errors="coerce")
    existing_us = [c for c in df.columns if c.startswith("us_")]
    if existing_us:
        df.drop(columns=existing_us, errors="ignore", inplace=True)

    df = df.merge(feat, on="element", how="left")

    us_cols = [c for c in df.columns if c.startswith("us_")]
    df[us_cols] = df[us_cols].fillna(0)

    matched = (df["us_xg_roll5"] > 0).sum()
    print(f"  Understat: {matched}/{len(df)} players enriched")

    return df


def enrich_with_news(df: pd.DataFrame, bootstrap_data: dict) -> pd.DataFrame:
    """Add live Guardian news features matching the 8 training columns."""
    NEWS_COLS = [
        "news_mentioned", "news_mention_count", "news_title_mentions",
        "news_avg_relevance", "news_sentiment_pos", "news_sentiment_neg",
        "news_injury_context", "news_sentiment",
    ]

    try:
        from ml.pipelines.inference.news import fetch_recent_news
    except ImportError:
        logger.info("News module not available, skipping")
        for col in NEWS_COLS:
            if col not in df.columns:
                df[col] = 0
        return df

    try:
        result = fetch_recent_news(bootstrap_data, days=7)
        articles = result.get("articles", [])

        if not articles:
            print("  News: no articles found, zero-filling")
            for col in NEWS_COLS:
                if col not in df.columns:
                    df[col] = 0
            return df

        player_features = {}
        for article in articles:
            for player in article.get("players", []):
                eid = player["element"]
                if eid not in player_features:
                    player_features[eid] = {
                        "mention_count": 0,
                        "title_mentions": 0,
                        "relevances": [],
                        "sentiments_pos": [],
                        "sentiments_neg": [],
                        "injury_contexts": 0,
                        "sentiments_raw": [],
                    }
                pf = player_features[eid]
                pf["mention_count"] += 1
                headline = article.get("headline", "")
                if player.get("web_name", "???") in headline:
                    pf["title_mentions"] += 1
                sent = article.get("sentiment", 0.0)
                pf["sentiments_raw"].append(sent)
                pf["sentiments_pos"].append(max(sent, 0))
                pf["sentiments_neg"].append(abs(min(sent, 0)))
                pf["relevances"].append(3.0 if pf["title_mentions"] > 0 else 1.0)
                if article.get("injury_flag", False):
                    pf["injury_contexts"] += 1

        rows = []
        for eid, pf in player_features.items():
            n = pf["mention_count"]
            rows.append({
                "element": eid,
                "news_mentioned": 1,
                "news_mention_count": n,
                "news_title_mentions": pf["title_mentions"],
                "news_avg_relevance": sum(pf["relevances"]) / n if n else 0,
                "news_sentiment_pos": sum(pf["sentiments_pos"]) / n if n else 0,
                "news_sentiment_neg": sum(pf["sentiments_neg"]) / n if n else 0,
                "news_injury_context": min(pf["injury_contexts"], 1),
                "news_sentiment": sum(pf["sentiments_raw"]) / n if n else 0,
            })

        news_df = pd.DataFrame(rows)

        existing = [c for c in df.columns if c.startswith("news_") and c in NEWS_COLS]
        if existing:
            df = df.drop(columns=existing)

        df = df.merge(news_df, on="element", how="left")

        for col in NEWS_COLS:
            if col in df.columns:
                df[col] = df[col].fillna(0)
            else:
                df[col] = 0

        mentioned = (df["news_mentioned"] > 0).sum()
        print(f"  News: {mentioned}/{len(df)} players with mentions from {len(articles)} articles")

    except Exception as e:
        logger.warning("News enrichment failed: %s", e, exc_info=True)
        for col in NEWS_COLS:
            if col not in df.columns:
                df[col] = 0

    return df


def add_temporal_injury_features(
    df: pd.DataFrame,
    histories: dict[int, list[dict]] | None = None,
) -> pd.DataFrame:
    """Add temporal injury features approximated from GW history.
    Mirrors build_injury_features.py: consecutive_gws_out, gws_since_last_injury,
    injury_count_season, chance_delta, recovery_trajectory.
    """
    df = df.copy()

    if not histories:
        # No history — use defaults matching FILL_DEFAULTS in build_injury_features.py
        df["consecutive_gws_out"] = np.where(df["status"] == "a", 0, 1)
        df["gws_since_last_injury"] = np.where(df["status"] == "i", 0, 38)
        df["injury_count_season"] = 0
        df["chance_delta"] = 0.0
        df["recovery_trajectory"] = 0.0
        return df

    consec_out = []
    gws_since_inj = []
    inj_count = []

    for _, row in df.iterrows():
        eid = int(row["element"])
        history = histories.get(eid, [])
        current_status = row.get("status", "a")

        if not history:
            consec_out.append(0 if current_status == "a" else 1)
            gws_since_inj.append(0 if current_status == "i" else 38)
            inj_count.append(0)
            continue

        sorted_gws = sorted(history, key=lambda x: x["round"])
        minutes_list = [float(gw.get("minutes", 0) or 0) for gw in sorted_gws]

        # consecutive_gws_out: count backwards where minutes == 0
        if current_status == "a":
            consec_out.append(0)
        else:
            c = 0
            for m in reversed(minutes_list):
                if m == 0:
                    c += 1
                else:
                    break
            consec_out.append(c + 1)  # +1 for the upcoming GW

        # gws_since_last_injury: approximate from zero-minute GWs
        if current_status == "i":
            gws_since_inj.append(0)
        else:
            last_zero = None
            for i, m in enumerate(reversed(minutes_list)):
                if m == 0:
                    last_zero = i + 1
                    break
            gws_since_inj.append(last_zero if last_zero is not None else 38)

        # injury_count_season: count transitions from playing to not playing
        episodes = 0
        prev_played = True
        for m in minutes_list:
            played = m > 0
            if not played and prev_played:
                episodes += 1
            prev_played = played
        inj_count.append(episodes)

    df["consecutive_gws_out"] = consec_out
    df["gws_since_last_injury"] = gws_since_inj
    df["injury_count_season"] = inj_count
    # Cannot compute accurately without per-GW chance_of_playing history
    df["chance_delta"] = 0.0
    df["recovery_trajectory"] = 0.0

    return df


# -- Main Fetch Pipeline -------------------------------------------------------


def fetch_current_gw_data(include_history: bool = True, include_understat: bool = True) -> pd.DataFrame:
    """Main function: Fetch all current player data ready for prediction.

    Args:
        include_history: If True (default), fetch per-player GW history for
                        accurate rolling features. Makes ~600 API calls
        include_understat: If True (default), enrich with Understat xG/xA features
                          from pre-computed CSV
    Returns:
        DataFrame with all players and features for current GW.
    """

    # Get bootstrap data
    bootstrap = get_bootstrap_data()

    # Extract components
    elements = bootstrap["elements"]
    teams_data = bootstrap["teams"]
    events = bootstrap["events"]

    print(f"Found {len(elements)} players")
    print(f"Found {len(teams_data)} teams")

    # Get current gameweek
    current_gw_info = get_current_gameweek(events)
    current_gw = current_gw_info["id"]
    print(f"Current gameweek: {current_gw}")

    # Derive season string from GW1 deadline (e.g. Aug 2025 → "2025-26")
    gw1_deadline = events[0]["deadline_time"]
    gw1_year = int(gw1_deadline[:4])
    season = f"{gw1_year}-{str(gw1_year + 1)[-2:]}"
    print(f"Season: {season}")

    # Get fixtures
    fixtures_df = get_fixtures_for_gw(current_gw)
    print(f"Found {len(fixtures_df)} fixtures for GW{current_gw}")

    # Build team lookup
    teams = build_team_lookup(teams_data)

    # Extract player features
    print("Extracting player features...")
    df = extract_player_features(elements, teams, current_gw, fixtures_df, season)

    # Fetch per-player GW histories for proper rolling features
    histories = None
    if include_history:
        print("Fetching player histories for rolling features...")
        element_ids = [p["id"] for p in elements]
        histories = fetch_all_player_histories(element_ids)

    # Add injury features (structured + NLP from current news)
    print("Adding injury features...")
    df = add_injury_features(df)

    # Add temporal injury features (from GW history)
    print("Adding temporal injury features...")
    df = add_temporal_injury_features(df, histories)

    # Compute rolling/lag/availability features
    print("Computing rolling features...")
    df = compute_rolling_features(df, histories=histories)

    if include_understat:
        print("Adding Understat features...")
        df = enrich_with_understat(df, current_gw, season=season, fpl_elements=elements)

    print(f"Final shape: {df.shape}")

    return df


def run():
    # Main entry point - fetch and save live data.

    print("=" * 60)
    print("FETCH LIVE FPL DATA")
    print("=" * 60)
    print(f"Timestamp: {datetime.now().isoformat()}")
    print()

    # Fetch data
    df = fetch_current_gw_data()

    # Save output
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    output_file = OUTPUT_DIR / "live_players.csv"
    df.to_csv(output_file, index=False)

    # Summary
    print()
    print("=" * 60)
    print("FETCH COMPLETE")
    print("=" * 60)
    print(f"Output: {output_file}")
    print(f"Players: {len(df)}")
    print(f"Columns: {len(df.columns)}")

    # Availability summary
    print("\nAvailability summary:")
    print(df["status"].value_counts().to_string())

    # Players with injury news
    with_news = df[df["has_news"] == 1]
    print(f"\nPlayers with injury news: {len(with_news)}")
    if len(with_news) > 0:
        print(with_news[["web_name", "team_name", "status", "news"]].head(10).to_string(index=False))

    # Top form players
    print("\nTop 10 players by form:")
    print(df.nlargest(10, "form")[["web_name", "team_name", "position", "form", "total_points"]].to_string(index=False))


def fetch_fixtures(bootstrap_data: dict | None = None, num_gws: int = 6) -> dict:
    """Fetch upcoming fixtures and build per-team FDR grid.
    returns {
        teams: ["ARS", ...],
        team_full: {ARS: "Arsenal", ...},
        fixtures: {ARS: [{gw, opponent, home, atkFdr, defFdr}, ...], ...},
        current_gw: int,
    }
    """
    if bootstrap_data is None:
        bootstrap_data = get_bootstrap_data()

    # team maps: id -> short_name, id -> full name
    team_short = {t["id"]: t["short_name"] for t in bootstrap_data["teams"]}
    team_full = {t["short_name"]: t["name"] for t in bootstrap_data["teams"]}

    # current GW
    current_event = get_current_gameweek(bootstrap_data["events"])
    current_gw = current_event["id"]

    # target GWs
    target_gws = list(range(current_gw, current_gw + num_gws))

    # fetch all fixtures
    response = requests.get(FIXTURES_URL)
    if response.status_code != 200:
        raise RuntimeError(f"FPL fixtures API error: {response.status_code}")
    all_fixtures = response.json()

    # filter to target GWs (event != None and in range)
    upcoming = [f for f in all_fixtures if f.get("event") in target_gws and not f.get("finished", False)]

    # build per-team fixture grid
    fixtures_by_team: dict[str, list] = {short: [] for short in team_short.values()}

    for f in upcoming:
        home_id = f["team_h"]
        away_id = f["team_a"]
        gw = f["event"]
        home_short = team_short[home_id]
        away_short = team_short[away_id]

        # home team's fixture
        # NOTE: FPL API only provides one overall difficulty per team per fixture,
        # not separate attack/defence ratings. atkFdr = this team's difficulty,
        # defFdr = opponent's difficulty (used as a proxy for defensive challenge).
        fixtures_by_team[home_short].append(
            {
                "gw": gw,
                "opponent": away_short,
                "home": True,
                "atkFdr": f["team_h_difficulty"],
                "defFdr": f["team_a_difficulty"],
            }
        )

        # away team's fixture
        fixtures_by_team[away_short].append(
            {
                "gw": gw,
                "opponent": home_short,
                "home": False,
                "atkFdr": f["team_a_difficulty"],
                "defFdr": f["team_h_difficulty"],
            }
        )

    # sort each team's fixtures by GW
    for team_fixtures in fixtures_by_team.values():
        team_fixtures.sort(key=lambda x: x["gw"])

    teams_sorted = sorted(fixtures_by_team.keys())

    return {
        "teams": teams_sorted,
        "team_full": team_full,
        "fixtures": fixtures_by_team,
        "current_gw": current_gw,
    }


def get_player_fdr(fixtures_by_team: dict, team: str, num_gws: int = 6) -> list[dict]:
    # Get a player's upcoming fixtures with FDR
    return fixtures_by_team.get(team, [])[:num_gws]


def get_player_fdr_avg(fixtures_by_team: dict, team: str, mode: str = "combined") -> float:
    """Average FDR for a team over upcoming fixtures.
    mode: 'attack', 'defence', or 'combined'
    """
    team_fixtures = fixtures_by_team.get(team, [])
    if not team_fixtures:
        return 3.0  # neutral default
    if mode == "attack":
        values = [f["atkFdr"] for f in team_fixtures]
    elif mode == "defence":
        values = [f["defFdr"] for f in team_fixtures]
    else:
        values = [(f["atkFdr"] + f["defFdr"]) / 2 for f in team_fixtures]
    return round(sum(values) / len(values), 2)


def fetch_user_team(fpl_id: int) -> dict:
    """Fetch a user's FPL team picks for the latest finished gameweek.
    it returns manager info + 15 picks with captain, vice, multiplier.
    Uses the latest finished GW because the picks endpoint only works for played GWs.
    """
    bootstrap = get_bootstrap_data()
    events = bootstrap["events"]

    # find latest finished GW (picks only exist for played GWs)
    latest_finished = None
    for e in events:
        if e["finished"]:
            latest_finished = e
    if latest_finished is None:
        raise RuntimeError("No finished gameweeks yet")
    picks_gw = latest_finished["id"]

    # the upcoming GW for predictions
    upcoming_gw_info = get_current_gameweek(events)
    upcoming_gw = upcoming_gw_info["id"]

    # fetch manager entry info
    entry_url = f"{FPL_BASE_URL}/entry/{fpl_id}/"
    resp = requests.get(entry_url)
    if resp.status_code != 200:
        raise RuntimeError(f"FPL entry API error: {resp.status_code}")
    entry = resp.json()

    # fetch picks for latest finished GW (= user's current squad)
    picks_url = f"{FPL_BASE_URL}/entry/{fpl_id}/event/{picks_gw}/picks/"
    resp = requests.get(picks_url)
    if resp.status_code != 200:
        raise RuntimeError(f"FPL picks API error: {resp.status_code}")
    picks_data = resp.json()

    # extract pick details
    picks = []
    for p in picks_data["picks"]:
        picks.append(
            {
                "element": p["element"],
                "position": p["position"],  # squad position 1-15 (1-11 = starting)
                "multiplier": p["multiplier"],  # 0=benched, 1=normal, 2=captain, 3=TC
                "is_captain": p["is_captain"],
                "is_vice_captain": p["is_vice_captain"],
            }
        )

    return {
        "fpl_id": fpl_id,
        "manager": f"{entry['player_first_name']} {entry['player_last_name']}",
        "team_name": entry.get("name", ""),
        "overall_rank": entry.get("summary_overall_rank"),
        "overall_points": entry.get("summary_overall_points"),
        "bank": picks_data.get("entry_history", {}).get("bank", 0) / 10,  # £m
        "total_value": picks_data.get("entry_history", {}).get("value", 0) / 10,  # £m
        "gameweek": upcoming_gw,  # the GW we're predicting for
        "picks_gameweek": picks_gw,  # the GW picks were fetched from
        "active_chip": picks_data.get("active_chip"),
        "picks": picks,
    }


if __name__ == "__main__":
    run()
