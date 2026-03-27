# ml/pipelines/understat/understat_map_fixture.py

from pathlib import Path

import pandas as pd

from ml.config.seasons import SEASONS_ALL
from ml.utils.io import safe_read_csv
from ml.utils.name_normalize import norm


def run_one(season: str) -> Path:
    # extract start year (Understat uses start year for season files).
    year = int(season.split("-")[0])

    fpl_fix = Path(f"data/processed/fpl/fpl_fixtures_{season}.csv")
    teammap = Path(f"data/processed/mappings/team_name_map_{season}.csv")
    under_in = Path(f"data/raw/understat/player_matches_EPL_{year}_all_filtered.csv")
    out_path = Path(f"data/processed/understat/understat_matches_mapped_{season}.csv")

    if not fpl_fix.exists():
        raise FileNotFoundError(f"missing {fpl_fix}")
    if not teammap.exists():
        raise FileNotFoundError(f"missing {teammap} (run build_team_name_map first)")
    if not under_in.exists():
        raise FileNotFoundError(f"missing {under_in} (run fetch_understat first)")

    # convert kickoff time to datetime.
    fx = safe_read_csv(fpl_fix)
    fx["kickoff_time"] = pd.to_datetime(fx["kickoff_time"], errors="coerce", utc=True)

    # drop rows missing essential fields needed for matching.
    fx = fx.dropna(subset=["kickoff_time", "home_team_id", "away_team_id"]).copy()

    # extract date (no time) to align with Understat format.
    fx["date"] = fx["kickoff_time"].dt.date

    # ensure team ids are numeric and consistent for joins.
    fx["home_team_id"] = pd.to_numeric(fx["home_team_id"], errors="coerce")
    fx["away_team_id"] = pd.to_numeric(fx["away_team_id"], errors="coerce")
    fx = fx.dropna(subset=["home_team_id", "away_team_id"]).copy()
    fx["home_team_id"] = fx["home_team_id"].astype(int)
    fx["away_team_id"] = fx["away_team_id"].astype(int)

    # load team name mapping (normalised name -> FPL team id).
    tm = safe_read_csv(teammap)

    # handle different possible column names for team id.
    if "team_id" in tm.columns:
        team_id_col = "team_id"
    elif "team" in tm.columns:
        team_id_col = "team"
    else:
        raise ValueError(f"{teammap} missing team_id/team. Columns={list(tm.columns)}")

    # clean team ids.
    tm[team_id_col] = pd.to_numeric(tm[team_id_col], errors="coerce")
    tm = tm.dropna(subset=[team_id_col]).copy()
    tm[team_id_col] = tm[team_id_col].astype(int)

    # ensure a normalised team name column exists
    if "team_name_norm" not in tm.columns:
        if "team_name" in tm.columns:
            tm["team_name_norm"] = tm["team_name"].astype(str).map(norm)
        elif "name" in tm.columns:
            tm["team_name_norm"] = tm["name"].astype(str).map(norm)
        else:
            raise ValueError(
                f"{teammap} missing team_name_norm and no team_name/name to derive it. Columns={list(tm.columns)}"
            )

    # re-normalise to ensure consistency even if column already existed.
    tm["team_name_norm"] = tm["team_name_norm"].astype(str).map(norm)

    # build lookup: normalised name -> team_id.
    name_to_id = dict(zip(tm["team_name_norm"], tm[team_id_col]))

    under = safe_read_csv(under_in)

    # convert Understat date to match FPL date format.
    under["date"] = pd.to_datetime(under["date"], errors="coerce").dt.date
    under = under.dropna(subset=["date", "h_team", "a_team"]).copy()

    under["h_norm"] = under["h_team"].astype(str).map(norm)
    under["a_norm"] = under["a_team"].astype(str).map(norm)

    # Map normalised names to FPL team ids.
    under["home_team_id"] = under["h_norm"].map(name_to_id)
    under["away_team_id"] = under["a_norm"].map(name_to_id)

    # diagnostic: how many rows failed to map to team ids.
    print(
        "Understat team_id missing:",
        f"home={under['home_team_id'].isna().mean():.3f}, away={under['away_team_id'].isna().mean():.3f}",
    )

    # Prepare minimal fixture table for matching.
    right = fx[["fixture", "date", "home_team_id", "away_team_id"]].copy()

    # first attempt: strict match on (date, home_team_id, away_team_id).
    merged = under.merge(right, on=["date", "home_team_id", "away_team_id"], how="left")

    # fallback: try matching with a -1 day shift (timezone / scheduling differences).
    missing = merged["fixture"].isna()
    if missing.any():
        fx_m1 = right.copy()
        fx_m1["date"] = (pd.to_datetime(fx_m1["date"]) - pd.Timedelta(days=1)).dt.date

        fx_p1 = right.copy()
        fx_p1["date"] = (pd.to_datetime(fx_p1["date"]) + pd.Timedelta(days=1)).dt.date

        # try matching missing rows with shifted (-1 day) fixtures.
        tmp = merged.loc[missing, ["date", "home_team_id", "away_team_id"]].merge(
            fx_m1, on=["date", "home_team_id", "away_team_id"], how="left"
        )
        merged.loc[missing, "fixture"] = tmp["fixture"].values

        # if still missing, try +1 day shift.
        missing2 = merged["fixture"].isna()
        if missing2.any():
            tmp2 = merged.loc[missing2, ["date", "home_team_id", "away_team_id"]].merge(
                fx_p1, on=["date", "home_team_id", "away_team_id"], how="left"
            )
            merged.loc[missing2, "fixture"] = tmp2["fixture"].values

    out_path.parent.mkdir(parents=True, exist_ok=True)
    merged.to_csv(out_path, index=False)
    print("saved:", out_path)
    print("mapped fixture %:", float(merged["fixture"].notna().mean()))
    print("unmapped sample:")
    print(merged.loc[merged["fixture"].isna(), ["date", "h_team", "a_team"]].head(12).to_string(index=False))

    return out_path


def main():
    for season in SEASONS_ALL:
        run_one(season)


if __name__ == "__main__":
    main()
