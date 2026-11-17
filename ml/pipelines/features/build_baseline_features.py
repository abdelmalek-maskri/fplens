"""The smaller of the two feature sets: lags and short rolling windows.

Kept alongside the extended set so an experiment can show what the extra
features in build_extended_features.py are actually worth.
"""

from pathlib import Path

import pandas as pd

# ---------------------------------------------------------------------------
IN_PATH = Path("data/processed/merged/fpl_with_target.csv")
OUT_PATH = Path("data/features/baseline_features.csv")
ROLL_WINDOWS = [3, 5]

# Every column that gets a lag and a rolling window. Anything not here is
# carried through as-is.
BASE_NUM_COLS = [
    "total_points",
    "minutes",
    "starts",
    "expected_goals",
    "expected_assists",
    "expected_goal_involvements",
    "expected_goals_conceded",
    "influence",
    "creativity",
    "threat",
    "ict_index",
    "bps",
    "bonus",
]
# ---------------------------------------------------------------------------


def run() -> None:
    """Build the baseline feature set: lags and short rolling windows."""
    print("loading fpl_with_target...")
    df = pd.read_csv(IN_PATH, low_memory=False)

    # Read as strings, GW 10 sorts before GW 2, and every lag below would
    # take its value from the wrong gameweek.
    df["GW"] = pd.to_numeric(df["GW"], errors="coerce")
    df["element"] = pd.to_numeric(df["element"], errors="coerce")

    # team is numeric IDs up to 2019-20 and club names after, so it is cast
    # to str to stop the two halves being read as different types.
    if "team" in df.columns:
        df["team"] = df["team"].astype(str)
    if "position" in df.columns:
        df["position"] = df["position"].astype(str)

    # Every feature below is a shift or a rolling window, which read rows by
    # position. This sort is what makes position mean time.
    df = df.sort_values(["season", "element", "GW"]).reset_index(drop=True)
    g = df.groupby(["season", "element"], sort=False)

    # Picked up by prefix so a new Understat stat gets lags and rolls without
    # being listed here as well.
    us_cols = [c for c in df.columns if c.startswith("us_")]
    num_cols = []
    for c in BASE_NUM_COLS + us_cols:
        if c in df.columns:
            df[c] = pd.to_numeric(df[c], errors="coerce")
            num_cols.append(c)

    for col in num_cols:
        df[f"{col}_lag1"] = g[col].shift(1)

    # shift(1) before the window, never after. Without it the roll-3 at GW10
    # would include GW10 itself, and the model would be told part of the
    # answer it is being asked to predict.
    for w in ROLL_WINDOWS:
        for col in num_cols:
            df[f"{col}_roll{w}"] = g[col].transform(lambda x, _w=w: x.shift(1).rolling(window=_w, min_periods=1).mean())

    # Whether they played last week, which carries different information from
    # how many minutes: a returning starter and a benched regular both show
    # low minutes, and only one of them played.
    if "minutes_lag1" in df.columns:
        df["played_lag1"] = (df["minutes_lag1"] > 0).astype(int)
    else:
        df["played_lag1"] = 0

    # A player's first gameweek of a season has no history, so every lag is
    # missing and the row would train the model on nothing but its target.
    before = len(df)
    if "total_points_lag1" in df.columns:
        df = df.dropna(subset=["total_points_lag1"]).copy()
    after = len(df)

    # Upstream merges can leave two columns of the same name, which pandas
    # tolerates and everything downstream does not.
    df = df.loc[:, ~df.columns.duplicated()].copy()
    df = df.drop(columns=[c for c in df.columns if c.startswith("played_lag1.")], errors="ignore")

    keep = [
        "season",
        "GW",
        "element",
        "name",
        "position",
        "team",
        "was_home",
        "opponent_team",
        "value",
        "points_next_gw",
        "points_gw_plus_2",
        "points_gw_plus_3",
        "played_lag1",
    ]
    keep = [c for c in keep if c in df.columns]

    feature_cols = [c for c in df.columns if (c.endswith("_lag1") or "_roll" in c) and c != "played_lag1"]
    keep += feature_cols

    out = df[keep].copy()

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    out.to_csv(OUT_PATH, index=False)

    print("Saved:", OUT_PATH)
    print("Rows dropped (no lag history):", before - after)
    print("Final shape:", out.shape)
    print("Example columns:", out.columns[:25].tolist())


if __name__ == "__main__":
    run()
