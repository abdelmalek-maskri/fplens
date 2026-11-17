"""Map each FPL fixture id to the gameweek it was played in.

Understat records matches by date, not gameweek, so this is the lookup that
lets its rows be attached to an FPL gameweek later in the pipeline.
"""

from pathlib import Path

import pandas as pd

from ml.config.seasons import SEASONS_ALL
from ml.utils.io import find_latest_snapshot, safe_read_csv


def run_one(season: str) -> Path:
    """Build one season's fixture-to-gameweek lookup."""
    snap = find_latest_snapshot(Path("data/raw/fpl"))
    gws_dir = snap / season / "gws"
    if not gws_dir.exists():
        raise FileNotFoundError(f"Missing {gws_dir}")

    rows = []

    # The gameweek is the filename, not a column, so each file is read for
    # the fixture ids it mentions and labelled with its own number.
    for f in sorted(gws_dir.glob("gw*.csv")):
        gw = int(f.stem.replace("gw", ""))
        df = safe_read_csv(f)

        if "fixture" not in df.columns:
            continue

        fx = pd.to_numeric(df["fixture"], errors="coerce").dropna().astype(int)
        rows.append(pd.DataFrame({"fixture": fx.unique(), "GW": gw}))

    # A fixture appears once per player who played in it, so the same pair
    # repeats across hundreds of rows.
    m = pd.concat(rows, ignore_index=True).drop_duplicates("fixture")

    out = Path(f"data/processed/mappings/fixture_to_gw_{season}.csv")
    out.parent.mkdir(parents=True, exist_ok=True)
    m.to_csv(out, index=False)

    print(f"saved: {out} rows: {len(m)}")
    return out


def main():
    """Build the fixture-to-gameweek lookup for every season."""
    for season in SEASONS_ALL:
        run_one(season)


if __name__ == "__main__":
    main()
