# ml/pipelines/mappings/build_team_name_map.py
from pathlib import Path

import pandas as pd

from ml.config.seasons import SEASONS_ALL
from ml.utils.io import find_latest_snapshot, safe_read_csv

SNAPSHOT_ROOT = Path("data/raw/fpl")
OUT_DIR = Path("data/processed/mappings")

def _snapshot():
    return find_latest_snapshot(SNAPSHOT_ROOT)

def norm(s: str) -> str:
    # normalize team names so matching is more reliable across sources (Understat vs FPL).
    s = (s or "").strip().lower()
    s = s.replace("&", "and")
    s = " ".join(s.split())
    return s

def normalize_season(s: str) -> str:
    # normalize season strings so '2016/17' and '2016-17' match.
    return str(s).strip().replace("/", "-")

def load_from_master(season: str) -> pd.DataFrame:
    # returns: DataFrame with columns: team_id, team_name, team_name_norm
    # or empty DataFrame if season not found (caller will fallback).

    master = _snapshot() / "master_team_list.csv"
    if not master.exists():
        raise FileNotFoundError(f"Missing {master}")

    df = safe_read_csv(master)

    # normalize season format to handle both "2016-17" and "2016/17"
    df["season_norm"] = df["season"].map(normalize_season)
    season_norm = normalize_season(season)

    d = df[df["season_norm"] == season_norm].copy()
    if d.empty:
        return pd.DataFrame()

    out = d[["team", "team_name"]].copy()
    out.columns = ["team_id", "team_name"]

    # Clean types
    out["team_id"] = pd.to_numeric(out["team_id"], errors="coerce")
    out = out.dropna(subset=["team_id"]).copy()
    out["team_id"] = out["team_id"].astype(int)

    # Add normalized name for matching
    out["team_name"] = out["team_name"].astype(str)
    out["team_name_norm"] = out["team_name"].map(norm)

    return out.drop_duplicates(subset=["team_id"]).sort_values("team_id").reset_index(drop=True)

def load_from_teams_csv(season: str) -> pd.DataFrame:
    # returns: DataFrame with columns: team_id, team_name, team_name_norm
    teams_path = _snapshot() / season / "teams.csv"
    if not teams_path.exists():
        raise FileNotFoundError(f"Missing fallback teams.csv: {teams_path}")

    teams = safe_read_csv(teams_path)

    if "id" not in teams.columns:
        raise ValueError(f"{teams_path} missing 'id'. Columns={list(teams.columns)}")

    # Prefer "name", fallback to "short_name"
    name_col = "name" if "name" in teams.columns else ("short_name" if "short_name" in teams.columns else None)
    if name_col is None:
        raise ValueError(
            f"{teams_path} missing team name column (expected 'name' or 'short_name'). Columns={list(teams.columns)}"
        )

    out = teams[["id", name_col]].copy()
    out.columns = ["team_id", "team_name"]

    # clean types
    out["team_id"] = pd.to_numeric(out["team_id"], errors="coerce")
    out = out.dropna(subset=["team_id"]).copy()
    out["team_id"] = out["team_id"].astype(int)

    # add normalized name for matching
    out["team_name"] = out["team_name"].astype(str)
    out["team_name_norm"] = out["team_name"].map(norm)

    return out.drop_duplicates(subset=["team_id"]).sort_values("team_id").reset_index(drop=True)

def run_one(season: str) -> Path:
    """build team_id -> team_name mapping for a single season"""
    out = load_from_master(season)
    source = "master_team_list.csv"

    if out.empty:
        out = load_from_teams_csv(season)
        source = "teams.csv"

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    out_path = OUT_DIR / f"team_name_map_{season}.csv"
    out.to_csv(out_path, index=False)

    print("saved:", out_path, "rows:", len(out), f"(source={source})")
    print(out.head(25).to_string(index=False))
    return out_path

def main():
    for season in SEASONS_ALL:
        run_one(season)

if __name__ == "__main__":
    main()
