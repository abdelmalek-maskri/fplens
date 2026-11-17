"""Reconstruct the fixture list from the per-gameweek player files.

The vaastav archive has no fixtures file for the older seasons, but every
player row names its fixture, its opponent and whether it was at home. One
fixture therefore appears on both sides, once per player, and this reduces
that back to a single row per match.
"""

from pathlib import Path

import pandas as pd

from ml.config.seasons import SEASONS_ALL
from ml.utils.io import find_latest_snapshot, safe_read_csv

SNAPSHOT_ROOT = Path("data/raw/fpl")


def build_element_to_team_map(season_dir: Path) -> pd.Series:
    """Player id to club id, read from players_raw.csv."""
    players_path = season_dir / "players_raw.csv"
    players = safe_read_csv(players_path)

    if "element" in players.columns:
        elem_col = "element"
    elif "id" in players.columns:
        elem_col = "id"
    else:
        raise ValueError(f"{players_path} missing element/id. cols={list(players.columns)}")

    if "team" in players.columns:
        team_col = "team"
    elif "team_id" in players.columns:
        team_col = "team_id"
    elif "team_code" in players.columns:
        team_col = "team_code"
    else:
        raise ValueError(f"{players_path} missing team/team_id/team_code. cols={list(players.columns)}")

    m = players[[elem_col, team_col]].copy()
    m[elem_col] = pd.to_numeric(m[elem_col], errors="coerce")
    m[team_col] = pd.to_numeric(m[team_col], errors="coerce")
    m = m.dropna(subset=[elem_col, team_col]).drop_duplicates(subset=[elem_col])
    m[elem_col] = m[elem_col].astype(int)

    return m.set_index(elem_col)[team_col]


def convert_was_home_to_boolean(s: pd.Series) -> pd.Series:
    """Read was_home as a boolean whichever way the season spelled it.

    The archive stores it as True, as 1, and as the string "True" depending on
    the season, and a string column would make every row look like a home game.
    """
    if s.dtype == bool:
        return s.fillna(False)

    if pd.api.types.is_numeric_dtype(s):
        return s.fillna(0).astype(int).eq(1)

    ss = s.astype(str).str.strip().str.lower()
    out = ss.map({"true": True, "false": False, "1": True, "0": False})
    return out.fillna(False).astype(bool)


def run_one(season: str, snapshot: Path) -> Path:
    """Rebuild one season's fixture list from its gameweek files."""
    season_dir = snapshot / season
    gws_dir = season_dir / "gws"
    if not gws_dir.exists():
        raise FileNotFoundError(f"Missing gws dir: {gws_dir}")

    out = Path(f"data/processed/fpl/fpl_fixtures_{season}.csv")
    out.parent.mkdir(parents=True, exist_ok=True)
    gw_files = sorted(gws_dir.glob("gw*.csv"))

    if not gw_files:
        raise FileNotFoundError(f"no gw*.csv files found in {gws_dir}")

    # Built even when the gameweek files have a team column, because for
    # several seasons that column is largely empty.
    element_to_team = build_element_to_team_map(season_dir)

    rows = []
    kept_rows = 0

    for f in gw_files:
        df = safe_read_csv(f)
        required = ["fixture", "kickoff_time", "team_h_score", "team_a_score", "was_home", "opponent_team", "element"]
        missing = [c for c in required if c not in df.columns]

        if missing:
            raise ValueError(f"{f} missing {missing}. cols={list(df.columns)}")

        df["kickoff_time"] = pd.to_datetime(df["kickoff_time"], errors="coerce", utc=True)
        df["was_home"] = convert_was_home_to_boolean(df["was_home"])
        df["fixture"] = pd.to_numeric(df["fixture"], errors="coerce")
        df["element"] = pd.to_numeric(df["element"], errors="coerce")
        df["opponent_team"] = pd.to_numeric(df["opponent_team"], errors="coerce")

        team_from_map = df["element"].map(element_to_team)

        if "team" not in df.columns:
            df["team"] = team_from_map
        else:
            df["team"] = pd.to_numeric(df["team"], errors="coerce")

            # Mostly empty means the column is not usable, and filling it
            # row by row would leave a mix of two sources.
            if df["team"].isna().mean() > 0.50:
                df["team"] = team_from_map
            else:
                df["team"] = df["team"].fillna(team_from_map)

        df["team"] = pd.to_numeric(df["team"], errors="coerce")
        # A row missing any of these cannot identify a match, and keeping it
        # would produce a fixture with no teams or no date.
        dfx = df.dropna(subset=["fixture", "kickoff_time", "team", "opponent_team"]).copy()

        if dfx.empty:
            print(
                f"{season} {f.name}: empty after dropna. "
                f"team_na={df['team'].isna().mean():.3f}, "
                f"kickoff_na={df['kickoff_time'].isna().mean():.3f}, "
                f"opp_na={df['opponent_team'].isna().mean():.3f}"
            )
            continue

        dfx["fixture"] = dfx["fixture"].astype(int)
        dfx["team"] = dfx["team"].astype(int)
        dfx["opponent_team"] = dfx["opponent_team"].astype(int)

        # The home side's row names the teams the right way round, so one of
        # its players is enough to describe the whole fixture.
        home_side = dfx[dfx["was_home"]][
            ["fixture", "kickoff_time", "team", "opponent_team", "team_h_score", "team_a_score"]
        ].copy()

        if home_side.empty:
            # No home player has a row for this fixture, which happens when
            # the gameweek file is partial. The away rows hold the same
            # match with team and opponent reversed.
            away_side = dfx[~dfx["was_home"]][
                ["fixture", "kickoff_time", "team", "opponent_team", "team_h_score", "team_a_score"]
            ].copy()
            if away_side.empty:
                print(f"{season} {f.name}: no home or away rows after filtering.")
                continue

            away_side = away_side.rename(columns={"team": "away_team_id", "opponent_team": "home_team_id"})
            one_per_fixture = away_side.groupby("fixture", as_index=False).first()
        else:
            home_side = home_side.rename(columns={"team": "home_team_id", "opponent_team": "away_team_id"})
            one_per_fixture = home_side.groupby("fixture", as_index=False).first()

        one_per_fixture["season"] = season
        one_per_fixture["date"] = one_per_fixture["kickoff_time"].dt.date
        kept_rows += len(one_per_fixture)
        rows.append(one_per_fixture)

    if not rows:
        # Silently writing an empty fixtures file would break the Understat
        # mapping three stages later, where the cause is much harder to see.
        raise RuntimeError(
            f"{season}: produced 0 fixture rows from gw files. "
            f"Check that gw*.csv contain element ids matching players_raw and valid kickoff_time."
        )

    fx = pd.concat(rows, ignore_index=True)

    # Both clubs' gameweek files describe the same match, so the same fixture
    # arrives twice.
    fx = fx.sort_values(["fixture", "kickoff_time"]).drop_duplicates(subset=["fixture"], keep="first")
    fx = fx.sort_values(["kickoff_time", "fixture"]).reset_index(drop=True)
    fx.to_csv(out, index=False)
    print(f"saved: {out}")
    print("rows:", len(fx))
    print(fx.head(8).to_string(index=False))
    return out


def main():
    """Rebuild the fixture list for every season."""
    snap = find_latest_snapshot(SNAPSHOT_ROOT)
    for season in SEASONS_ALL:
        run_one(season, snap)


if __name__ == "__main__":
    main()
