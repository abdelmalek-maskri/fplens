# ml/pipelines/build_team_name_map.py
import argparse
from pathlib import Path
import pandas as pd
import re

MASTER = Path("external/vaastav_fpl/data/master_team_list.csv")
OUT_DIR = Path("data/processed/mappings")

def norm(s: str) -> str:
    s = (s or "").strip().lower()
    s = s.replace("&", "and")
    s = " ".join(s.split())
    return s

def contains_letters_ratio(series: pd.Series) -> float:
    # ratio of values that contain at least one letter a-z
    s = series.astype(str).fillna("")
    mask = s.str.contains(r"[a-zA-Z]", regex=True)
    return float(mask.mean())

def pick_season_col(df: pd.DataFrame) -> str:
    for c in df.columns:
        if c.lower() in ("season", "seasons", "fpl_season", "year"):
            return c
    # fallback: try any column that looks like seasons e.g. 2019-20
    for c in df.columns:
        sample = df[c].astype(str).head(200)
        if sample.str.contains(r"\d{4}[-/]\d{2}", regex=True).mean() > 0.5:
            return c
    raise ValueError(f"Could not find season column in master_team_list.csv. Columns={list(df.columns)}")

def pick_team_id_col(df: pd.DataFrame) -> str:
    # Prefer explicit names
    for c in df.columns:
        if c.lower() in ("team_id", "id"):
            return c
    # fallback: pick a mostly-numeric column that looks like 1..20
    best = None
    best_score = -1
    for c in df.columns:
        s = pd.to_numeric(df[c], errors="coerce")
        score = float(s.notna().mean())
        if score > best_score:
            best_score = score
            best = c
    if best is None:
        raise ValueError("Could not find numeric id column.")
    return best

def pick_team_name_col(df_season: pd.DataFrame, exclude: set) -> str:
    # choose a column with the highest "contains letters" ratio
    best = None
    best_score = -1.0
    for c in df_season.columns:
        if c in exclude:
            continue
        score = contains_letters_ratio(df_season[c])
        if score > best_score:
            best_score = score
            best = c
    if best is None or best_score < 0.5:
        raise ValueError(
            f"Could not find a text team-name column (score={best_score}). "
            f"Columns={list(df_season.columns)}"
        )
    return best

def run_one(season: str) -> Path:
    if not MASTER.exists():
        raise FileNotFoundError(f"Missing {MASTER}. Did you init the submodule?")

    df = pd.read_csv(MASTER)

    season_col = pick_season_col(df)
    team_id_col = pick_team_id_col(df)

    # filter season
    d = df[df[season_col].astype(str) == str(season)].copy()
    if d.empty:
        # try normalize season values like 2019/20 -> 2019-20
        d = df[df[season_col].astype(str).str.replace("/", "-", regex=False) == str(season)].copy()
    if d.empty:
        raise ValueError(f"No rows for season={season} in {MASTER}")

    # pick name column by "letters" ratio
    name_col = pick_team_name_col(d, exclude={season_col, team_id_col})

    out = d[[team_id_col, name_col]].copy()
    out.columns = ["team_id", "team_name"]

    out["team_id"] = pd.to_numeric(out["team_id"], errors="coerce").astype("Int64")
    out = out.dropna(subset=["team_id"]).copy()
    out["team_id"] = out["team_id"].astype(int)

    out["team_name"] = out["team_name"].astype(str)
    out["team_name_norm"] = out["team_name"].map(norm)

    # drop duplicates
    out = out.drop_duplicates(subset=["team_id"]).sort_values("team_id")

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    out_path = OUT_DIR / f"team_name_map_{season}.csv"
    out.to_csv(out_path, index=False)

    print("✅ Saved:", out_path, "rows:", len(out))
    print("Picked columns:",
          f"season_col={season_col}, team_id_col={team_id_col}, team_name_col={name_col}")
    print(out.head(25).to_string(index=False))
    return out_path

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--season", required=True)
    args = ap.parse_args()
    run_one(args.season)

if __name__ == "__main__":
    main()
