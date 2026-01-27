# ml/pipelines/understat_map_fixture.py (8)
import argparse
from pathlib import Path
import pandas as pd
from ml.utils.name_normalize import norm  

def run_one(season: str) -> Path:
    year = int(season.split("-")[0])

    fpl_fix = Path(f"data/processed/mappings/fpl_fixtures_{season}.csv")
    teammap = Path(f"data/processed/mappings/team_name_map_{season}.csv")
    under_in = Path(f"data/processed/external/understat/player_matches_EPL_{year}_all_filtered.csv")
    out_path = Path(f"data/processed/external/understat/understat_matches_mapped_{season}.csv")

    if not fpl_fix.exists():
        raise FileNotFoundError(f"Missing {fpl_fix}")
    if not teammap.exists():
        raise FileNotFoundError(f"Missing {teammap} (run build_team_name_map first)")
    if not under_in.exists():
        raise FileNotFoundError(f"Missing {under_in} (run fetch_understat first)")

    # Load FPL fixtures and derive match date.
    fx = pd.read_csv(fpl_fix, low_memory=False)
    fx["kickoff_time"] = pd.to_datetime(fx["kickoff_time"], errors="coerce", utc=True)
    fx = fx.dropna(subset=["kickoff_time", "home_team_id", "away_team_id"]).copy()
    fx["date"] = fx["kickoff_time"].dt.date

    # Ensure team ids are stable ints for joins.
    fx["home_team_id"] = pd.to_numeric(fx["home_team_id"], errors="coerce")
    fx["away_team_id"] = pd.to_numeric(fx["away_team_id"], errors="coerce")
    fx = fx.dropna(subset=["home_team_id", "away_team_id"]).copy()
    fx["home_team_id"] = fx["home_team_id"].astype(int)
    fx["away_team_id"] = fx["away_team_id"].astype(int)

    # Load team name map and build norm_name -> team_id dictionary.
    tm = pd.read_csv(teammap, low_memory=False)

    if "team_id" in tm.columns:
        team_id_col = "team_id"
    elif "team" in tm.columns:
        team_id_col = "team"
    else:
        raise ValueError(f"{teammap} missing team_id/team. Columns={list(tm.columns)}")

    tm[team_id_col] = pd.to_numeric(tm[team_id_col], errors="coerce")
    tm = tm.dropna(subset=[team_id_col]).copy()
    tm[team_id_col] = tm[team_id_col].astype(int)

    if "team_name_norm" not in tm.columns:
        if "team_name" in tm.columns:
            tm["team_name_norm"] = tm["team_name"].astype(str).map(norm)
        elif "name" in tm.columns:
            tm["team_name_norm"] = tm["name"].astype(str).map(norm)
        else:
            raise ValueError(
                f"{teammap} missing team_name_norm and no team_name/name to derive it. Columns={list(tm.columns)}"
            )

    tm["team_name_norm"] = tm["team_name_norm"].astype(str).map(norm)
    name_to_id = dict(zip(tm["team_name_norm"], tm[team_id_col]))

    # Load Understat rows and map team names -> FPL team ids via normalised names.
    under = pd.read_csv(under_in, low_memory=False)
    under["date"] = pd.to_datetime(under["date"], errors="coerce").dt.date
    under = under.dropna(subset=["date", "h_team", "a_team"]).copy()

    under["h_norm"] = under["h_team"].astype(str).map(norm)
    under["a_norm"] = under["a_team"].astype(str).map(norm)
    under["home_team_id"] = under["h_norm"].map(name_to_id)
    under["away_team_id"] = under["a_norm"].map(name_to_id)

    print(
        "Understat team_id missing:",
        f"home={under['home_team_id'].isna().mean():.3f}, away={under['away_team_id'].isna().mean():.3f}",
    )

    #strict match on (date, home_team_id, away_team_id).
    right = fx[["fixture", "date", "home_team_id", "away_team_id"]].copy()
    merged = under.merge(right, on=["date", "home_team_id", "away_team_id"], how="left")

    # Fallback: try matching with a ±1 day shift for common timezone / reschedule quirks.
    missing = merged["fixture"].isna()
    if missing.any():
        fx_m1 = right.copy()
        fx_m1["date"] = (pd.to_datetime(fx_m1["date"]) - pd.Timedelta(days=1)).dt.date

        fx_p1 = right.copy()
        fx_p1["date"] = (pd.to_datetime(fx_p1["date"]) + pd.Timedelta(days=1)).dt.date

        tmp = merged.loc[missing, ["date", "home_team_id", "away_team_id"]].merge(
            fx_m1, on=["date", "home_team_id", "away_team_id"], how="left"
        )
        merged.loc[missing, "fixture"] = tmp["fixture"].values

        missing2 = merged["fixture"].isna()
        if missing2.any():
            tmp2 = merged.loc[missing2, ["date", "home_team_id", "away_team_id"]].merge(
                fx_p1, on=["date", "home_team_id", "away_team_id"], how="left"
            )
            merged.loc[missing2, "fixture"] = tmp2["fixture"].values

    out_path.parent.mkdir(parents=True, exist_ok=True)
    merged.to_csv(out_path, index=False)

    print("Saved:", out_path)
    print("Mapped fixture %:", float(merged["fixture"].notna().mean()))
    print("Unmapped sample:")
    print(
        merged.loc[merged["fixture"].isna(), ["date", "h_team", "a_team"]]
        .head(12)
        .to_string(index=False)
    )
    return out_path


def main():
    SEASONS = [
    "2016-17", "2017-18", "2018-19",
    "2019-20", "2020-21", "2021-22",
    "2022-23", "2023-24", "2024-25",
    "2025-26",
    ]

    for season in SEASONS:
        run_one(season)   


if __name__ == "__main__":
    main()
