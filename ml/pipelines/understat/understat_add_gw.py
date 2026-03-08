from pathlib import Path

import pandas as pd

US_MATCHES = Path("data/processed/external/understat/player_matches_EPL_2016_all_filtered.csv")
GW_WINDOWS = Path("data/processed/mappings/gw_windows_2016-17.csv")

OUT = Path("data/processed/external/understat/player_matches_EPL_2016_all_with_gw.csv")


def run():
    us = pd.read_csv(US_MATCHES, low_memory=False)
    us["date_dt"] = pd.to_datetime(us["date"], errors="coerce", utc=False)

    gw = pd.read_csv(GW_WINDOWS, low_memory=False)
    gw["start_ts"] = pd.to_datetime(gw["start_ts"], errors="coerce", utc=True)
    gw["end_ts"] = pd.to_datetime(gw["end_ts"], errors="coerce", utc=True)

    # Understat 'date' is date-only; treat it as midday UTC for safe inclusion
    # (we only compare at date granularity anyway)
    us_date = pd.to_datetime(us["date_dt"].dt.date.astype(str) + " 12:00:00", utc=True)
    us["date_mid_utc"] = us_date

    def find_gw(ts):
        hit = gw[(gw["start_ts"] <= ts) & (ts <= gw["end_ts"])]
        if len(hit) == 1:
            return int(hit.iloc[0]["GW"])
        if len(hit) == 0:
            return pd.NA
        # overlap edge case: pick smallest GW
        return int(hit.sort_values("GW").iloc[0]["GW"])

    us["GW"] = us["date_mid_utc"].apply(find_gw)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    us.drop(columns=["date_dt"], errors="ignore").to_csv(OUT, index=False)

    print("✅ Saved:", OUT)
    print("GW assigned %:", float((us["GW"].notna()).mean()))
    print("Unassigned sample:")
    print(us[us["GW"].isna()][["date", "h_team", "a_team"]].head(10).to_string(index=False))


if __name__ == "__main__":
    run()
