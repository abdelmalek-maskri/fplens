# ml/pipelines/features/build_future_fixtures.py
"""
Add future fixture features for multi-horizon prediction.

For each training row at gameweek G, looks up the opponent and home/away
status for GW G+2 and G+3. Also adds opponent FDR derived from per-season
team strength ratings (from FPL API teams.csv).
"""

from pathlib import Path

import numpy as np
import pandas as pd

VAASTAV_DIR = Path("data/raw/fpl/vaastav_snapshot_2025-12-30")

# Seasons where teams.csv with strength ratings exists
STRENGTH_SEASONS_START = "2019-20"


def load_team_strengths() -> dict[str, pd.DataFrame]:
    """Load per-season team strength ratings from vaastav teams.csv.
    Returns:
        dict mapping season string → DataFrame with columns:
        [id, strength, strength_attack_home, strength_attack_away,
         strength_defence_home, strength_defence_away]
    """
    strengths = {}
    for season_dir in sorted(VAASTAV_DIR.iterdir()):
        if not season_dir.is_dir():
            continue
        teams_file = season_dir / "teams.csv"
        if not teams_file.exists():
            continue
        season = season_dir.name
        df = pd.read_csv(teams_file)
        if "strength" not in df.columns:
            continue
        keep = ["id", "strength"]
        for col in [
            "strength_attack_home",
            "strength_attack_away",
            "strength_defence_home",
            "strength_defence_away",
        ]:
            if col in df.columns:
                keep.append(col)
        strengths[season] = df[keep].copy()
    return strengths


def build_fixture_schedule(df: pd.DataFrame) -> pd.DataFrame:
    """Build a fixture schedule lookup from the training data.

    Each row in the training data already contains (season, GW, team,
    opponent_team, was_home). We deduplicate to get the fixture schedule,
    then shift within (season, team) groups to produce future fixtures.

    Returns:
        DataFrame with columns: season, GW, team, opponent_team, was_home,
        opponent_gw2, was_home_gw2, opponent_gw3, was_home_gw3
    """
    schedule = (
        df[["season", "GW", "team", "opponent_team", "was_home"]]
        .drop_duplicates(subset=["season", "GW", "team"])
        .sort_values(["season", "team", "GW"])
        .copy()
    )

    g = schedule.groupby(["season", "team"], sort=False)
    schedule["opponent_gw2"] = g["opponent_team"].shift(-2)
    schedule["was_home_gw2"] = g["was_home"].shift(-2)
    schedule["opponent_gw3"] = g["opponent_team"].shift(-3)
    schedule["was_home_gw3"] = g["was_home"].shift(-3)

    return schedule


def compute_fdr(
    schedule: pd.DataFrame,
    strengths: dict[str, pd.DataFrame],
) -> pd.DataFrame:
    """Add FDR columns based on opponent team strength ratings.

    For each future fixture (GW+2, GW+3), adds:
    - fdr_gw{k}: Overall opponent strength (1-5 scale)
    - fdr_attack_gw{k}: Opponent's attack strength (1000-scale, normalized)
    - fdr_defence_gw{k}: Opponent's defence strength (1000-scale, normalized)

    The attack/defence split lets the model learn that:
    - GK/DEF care about opponent ATTACK strength (conceding goals)
    - MID/FWD care about opponent DEFENCE strength (scoring goals)
    """
    for k in [2, 3]:
        opp_col = f"opponent_gw{k}"
        home_col = f"was_home_gw{k}"
        fdr_col = f"fdr_gw{k}"
        fdr_atk_col = f"fdr_attack_gw{k}"
        fdr_def_col = f"fdr_defence_gw{k}"

        # Initialize with neutral defaults
        schedule[fdr_col] = np.nan
        schedule[fdr_atk_col] = np.nan
        schedule[fdr_def_col] = np.nan

        for season, sdf in strengths.items():
            mask = schedule["season"] == season
            if not mask.any():
                continue

            # Map opponent ID → strength
            strength_map = sdf.set_index("id")["strength"].to_dict()
            schedule.loc[mask, fdr_col] = schedule.loc[mask, opp_col].map(strength_map)

            # Attack/defence strength of the opponent (home/away aware)
            # When player is at HOME, opponent is AWAY → use opponent's away strengths
            # When player is AWAY, opponent is at HOME → use opponent's home strengths
            if "strength_attack_home" in sdf.columns:
                atk_home = sdf.set_index("id")["strength_attack_home"].to_dict()
                atk_away = sdf.set_index("id")["strength_attack_away"].to_dict()
                def_home = sdf.set_index("id")["strength_defence_home"].to_dict()
                def_away = sdf.set_index("id")["strength_defence_away"].to_dict()

                home_mask = mask & (schedule[home_col] == True)  # noqa: E712
                away_mask = mask & (schedule[home_col] == False)  # noqa: E712

                # Player at home → opponent is away
                schedule.loc[home_mask, fdr_atk_col] = schedule.loc[home_mask, opp_col].map(atk_away)
                schedule.loc[home_mask, fdr_def_col] = schedule.loc[home_mask, opp_col].map(def_away)

                # Player away → opponent is at home
                schedule.loc[away_mask, fdr_atk_col] = schedule.loc[away_mask, opp_col].map(atk_home)
                schedule.loc[away_mask, fdr_def_col] = schedule.loc[away_mask, opp_col].map(def_home)

        # Fill missing (early seasons without teams.csv) with neutral
        schedule[fdr_col] = schedule[fdr_col].fillna(3)
        # Normalize attack/defence to 0-1 scale (1000-1400 range → 0-1)
        for col in [fdr_atk_col, fdr_def_col]:
            schedule[col] = schedule[col].fillna(1200)  # neutral midpoint
            schedule[col] = (schedule[col] - 900) / 500  # ~0.2 to ~1.0

    return schedule


def add_future_fixture_features(df: pd.DataFrame) -> pd.DataFrame:
    """Add future fixture features to the training DataFrame.

    For each row at GW G, adds:
    - opponent_gw2, opponent_gw3: opponent team ID in GW G+2/G+3
    - was_home_gw2, was_home_gw3: home/away flag
    - fdr_gw2, fdr_gw3: overall FDR (1-5)
    - fdr_attack_gw2, fdr_attack_gw3: opponent attack strength (normalized)
    - fdr_defence_gw2, fdr_defence_gw3: opponent defence strength (normalized)

    Args:
        df: Training DataFrame with season, GW, team, opponent_team, was_home columns.

    Returns:
        DataFrame with future fixture columns added.
    """
    print("building fixture schedule...")
    schedule = build_fixture_schedule(df)

    print("loading team strength ratings...")
    strengths = load_team_strengths()
    print(f"found strength data for {len(strengths)} seasons: {sorted(strengths.keys())}")

    print("computing FDR from opponent strengths...")
    schedule = compute_fdr(schedule, strengths)

    # Merge back to main DataFrame on (season, GW, team)
    fixture_cols = [
        "season",
        "GW",
        "team",
        "opponent_gw2",
        "was_home_gw2",
        "opponent_gw3",
        "was_home_gw3",
        "fdr_gw2",
        "fdr_gw3",
        "fdr_attack_gw2",
        "fdr_attack_gw3",
        "fdr_defence_gw2",
        "fdr_defence_gw3",
    ]
    fixture_features = schedule[fixture_cols].drop_duplicates(subset=["season", "GW", "team"])

    before_cols = len(df.columns)
    df = df.merge(fixture_features, on=["season", "GW", "team"], how="left")

    new_cols = len(df.columns) - before_cols
    print(f"  Added {new_cols} future fixture features")

    # Convert boolean home/away to int for the model
    for col in ["was_home_gw2", "was_home_gw3"]:
        if col in df.columns:
            df[col] = df[col].astype(float).fillna(0).astype(int)

    # Fill NaN opponents (end of season) with 0 (no fixture)
    for col in ["opponent_gw2", "opponent_gw3"]:
        if col in df.columns:
            df[col] = df[col].fillna(0).astype(int)

    return df
