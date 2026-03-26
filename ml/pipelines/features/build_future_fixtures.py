# ml/pipelines/features/build_future_fixtures.py

"""
Add future fixture context for multi-horizon forecasting.

For each row at gameweek G, this module adds:
- opponent and home/away status for GW+2 and GW+3
- opponent fixture difficulty derived from season-specific team strength ratings
"""

from pathlib import Path

import numpy as np
import pandas as pd

from ml.utils.io import find_latest_snapshot

VAASTAV_DIR = find_latest_snapshot(Path("data/raw/fpl"))


def load_team_strengths() -> dict[str, pd.DataFrame]:
    """
    load season-specific team strength ratings from vaastav teams.csv files.
    Returns:
        Mapping from season string to a DataFrame containing team strength fields.
    """
    strengths: dict[str, pd.DataFrame] = {}

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
    """
    Build a team-level fixture schedule and shift it forward to obtain future fixtures.

    Returns:
        DataFrame with future opponent and home/away features for GW+2 and GW+3.
    """
    schedule = (
        df[["season", "GW", "team", "opponent_team", "was_home"]]
        .drop_duplicates(subset=["season", "GW", "team"])
        .sort_values(["season", "team", "GW"])
        .copy()
    )

    grouped = schedule.groupby(["season", "team"], sort=False)
    schedule["opponent_gw2"] = grouped["opponent_team"].shift(-2)
    schedule["was_home_gw2"] = grouped["was_home"].shift(-2)
    schedule["opponent_gw3"] = grouped["opponent_team"].shift(-3)
    schedule["was_home_gw3"] = grouped["was_home"].shift(-3)

    return schedule


def compute_fdr(
    schedule: pd.DataFrame,
    strengths: dict[str, pd.DataFrame],
) -> pd.DataFrame:
    """
    Add future fixture difficulty features using opponent team strength ratings.

    Added features:
    - fdr_gw{k}: overall opponent strength
    - fdr_attack_gw{k}: opponent attacking strength
    - fdr_defence_gw{k}: opponent defensive strength
    """
    for k in [2, 3]:
        opp_col = f"opponent_gw{k}"
        home_col = f"was_home_gw{k}"
        fdr_col = f"fdr_gw{k}"
        fdr_atk_col = f"fdr_attack_gw{k}"
        fdr_def_col = f"fdr_defence_gw{k}"

        schedule[fdr_col] = np.nan
        schedule[fdr_atk_col] = np.nan
        schedule[fdr_def_col] = np.nan

        for season, sdf in strengths.items():
            season_mask = schedule["season"] == season
            if not season_mask.any():
                continue

            strength_map = sdf.set_index("id")["strength"].to_dict()
            schedule.loc[season_mask, fdr_col] = schedule.loc[season_mask, opp_col].map(strength_map)

            if "strength_attack_home" in sdf.columns:
                atk_home = sdf.set_index("id")["strength_attack_home"].to_dict()
                atk_away = sdf.set_index("id")["strength_attack_away"].to_dict()
                def_home = sdf.set_index("id")["strength_defence_home"].to_dict()
                def_away = sdf.set_index("id")["strength_defence_away"].to_dict()

                home_mask = season_mask & (schedule[home_col] == True)  # noqa: E712
                away_mask = season_mask & (schedule[home_col] == False)  # noqa: E712

                # If the player's team is at home, the opponent is away, and vice versa.
                schedule.loc[home_mask, fdr_atk_col] = schedule.loc[home_mask, opp_col].map(atk_away)
                schedule.loc[home_mask, fdr_def_col] = schedule.loc[home_mask, opp_col].map(def_away)

                schedule.loc[away_mask, fdr_atk_col] = schedule.loc[away_mask, opp_col].map(atk_home)
                schedule.loc[away_mask, fdr_def_col] = schedule.loc[away_mask, opp_col].map(def_home)

        # Use neutral defaults when strength data is unavailable.
        schedule[fdr_col] = schedule[fdr_col].fillna(3)

        for col in [fdr_atk_col, fdr_def_col]:
            schedule[col] = schedule[col].fillna(1200)
            schedule[col] = (schedule[col] - 900) / 500

    return schedule


def add_future_fixture_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Add future fixture features to the training DataFrame.

    Added columns:
    - opponent_gw2, opponent_gw3
    - was_home_gw2, was_home_gw3
    - fdr_gw2, fdr_gw3
    - fdr_attack_gw2, fdr_attack_gw3
    - fdr_defence_gw2, fdr_defence_gw3
    """
    print("building fixture schedule...")
    schedule = build_fixture_schedule(df)

    print("loading team strength ratings...")
    strengths = load_team_strengths()
    print(f"found strength data for {len(strengths)} seasons: {sorted(strengths.keys())}")

    print("computing FDR from opponent strengths...")
    schedule = compute_fdr(schedule, strengths)

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

    for col in ["was_home_gw2", "was_home_gw3"]:
        if col in df.columns:
            df[col] = df[col].astype(float).fillna(0).astype(int)

    for col in ["opponent_gw2", "opponent_gw3"]:
        if col in df.columns:
            df[col] = df[col].fillna(0).astype(int)

    return df
