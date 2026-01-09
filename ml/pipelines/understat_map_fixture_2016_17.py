import pandas as pd
from pathlib import Path

SEASON = "2016-17"
FPL_FIX = Path(f"data/processed/mappings/fpl_fixtures_{SEASON}_with_gw.csv")
TEAMMAP = Path(f"data/processed/mappings/team_name_map_{SEASON}.csv")
UNDER = Path("data/processed/external/understat/player_matches_EPL_2016_all_filtered.csv")

OUT = Path(f"data/processed/external/understat/understat_matches_mapped_{SEASON}.csv")

ALIASES = {
    "tottenham": "spurs",
    "tottenham hotspur": "spurs",
    "manchester united": "man utd",
    "manchester city": "man city",
    "west bromwich albion": "west brom",
    "stoke": "stoke city",
    "hull": "hull city",
    "swansea": "swansea city",
}

def norm(s: str) -> str:
    s = (s or "").strip().lower()
    s = s.replace("&", "and")
    s = " ".join(s.split())
    return s

def canon_team(s: str) -> str:
    x = norm(s)
    return ALIASES.get(x, x)

def run():
    fx = pd.read_csv(FPL_FIX, parse_dates=["kickoff_time"])
    tm = pd.read_csv(TEAMMAP)

    under = pd.read_csv(UNDER)
    under["date"] = pd.to_datetime(under["date"], errors="coerce").dt.date

    # ---- canonicalize team names on BOTH sides ----
    tm["team_name_norm"] = tm["team_name_norm"].astype(str).map(canon_team)

    under["h_norm"] = under["h_team"].astype(str).map(canon_team)
    under["a_norm"] = under["a_team"].astype(str).map(canon_team)

    name_to_id = dict(zip(tm["team_name_norm"], tm["team_id"]))

    under["home_team_id"] = under["h_norm"].map(name_to_id)
    under["away_team_id"] = under["a_norm"].map(name_to_id)

    # ---- diagnostics: team-id mapping coverage ----
    miss_home = under["home_team_id"].isna().mean()
    miss_away = under["away_team_id"].isna().mean()
    print(f"Understat team_id missing: home={miss_home:.3f}, away={miss_away:.3f}")

    # fixture base date
    fx["fx_date"] = fx["kickoff_time"].dt.date

    # ---- build one lookup table with date, date-1, date+1 ----
    base = fx[["fixture", "GW", "home_team_id", "away_team_id", "fx_date"]].copy()

    l0 = base.rename(columns={"fx_date": "match_date"})
    l1 = base.assign(match_date=base["fx_date"] - pd.Timedelta(days=1)).drop(columns=["fx_date"])
    l2 = base.assign(match_date=base["fx_date"] + pd.Timedelta(days=1)).drop(columns=["fx_date"])

    fx_lookup = pd.concat([l0, l1, l2], ignore_index=True)

    # optional safety: if duplicates exist, keep the earliest kickoff fixture
    fx_lookup = fx_lookup.drop_duplicates(
        subset=["match_date", "home_team_id", "away_team_id", "fixture"],
        keep="first",
    )

    merged = under.merge(
        fx_lookup,
        left_on=["date", "home_team_id", "away_team_id"],
        right_on=["match_date", "home_team_id", "away_team_id"],
        how="left",
    ).drop(columns=["match_date"])

    OUT.parent.mkdir(parents=True, exist_ok=True)
    merged.to_csv(OUT, index=False)

    print("✅ Saved:", OUT)
    print("Mapped fixture %:", float(merged["fixture"].notna().mean()))
    print("Mapped GW %:", float(merged["GW"].notna().mean()))

    print("\nUnmapped sample (first 20):")
    print(
        merged.loc[merged["fixture"].isna(), ["date", "h_team", "a_team", "h_norm", "a_norm", "home_team_id", "away_team_id"]]
        .head(20)
        .to_string(index=False)
    )

if __name__ == "__main__":
    run()
