import pandas as pd
from pathlib import Path

SEASON = "2016-17"

MASTER = Path("external/vaastav_fpl/data/master_team_list.csv")
OUT = Path(f"data/processed/mappings/team_name_map_{SEASON}.csv")

def norm(s: str) -> str:
    s = (s or "").strip().lower()
    s = s.replace("&", "and")
    return s

def run():
    df = pd.read_csv(MASTER)

    # print columns once if needed:
    # print(df.columns)

    # Try common column names used in master_team_list
    # We'll handle a few possibilities robustly.
    cols = set(df.columns)

    # Candidate columns (adjust if your file uses different names)
    season_col = "season" if "season" in cols else None
    team_id_col = "team" if "team" in cols else ("team_id" if "team_id" in cols else None)
    name_col = "team_name" if "team_name" in cols else ("name" if "name" in cols else None)

    if not (season_col and team_id_col and name_col):
        raise ValueError(f"Unexpected master_team_list schema: {list(df.columns)}")

    df = df[df[season_col] == SEASON].copy()

    df["team_id"] = pd.to_numeric(df[team_id_col], errors="coerce").astype("Int64")
    df["team_name"] = df[name_col].astype(str)
    df["team_name_norm"] = df["team_name"].map(norm)

    out = df[["team_id", "team_name", "team_name_norm"]].drop_duplicates().sort_values("team_id")
    OUT.parent.mkdir(parents=True, exist_ok=True)
    out.to_csv(OUT, index=False)

    print("✅ Saved:", OUT, "rows:", len(out))
    print(out.head(10).to_string(index=False))

if __name__ == "__main__":
    run()
