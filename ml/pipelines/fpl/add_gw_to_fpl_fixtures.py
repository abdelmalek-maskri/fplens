import pandas as pd
from pathlib import Path

SEASON = "2016-17"

FIX_IN  = Path(f"data/processed/mappings/fpl_fixtures_{SEASON}.csv")
WIN_IN  = Path(f"data/processed/mappings/gw_windows_{SEASON}.csv")
FIX_OUT = Path(f"data/processed/mappings/fpl_fixtures_{SEASON}_with_gw.csv")

def run():
    fx = pd.read_csv(FIX_IN, parse_dates=["kickoff_time"])
    win = pd.read_csv(WIN_IN)

    # parse GW windows timestamps
    win["start_ts"] = pd.to_datetime(win["start_ts"], utc=True, errors="coerce")
    win["end_ts"]   = pd.to_datetime(win["end_ts"], utc=True, errors="coerce")

    # ensure kickoff_time is tz-aware UTC
    fx["kickoff_time"] = pd.to_datetime(fx["kickoff_time"], utc=True, errors="coerce")

    # assign GW by checking which window contains kickoff_time
    # (380 fixtures so O(380*38) is totally fine)
    gw = []
    for t in fx["kickoff_time"]:
        m = win[(win["start_ts"] <= t) & (t <= win["end_ts"])]
        gw.append(int(m["GW"].iloc[0]) if len(m) else None)

    fx["GW"] = gw

    # sanity checks
    print("GW assigned %:", float(pd.Series(gw).notna().mean()))
    if fx["GW"].isna().any():
        print("Unassigned fixtures sample:")
        print(fx.loc[fx["GW"].isna(), ["fixture", "kickoff_time", "home_team_id", "away_team_id"]].head(10).to_string(index=False))

    FIX_OUT.parent.mkdir(parents=True, exist_ok=True)
    fx.to_csv(FIX_OUT, index=False)

    print("✅ Saved:", FIX_OUT)
    print("Rows:", len(fx))
    print(fx.head(8).to_string(index=False))

if __name__ == "__main__":
    run()
