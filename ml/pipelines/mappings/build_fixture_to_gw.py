# ml/pipelines/mappings/build_fixture_to_gw.py
from pathlib import Path

import pandas as pd

from ml.config.seasons import SEASONS_ALL
from ml.utils.io import find_latest_snapshot, safe_read_csv


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
    for season in SEASONS_ALL:
        run_one(season)
    


if __name__ == "__main__":
    main()
