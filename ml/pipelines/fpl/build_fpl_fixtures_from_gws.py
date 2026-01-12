# ml/pipelines/build_fpl_fixtures_from_gws.py
import argparse
from pathlib import Path
import pandas as pd

from ml.utils.io import safe_read_csv

SNAPSHOT_ROOT = Path("data/raw/fpl")


def find_latest_snapshot(root: Path) -> Path:
    snaps = sorted([p for p in root.glob("vaastav_snapshot_*") if p.is_dir()])
    if not snaps:
        raise FileNotFoundError("No snapshot found under data/raw/fpl/vaastav_snapshot_*")
    return snaps[-1]


def build_element_to_team_map(season_dir: Path) -> pd.Series:
    """
    Build mapping: element_id -> team_id (FPL team integer)

    players_raw schema varies by season:
      - element id can be in 'id' or 'element'
      - team id can be in 'team' (most common), sometimes 'team_id' or 'team_code'
    """
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
    m[team_col] = m[team_col].astype(int)

    return m.set_index(elem_col)[team_col]


def _coerce_was_home(s: pd.Series) -> pd.Series:
    """
    Vaastav gw files store was_home inconsistently across seasons:
      - True/False (bool)
      - 1/0 (int/float)
      - "True"/"False" (string)
      - "1"/"0" (string)
    Normalize to boolean.
    """
    if s.dtype == bool:
        return s.fillna(False)

    if pd.api.types.is_numeric_dtype(s):
        return s.fillna(0).astype(int).eq(1)

    ss = s.astype(str).str.strip().str.lower()
    out = ss.map({"true": True, "false": False, "1": True, "0": False})
    return out.fillna(False).astype(bool)


def run_one(season: str, snapshot: Path) -> Path:
    season_dir = snapshot / season
    gws_dir = season_dir / "gws"
    if not gws_dir.exists():
        raise FileNotFoundError(f"Missing gws dir: {gws_dir}")

    out = Path(f"data/processed/mappings/fpl_fixtures_{season}.csv")
    out.parent.mkdir(parents=True, exist_ok=True)

    gw_files = sorted(gws_dir.glob("gw*.csv"))
    if not gw_files:
        raise FileNotFoundError(f"No gw*.csv files found in {gws_dir}")

    # Always build element->team from players_raw 
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
        df["was_home"] = _coerce_was_home(df["was_home"])

        df["fixture"] = pd.to_numeric(df["fixture"], errors="coerce")
        df["element"] = pd.to_numeric(df["element"], errors="coerce")
        df["opponent_team"] = pd.to_numeric(df["opponent_team"], errors="coerce")

        # Repair / fill team using element_to_team
        team_from_map = df["element"].map(element_to_team)

        if "team" not in df.columns:
            df["team"] = team_from_map
        else:
            df["team"] = pd.to_numeric(df["team"], errors="coerce")
            # if team is mostly missing, replace it entirely
            if df["team"].isna().mean() > 0.50:
                df["team"] = team_from_map
            else:
                # otherwise just fill missing
                df["team"] = df["team"].fillna(team_from_map)

        df["team"] = pd.to_numeric(df["team"], errors="coerce")

        # keep only usable rows
        dfx = df.dropna(subset=["fixture", "kickoff_time", "team", "opponent_team"]).copy()

        if dfx.empty:
            # Helpful debug (won't crash the whole run)
            print(f"⚠️ {season} {f.name}: empty after dropna. "
                  f"team_na={df['team'].isna().mean():.3f}, "
                  f"kickoff_na={df['kickoff_time'].isna().mean():.3f}, "
                  f"opp_na={df['opponent_team'].isna().mean():.3f}")
            continue

        dfx["fixture"] = dfx["fixture"].astype(int)
        dfx["team"] = dfx["team"].astype(int)
        dfx["opponent_team"] = dfx["opponent_team"].astype(int)

        # choose one home-side record per fixture
        home_side = dfx[dfx["was_home"]][
            ["fixture", "kickoff_time", "team", "opponent_team", "team_h_score", "team_a_score"]
        ].copy()

        if home_side.empty:
            # fallback: use away-side rows and swap ids
            away_side = dfx[~dfx["was_home"]][
                ["fixture", "kickoff_time", "team", "opponent_team", "team_h_score", "team_a_score"]
            ].copy()
            if away_side.empty:
                print(f"⚠️ {season} {f.name}: no home or away rows after filtering.")
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
        # Hard fail: you *want* to know this immediately.
        raise RuntimeError(
            f"{season}: produced 0 fixture rows from gw files. "
            f"Check that gw*.csv contain element ids matching players_raw and valid kickoff_time."
        )

    fx = pd.concat(rows, ignore_index=True)

    # One row per fixture (dedupe across GWs)
    fx = fx.sort_values(["fixture", "kickoff_time"]).drop_duplicates(subset=["fixture"], keep="first")
    fx = fx.sort_values(["kickoff_time", "fixture"]).reset_index(drop=True)

    fx.to_csv(out, index=False)
    print(f"✅ Saved: {out}")
    print("rows:", len(fx))
    print(fx.head(8).to_string(index=False))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--season", required=True, help="e.g. 2016-17")
    args = ap.parse_args()

    snap = find_latest_snapshot(SNAPSHOT_ROOT)
    run_one(args.season, snap)


if __name__ == "__main__":
    main()
