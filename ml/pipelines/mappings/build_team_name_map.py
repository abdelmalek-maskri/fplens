# ml/pipelines/mappings/build_team_name_map.py
import argparse
from pathlib import Path
import pandas as pd

MASTER = Path("external/vaastav_fpl/data/master_team_list.csv")
OUT_DIR = Path("data/processed/mappings")

# Fallback for newer seasons where master_team_list.csv stops (e.g. 2024-25+)
TEAMS_FALLBACK_ROOT = Path("external/vaastav_fpl/data")


def norm(s: str) -> str:
    s = (s or "").strip().lower()
    s = s.replace("&", "and")
    s = " ".join(s.split())
    return s


def contains_letters_ratio(series: pd.Series) -> float:
    s = series.astype(str).fillna("")
    mask = s.str.contains(r"[a-zA-Z]", regex=True)
    return float(mask.mean())


def pick_season_col(df: pd.DataFrame) -> str:
    for c in df.columns:
        if c.lower() in ("season", "seasons", "fpl_season", "year"):
            return c
    for c in df.columns:
        sample = df[c].astype(str).head(200)
        if sample.str.contains(r"\d{4}[-/]\d{2}", regex=True).mean() > 0.5:
            return c
    raise ValueError(f"Could not find season column in master_team_list.csv. Columns={list(df.columns)}")


def pick_team_id_col(df: pd.DataFrame) -> str:
    for c in df.columns:
        if c.lower() in ("team_id", "id"):
            return c

    best = None
    best_score = -1.0
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
            f"Could not find a text team-name column (score={best_score}). Columns={list(df_season.columns)}"
        )
    return best


def load_from_master(season: str) -> pd.DataFrame:
    if not MASTER.exists():
        raise FileNotFoundError(f"Missing {MASTER}. Did you init the submodule?")

    df = pd.read_csv(MASTER, low_memory=False)

    season_col = pick_season_col(df)
    team_id_col = pick_team_id_col(df)

    d = df[df[season_col].astype(str) == str(season)].copy()
    if d.empty:
        d = df[df[season_col].astype(str).str.replace("/", "-", regex=False) == str(season)].copy()

    if d.empty:
        return pd.DataFrame()  # let caller decide fallback

    name_col = pick_team_name_col(d, exclude={season_col, team_id_col})

    out = d[[team_id_col, name_col]].copy()
    out.columns = ["team_id", "team_name"]

    out["team_id"] = pd.to_numeric(out["team_id"], errors="coerce")
    out = out.dropna(subset=["team_id"]).copy()
    out["team_id"] = out["team_id"].astype(int)

    out["team_name"] = out["team_name"].astype(str)
    out["team_name_norm"] = out["team_name"].map(norm)

    return out.drop_duplicates(subset=["team_id"]).sort_values("team_id").reset_index(drop=True)


def load_from_teams_csv(season: str) -> pd.DataFrame:
    teams_path = TEAMS_FALLBACK_ROOT / season / "teams.csv"
    if not teams_path.exists():
        raise FileNotFoundError(f"Missing fallback teams.csv: {teams_path}")

    teams = pd.read_csv(teams_path, low_memory=False)

    if "id" not in teams.columns:
        raise ValueError(f"{teams_path} missing 'id'. Columns={list(teams.columns)}")

    name_col = "name" if "name" in teams.columns else ("short_name" if "short_name" in teams.columns else None)
    if name_col is None:
        raise ValueError(
            f"{teams_path} missing team name column (expected 'name' or 'short_name'). Columns={list(teams.columns)}"
        )

    out = teams[["id", name_col]].copy()
    out.columns = ["team_id", "team_name"]

    out["team_id"] = pd.to_numeric(out["team_id"], errors="coerce")
    out = out.dropna(subset=["team_id"]).copy()
    out["team_id"] = out["team_id"].astype(int)

    out["team_name"] = out["team_name"].astype(str)
    out["team_name_norm"] = out["team_name"].map(norm)

    return out.drop_duplicates(subset=["team_id"]).sort_values("team_id").reset_index(drop=True)


def run_one(season: str) -> Path:
    out = load_from_master(season)
    source = "master_team_list.csv"

    if out.empty:
        out = load_from_teams_csv(season)
        source = "teams.csv"

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    out_path = OUT_DIR / f"team_name_map_{season}.csv"
    out.to_csv(out_path, index=False)

    print("✅ Saved:", out_path, "rows:", len(out), f"(source={source})")
    print(out.head(25).to_string(index=False))
    return out_path


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--season", required=True)
    args = ap.parse_args()
    run_one(args.season)


if __name__ == "__main__":
    main()
