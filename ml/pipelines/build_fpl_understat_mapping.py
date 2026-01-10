# ml/pipelines/build_fpl_understat_mapping.py
"""
Build FPL ↔ Understat player mapping for a given FPL season string (e.g. "2016-17").

Writes:
  data/processed/mappings/fpl_to_understat_{season}.csv

Run from project root:
  python3 -m ml.pipelines.build_fpl_understat_mapping --season 2016-17

Notes:
- Uses the latest Vaastav snapshot under data/raw/fpl/vaastav_snapshot_*
- Understat YEAR is int(season.split("-")[0]) (e.g. 2016 for "2016-17")
- Filters Understat players to only those with matches in the Understat matches file (stronger mapping set)
"""

import argparse
from pathlib import Path

import pandas as pd

from ml.utils.name_normalize import norm

SNAPSHOT_ROOT = Path("data/raw/fpl")
UNDERSTAT_DIR = Path("data/processed/external/understat")
OUT_DIR = Path("data/processed/mappings")


def find_latest_snapshot(root: Path) -> Path:
    snaps = sorted([p for p in root.glob("vaastav_snapshot_*") if p.is_dir()])
    if not snaps:
        raise FileNotFoundError("No snapshot found under data/raw/fpl/vaastav_snapshot_*")
    return snaps[-1]


def run_one(season: str, snapshot: Path) -> Path:
    year = int(season.split("-")[0])

    season_dir = snapshot / season
    players_raw_path = season_dir / "players_raw.csv"
    if not players_raw_path.exists():
        raise FileNotFoundError(f"Missing FPL players_raw.csv: {players_raw_path}")

    understat_players_path = UNDERSTAT_DIR / f"players_EPL_{year}.csv"
    understat_matches_path = UNDERSTAT_DIR / f"player_matches_EPL_{year}_all_filtered.csv"
    if not understat_players_path.exists():
        raise FileNotFoundError(f"Missing Understat players: {understat_players_path}")
    if not understat_matches_path.exists():
        raise FileNotFoundError(f"Missing Understat matches: {understat_matches_path}")

    out_path = OUT_DIR / f"fpl_to_understat_{season}.csv"
    out_path.parent.mkdir(parents=True, exist_ok=True)

    # ---- FPL players (element + names) ----
    fpl = pd.read_csv(players_raw_path, low_memory=False)

    # Vaastav uses "id" for element in players_raw.csv
    if "id" in fpl.columns and "element" not in fpl.columns:
        fpl = fpl.rename(columns={"id": "element"})

    if "element" not in fpl.columns:
        raise ValueError(f"{players_raw_path} must contain 'element' (or 'id' to rename).")

    # Keep only relevant columns (if they exist)
    keep_cols = [c for c in ["element", "first_name", "second_name", "web_name", "team"] if c in fpl.columns]
    fpl = fpl[keep_cols].drop_duplicates("element").copy()

    # Build candidate name strings
    fpl["name_full"] = (fpl.get("first_name", "").fillna("").astype(str) + " " +
                        fpl.get("second_name", "").fillna("").astype(str)).str.strip()
    fpl["name_web"] = fpl.get("web_name", "").fillna("").astype(str)

    # Normalize
    fpl["n_full"] = fpl["name_full"].map(norm)
    fpl["n_web"] = fpl["name_web"].map(norm)

    # ---- Understat players (id + player_name + team_title) ----
    us = pd.read_csv(understat_players_path, low_memory=False).copy()
    if "id" not in us.columns or "player_name" not in us.columns:
        raise ValueError(f"{understat_players_path} must contain 'id' and 'player_name' columns.")
    us = us.rename(columns={"id": "us_player_id"})
    us["n_player"] = us["player_name"].map(norm)

    # ---- Restrict Understat players to those that appear in match file (stronger set) ----
    matches = pd.read_csv(understat_matches_path, low_memory=False)
    if "us_player_id" not in matches.columns:
        raise ValueError(f"{understat_matches_path} must contain 'us_player_id'.")
    valid_ids = set(matches["us_player_id"].dropna().astype(int).unique())
    us["us_player_id"] = pd.to_numeric(us["us_player_id"], errors="coerce")
    us = us[us["us_player_id"].isin(valid_ids)].copy()

    # ---- Exact matches (strong): by normalized full name OR web_name ----
    m1 = fpl.merge(us, left_on="n_full", right_on="n_player", how="left", suffixes=("_fpl", "_us"))
    m2 = fpl.merge(us, left_on="n_web", right_on="n_player", how="left", suffixes=("_fpl", "_us"))

    cols = ["element", "name_full", "web_name", "team", "us_player_id", "player_name", "team_title"]

    out1 = m1[[c for c in cols if c in m1.columns]].copy()
    out1["match_type"] = "full_name"

    out2 = m2[[c for c in cols if c in m2.columns]].copy()
    out2["match_type"] = "web_name"

    # Combine candidates; prefer (a) matched rows, then (b) full_name over web_name
    comb = pd.concat([out1, out2], ignore_index=True)
    comb["has_match"] = comb["us_player_id"].notna().astype(int)
    comb["priority"] = comb["match_type"].map({"full_name": 0, "web_name": 1}).fillna(9).astype(int)

    comb = comb.sort_values(
        ["element", "has_match", "priority"],
        ascending=[True, False, True],
        kind="mergesort",  # stable
    )

    best = comb.drop_duplicates("element", keep="first").copy()
    best["season"] = season
    best["confidence"] = best["us_player_id"].notna().map({True: "high", False: "missing"})

    best.to_csv(out_path, index=False)

    print("✅ Saved:", out_path)
    print("Season:", season, "| Understat YEAR:", year)
    print("Total FPL elements:", len(best))
    print("Matched:", int(best["us_player_id"].notna().sum()))
    print("Unmatched:", int(best["us_player_id"].isna().sum()))

    missing = best[best["us_player_id"].isna()].head(20)
    if len(missing):
        print("\nExamples unmatched (first 20):")
        show_cols = [c for c in ["element", "name_full", "web_name", "team"] if c in missing.columns]
        print(missing[show_cols].to_string(index=False))

    return out_path


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--season", required=True, help='e.g. "2016-17"')
    args = ap.parse_args()

    snap = find_latest_snapshot(SNAPSHOT_ROOT)
    run_one(args.season, snap)


if __name__ == "__main__":
    main()
