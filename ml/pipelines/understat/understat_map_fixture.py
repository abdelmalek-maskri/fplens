"""Attach an FPL fixture id to every Understat match.

Understat names clubs its own way and records only a date, so the join is on
normalised club name plus date. Neither side agrees on the date reliably,
which is what the day shifts near the bottom are for.
"""

from pathlib import Path

import pandas as pd

from ml.config.seasons import SEASONS_ALL
from ml.utils.io import safe_read_csv
from ml.utils.name_normalize import norm


def run_one(season: str) -> Path:
    """Map one season's Understat matches onto FPL fixture ids."""
    # Understat names its files by the season's start year: 2023 for 2023-24.
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

    fx = safe_read_csv(fpl_fix)
    fx["kickoff_time"] = pd.to_datetime(fx["kickoff_time"], errors="coerce", utc=True)

    fx = fx.dropna(subset=["kickoff_time", "home_team_id", "away_team_id"]).copy()

    # Date only. Understat records no kickoff time, so the hour cannot be
    # part of the join even though FPL has it.
    fx["date"] = fx["kickoff_time"].dt.date

    fx["home_team_id"] = pd.to_numeric(fx["home_team_id"], errors="coerce")
    fx["away_team_id"] = pd.to_numeric(fx["away_team_id"], errors="coerce")
    fx = fx.dropna(subset=["home_team_id", "away_team_id"]).copy()
    fx["home_team_id"] = fx["home_team_id"].astype(int)
    fx["away_team_id"] = fx["away_team_id"].astype(int)

    tm = safe_read_csv(teammap)

    # The mapping file has been written with either name across seasons.
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

    # Re-normalised even when the column was already there, because an older
    # mapping file may have been written by an earlier version of norm().
    tm["team_name_norm"] = tm["team_name_norm"].astype(str).map(norm)

    name_to_id = dict(zip(tm["team_name_norm"], tm[team_id_col]))

    under = safe_read_csv(under_in)

    under["date"] = pd.to_datetime(under["date"], errors="coerce").dt.date
    under = under.dropna(subset=["date", "h_team", "a_team"]).copy()

    under["h_norm"] = under["h_team"].astype(str).map(norm)
    under["a_norm"] = under["a_team"].astype(str).map(norm)

    under["home_team_id"] = under["h_norm"].map(name_to_id)
    under["away_team_id"] = under["a_norm"].map(name_to_id)

    # A club whose name does not normalise to anything known loses every
    # match it played, so the rate is printed rather than left to be noticed.
    print(
        "Understat team_id missing:",
        f"home={under['home_team_id'].isna().mean():.3f}, away={under['away_team_id'].isna().mean():.3f}",
    )

    right = fx[["fixture", "date", "home_team_id", "away_team_id"]].copy()

    merged = under.merge(right, on=["date", "home_team_id", "away_team_id"], how="left")

    # The two sources disagree about the date of a late kickoff: Understat
    # stamps it in local time, FPL in UTC, so a 20:00 Saturday match can land
    # on Sunday in one of them. Trying one day either way recovers those
    # without loosening the club or season match.
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
    print("saved:", out_path)
    print("mapped fixture %:", float(merged["fixture"].notna().mean()))
    print("unmapped sample:")
    print(merged.loc[merged["fixture"].isna(), ["date", "h_team", "a_team"]].head(12).to_string(index=False))

    return out_path


def main():
    """Map Understat matches to FPL fixtures for every season."""
    for season in SEASONS_ALL:
        run_one(season)


if __name__ == "__main__":
    main()
