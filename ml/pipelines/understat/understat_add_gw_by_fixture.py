# ml/pipelines/understat_add_gw_by_fixture.py
import argparse
from pathlib import Path
import pandas as pd


def run_one(season: str) -> Path:
    year = int(season.split("-")[0])

    under_mapped = Path(
        f"data/processed/external/understat/understat_matches_mapped_{season}.csv"
    )
    fix2gw = Path(f"data/processed/mappings/fixture_to_gw_{season}.csv")

    out = Path(
        f"data/processed/external/understat/player_matches_EPL_{year}_all_with_gw.csv"
    )

    if not under_mapped.exists():
        raise FileNotFoundError(f"Missing {under_mapped}")
    if not fix2gw.exists():
        raise FileNotFoundError(f"Missing {fix2gw}")

    df = pd.read_csv(under_mapped, low_memory=False)
    m = pd.read_csv(fix2gw, low_memory=False)

    # Attach GW using fixture id
    df = df.merge(m, on="fixture", how="left")

    out.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(out, index=False)

    print("✅ Saved:", out)
    print("GW assigned %:", float(df["GW"].notna().mean()))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--season", required=True)
    args = ap.parse_args()
    run_one(args.season)


if __name__ == "__main__":
    main()
