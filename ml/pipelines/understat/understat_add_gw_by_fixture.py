"""Stamp each Understat match with the FPL gameweek it belongs to.

The fixture id was attached by understat_map_fixture.py; this turns it into
a gameweek, which is the unit everything downstream works in.
"""

from pathlib import Path

from ml.config.seasons import SEASONS_ALL
from ml.utils.io import safe_read_csv


def run_one(season: str) -> Path:
    """Stamp gameweeks onto one season's Understat matches."""
    year = int(season.split("-")[0])
    us_mapped = Path(f"data/processed/understat/understat_matches_mapped_{season}.csv")
    fix2gw = Path(f"data/processed/mappings/fixture_to_gw_{season}.csv")
    out = Path(f"data/processed/understat/player_matches_EPL_{year}_all_with_gw.csv")

    if not us_mapped.exists():
        raise FileNotFoundError(f"Missing {us_mapped}")
    if not fix2gw.exists():
        raise FileNotFoundError(f"Missing {fix2gw}")

    df = safe_read_csv(us_mapped)
    m = safe_read_csv(fix2gw)

    # Left, so a match whose fixture never mapped keeps its row with a blank
    # GW. The printed rate below is how that is noticed.
    df = df.merge(m, on="fixture", how="left")

    out.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(out, index=False)

    print("Saved:", out)
    print("GW assigned %:", float(df["GW"].notna().mean()))
    return out


def main():
    """Stamp gameweeks onto Understat matches for every season."""
    for season in SEASONS_ALL:
        run_one(season)


if __name__ == "__main__":
    main()
