"""
Fetch live player data from the FPL API for real-time predictions.
This module fetches current gameweek data from the official FPL API and
prepares it for model inference, including injury/availability features.
"""

from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from pathlib import Path
import numpy as np
import pandas as pd
import requests
import re

# Paths
OUTPUT_DIR = Path("data/inference")

# FPL API endpoints
FPL_BASE_URL = "https://fantasy.premierleague.com/api"
BOOTSTRAP_URL = f"{FPL_BASE_URL}/bootstrap-static/"
FIXTURES_URL = f"{FPL_BASE_URL}/fixtures/"

# Feature engineering constants, must match build_extended_features.py exactly
HISTORY_NUM_COLS = [
    "total_points", "minutes", "starts",
    "expected_goals", "expected_assists", "expected_goal_involvements",
    "expected_goals_conceded", "influence", "creativity", "threat",
    "ict_index", "bps", "bonus",
]
SEASON_AVG_COLS = [
    "total_points", "minutes", "expected_goals", "expected_assists",
    "influence", "creativity", "threat", "bps",
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
    Determine the current/next gameweek from events data.
    Returns the GW that is currently active or the next upcoming one.
    """
    now = datetime.now()

    for event in events:
        deadline = datetime.fromisoformat(event["deadline_time"].replace("Z", "+00:00"))
        deadline = deadline.replace(tzinfo=None)  # Make naive for comparison

        if event["is_current"]:
            return event

        # If no current GW, find the next one
        if not event["finished"] and deadline > now:
            return event

    # Fallback: return the last event
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
        pass
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
        futures = {
            executor.submit(fetch_player_history, eid): eid
            for eid in element_ids
        }
        done = 0
        for future in as_completed(futures):
            eid = futures[future]
            try:
                result = future.result()
                if result is not None:
                    histories[eid] = result
            except Exception:
                pass
            done += 1
            if done % 100 == 0:
                print(f"    {done}/{total} fetched...")

    print(f"Fetched history for {len(histories)}/{total} players")
    return histories


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
            "bps": player["bps"], # bonus point system
            
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
            "ict_index": float(player["ict_index"]) if player["ict_index"] else 0.0, # Influence Creativity Threat
            
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
    features["points_momentum"] = (
        features.get("total_points_roll3", 0) - features.get("total_points_roll10", 0)
    )
    features["bps_momentum"] = (
        features.get("bps_roll3", 0) - features.get("bps_roll10", 0)
    )
    features["xg_momentum"] = (
        features.get("expected_goals_roll3", 0) - features.get("expected_goals_roll10", 0)
    )

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

    for col in ["consecutive_starts", "minutes_trend", "games_since_start",
                "points_momentum", "bps_momentum", "xg_momentum"]:
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
            feature_rows.append(
                _compute_player_features(player_history) if player_history else {}
            )

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

def fetch_current_gw_data(include_history: bool = True) -> pd.DataFrame:
    """Main function: Fetch all current player data ready for prediction.

    Args:
        include_history: If True (default), fetch per-player GW history for
                        accurate rolling features. Makes ~600 API calls
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


if __name__ == "__main__":
    run()
