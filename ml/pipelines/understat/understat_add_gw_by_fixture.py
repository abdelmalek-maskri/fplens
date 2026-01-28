# ml/pipelines/understat_add_gw_by_fixture.py (9)
import argparse
from pathlib import Path
import pandas as pd


def run_one(season: str) -> Path:
    year = int(season.split("-")[0])

    us_mapped = Path(
        f"data/processed/external/understat/understat_matches_mapped_{season}.csv"
    )

    fix2gw = Path(f"data/processed/mappings/fixture_to_gw_{season}.csv")

    out = Path(
        f"data/processed/external/understat/player_matches_EPL_{year}_all_with_gw.csv"
    )

    if not us_mapped.exists():
        raise FileNotFoundError(f"Missing {us_mapped}")
    if not fix2gw.exists():
        raise FileNotFoundError(f"Missing {fix2gw}")

    df = pd.read_csv(us_mapped, low_memory=False)
    m = pd.read_csv(fix2gw, low_memory=False)

    #attach GW using fixture id
    df = df.merge(m, on="fixture", how="left")

    out.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(out, index=False)

    print("Saved:", out)
    print("GW assigned %:", float(df["GW"].notna().mean()))
    return out


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
