# ml/pipelines/build_fixture_to_gw.py (4) 
import argparse
from pathlib import Path
import pandas as pd

from ml.utils.io import safe_read_csv


def find_latest_snapshot(root: Path) -> Path:
    """return the most recent Vaastav FPL snapshot directory."""
    snaps = sorted([p for p in root.glob("vaastav_snapshot_*") if p.is_dir()])
    if not snaps:
        raise FileNotFoundError("No snapshot found under data/raw/fpl/vaastav_snapshot_*")
    return snaps[-1]


def run_one(season: str) -> Path:
    snap = find_latest_snapshot(Path("data/raw/fpl"))
    gws_dir = snap / season / "gws"
    if not gws_dir.exists():
        raise FileNotFoundError(f"Missing {gws_dir}")

    rows = []

    # Extract fixture -> GW mapping from each gameweek file
    for f in sorted(gws_dir.glob("gw*.csv")):
        gw = int(f.stem.replace("gw", ""))
        df = safe_read_csv(f)

        if "fixture" not in df.columns:
            continue

        fx = pd.to_numeric(df["fixture"], errors="coerce").dropna().astype(int)
        rows.append(pd.DataFrame({"fixture": fx.unique(), "GW": gw}))

    #one row per fixture
    m = pd.concat(rows, ignore_index=True).drop_duplicates("fixture")

    out = Path(f"data/processed/mappings/fixture_to_gw_{season}.csv")
    out.parent.mkdir(parents=True, exist_ok=True)
    m.to_csv(out, index=False)

    print(f"Saved: {out} rows: {len(m)}")
    return out


def main():
    # ap = argparse.ArgumentParser()
    # ap.add_argument("--season", required=True)
    # args = ap.parse_args()
    # run_one(args.season)

    SEASONS = ["2016-17", "2017-18", "2018-19", 
               "2019-20","2020-21", "2021-22", 
               "2022-23", "2023-24", "2024-25",
               "2025-26"]
    
    for season in SEASONS:
        run_one(season)
    


if __name__ == "__main__":
    main()
