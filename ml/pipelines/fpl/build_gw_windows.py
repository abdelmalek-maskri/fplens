# ml/pipelines/fpl/build_gw_windows.py
import argparse
from pathlib import Path

import pandas as pd

from ml.config.seasons import SEASONS_ALL
from ml.utils.io import find_latest_snapshot, safe_read_csv

SNAPSHOT_ROOT = Path("data/raw/fpl")
OUT_DIR = Path("data/processed/mappings")


def run_one(season: str) -> Path:
    snap = find_latest_snapshot(SNAPSHOT_ROOT)

    gws_dir = snap / season / "gws"
    if not gws_dir.exists():
        raise FileNotFoundError(f"Missing {gws_dir}")

    rows = []
    for f in sorted(gws_dir.glob("gw*.csv")):
        gw = int(f.stem.replace("gw", ""))

        df = safe_read_csv(f)
        if "kickoff_time" not in df.columns:
            continue

        kt = pd.to_datetime(df["kickoff_time"], errors="coerce", utc=True).dropna()
        if kt.empty:
            continue

        rows.append(
            {
                "season": season,
                "GW": gw,
                "start_ts": kt.min().isoformat(),
                "end_ts": kt.max().isoformat(),
                "start_date": kt.min().date().isoformat(),
                "end_date": kt.max().date().isoformat(),
            }
        )

    if not rows:
        raise ValueError(f"No GW windows produced for season={season}. Check kickoff_time availability in {gws_dir}")

    out = OUT_DIR / f"gw_windows_{season}.csv"
    out.parent.mkdir(parents=True, exist_ok=True)

    w = pd.DataFrame(rows).sort_values("GW")
    w.to_csv(out, index=False)

    print(f"Saved: {out}")
    print(w.head(5).to_string(index=False))
    print("GW range:", int(w["GW"].min()), "->", int(w["GW"].max()))
    return out


def main() -> None:
    snap = find_latest_snapshot(SNAPSHOT_ROOT)
    for season in SEASONS_ALL:
        run_one(season)
    
    

if __name__ == "__main__":
    main()
