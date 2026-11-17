"""The full feature set: everything in the baseline, plus four more families.

    Longer windows      roll10, so form is not read off three games alone
    Season averages     an expanding mean, for where a player sits overall
    Momentum            short window minus long, which way they are trending
    Availability        consecutive starts, minutes trend, games since start

Every one of them applies .shift(1) before its window. The roll-3 at GW10
uses GW 7, 8 and 9, never GW10, because GW10 is part of what is being
predicted.
"""

from pathlib import Path

import numpy as np
import pandas as pd

from ml.pipelines.features.build_future_fixtures import add_future_fixture_features

# ---------------------------------------------------------------------------
IN_PATH = Path("data/processed/merged/fpl_with_target.csv")
OUT_PATH = Path("data/features/extended_features.csv")

ROLL_WINDOWS = [3, 5, 10]
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

# A subset of BASE_NUM_COLS. Only the stats whose season-long level says
# something about a player get an expanding mean; the rest would just be a
# noisier copy of their rolling window.
SEASON_AVG_COLS = [
    "total_points",
    "minutes",
    "expected_goals",
    "expected_assists",
    "influence",
    "creativity",
    "threat",
    "bps",
]
# ---------------------------------------------------------------------------


def add_season_avg_features(df: pd.DataFrame, num_cols: list) -> pd.DataFrame:
    """Where a player sits across the season so far, not just lately.

    Expanding rather than rolling, so a player with twenty games is measured
    against all twenty. Grouped by season so last year's form does not leak
    into this one.
    """
    print("adding season average features...")

    g_season = df.groupby(["season", "element"], sort=False)

    new_cols = {}
    for col in num_cols:
        if col in SEASON_AVG_COLS:
            new_cols[f"{col}_season_avg"] = g_season[col].transform(
                lambda x: x.shift(1).expanding(min_periods=1).mean()
            )

    if new_cols:
        df = pd.concat([df, pd.DataFrame(new_cols, index=df.index)], axis=1)

    return df


def add_availability_features(df: pd.DataFrame, g) -> pd.DataFrame:
    """Whether a player is likely to be on the pitch at all.

    Predicted points are worth nothing if the player is rotated out, and the
    raw stats cannot tell a benched regular from an injured one.
    """
    print("adding availability features...")
    new_cols = {}

    # A long run of starts is the clearest signal that a manager trusts a
    # player, and it survives a quiet game or two where form does not.
    if "starts" in df.columns:

        def count_consecutive(x):
            """How many starts in a row end at each position in the series."""
            result = np.zeros(len(x))
            count = 0
            for i, val in enumerate(x):
                if val == 1:
                    count += 1
                else:
                    count = 0
                result[i] = count
            return result

        new_cols["consecutive_starts"] = g["starts"].transform(
            lambda x: pd.Series(count_consecutive(x.shift(1).fillna(0).values), index=x.index)
        )

    # Rising minutes usually means a player is working back into the side,
    # which the minutes figure alone cannot distinguish from a steady 60.
    if "minutes" in df.columns:
        new_cols["minutes_trend"] = g["minutes"].transform(
            lambda x: (
                x.shift(1)
                .rolling(window=3, min_periods=2)
                .apply(lambda w: (w.iloc[-1] - w.iloc[0]) / max(w.iloc[0], 1) if len(w) >= 2 else 0, raw=False)
            )
        )

    # The other half of consecutive_starts: how long they have been out of
    # the side, which is what separates rotation from a lost place.
    if "starts" in df.columns:

        def games_since_start(x):
            """How many games since the last start, at each position."""
            result = np.zeros(len(x))
            count = 0
            for i, val in enumerate(x):
                if val == 1:
                    count = 0
                else:
                    count += 1
                result[i] = count
            return result

        new_cols["games_since_start"] = g["starts"].transform(
            lambda x: pd.Series(games_since_start(x.shift(1).fillna(0).values), index=x.index)
        )

    if new_cols:
        df = pd.concat([df, pd.DataFrame(new_cols, index=df.index)], axis=1)

    return df


def add_form_momentum_features(df: pd.DataFrame, g) -> pd.DataFrame:
    """Which direction a player is heading, not just where they are.

    Short window minus long window. Positive means recent form is better
    than the season has been, which is the thing a manager is buying.
    """
    print("adding form momentum features...")
    new_cols = {}

    if "total_points_roll3" in df.columns and "total_points_roll10" in df.columns:
        new_cols["points_momentum"] = df["total_points_roll3"] - df["total_points_roll10"]

    # BPS moves before points do: a player winning bonus-point ranks is
    # playing well before the goals arrive.
    if "bps_roll3" in df.columns and "bps_roll10" in df.columns:
        new_cols["bps_momentum"] = df["bps_roll3"] - df["bps_roll10"]

    if "expected_goals_roll3" in df.columns and "expected_goals_roll10" in df.columns:
        new_cols["xg_momentum"] = df["expected_goals_roll3"] - df["expected_goals_roll10"]

    if new_cols:
        df = pd.concat([df, pd.DataFrame(new_cols, index=df.index)], axis=1)

    return df


def run() -> None:
    """Build the full feature set the production models train on."""
    print("=" * 60)
    print("Extended Feature Engineering")
    print("=" * 60)
    print("\nloading fpl_with_target...")
    df = pd.read_csv(IN_PATH, low_memory=False)

    df["GW"] = pd.to_numeric(df["GW"], errors="coerce")
    df["element"] = pd.to_numeric(df["element"], errors="coerce")

    # team is numeric IDs up to 2019-20 and club names after, so both halves
    # are read as str rather than as two different types.
    if "team" in df.columns:
        df["team"] = df["team"].astype(str)
    if "position" in df.columns:
        df["position"] = df["position"].astype(str)

    df = df.sort_values(["season", "element", "GW"]).reset_index(drop=True)
    g = df.groupby(["season", "element"], sort=False)

    # Picked up by prefix, so a new Understat stat gets lags and rolls
    # without being listed here too.
    us_cols = [c for c in df.columns if c.startswith("us_")]
    num_cols = []
    for c in BASE_NUM_COLS + us_cols:
        if c in df.columns:
            df[c] = pd.to_numeric(df[c], errors="coerce")
            num_cols.append(c)

    print(f"\nNumeric columns: {len(num_cols)}")
    print("\nbuilding baseline features...")

    new_cols = {}
    for col in num_cols:
        new_cols[f"{col}_lag1"] = g[col].shift(1)

    # shift(1) before the window, never after. Without it the roll-3 at GW10
    # would include GW10, which is part of what the model is predicting.
    for w in ROLL_WINDOWS:
        for col in num_cols:
            new_cols[f"{col}_roll{w}"] = g[col].transform(
                lambda x, _w=w: x.shift(1).rolling(window=_w, min_periods=1).mean()
            )

    if new_cols:
        df = pd.concat([df, pd.DataFrame(new_cols, index=df.index)], axis=1)

    # Whether they played at all, which a minutes figure cannot say: a
    # returning starter and a benched regular both show low minutes.
    if "minutes_lag1" in df.columns:
        df["played_lag1"] = (df["minutes_lag1"] > 0).astype(int)
    else:
        df["played_lag1"] = 0

    print("\nbuilding extended features...")
    df = add_season_avg_features(df, num_cols)
    df = add_availability_features(df, g)
    df = add_form_momentum_features(df, g)

    # Who they face over the next three gameweeks, which is the only thing
    # the GW+2 and GW+3 models know that the GW+1 model does not.
    print("\nbuilding future fixture features...")
    df = add_future_fixture_features(df)

    print("\ncleaning up...")

    # A player's first gameweek of a season has no history, so every lag is
    # missing and the row would teach the model nothing but its own target.
    before = len(df)
    if "total_points_lag1" in df.columns:
        df = df.dropna(subset=["total_points_lag1"]).copy()
    after = len(df)

    # Upstream merges can leave two columns of the same name, which pandas
    # tolerates and everything downstream does not.
    df = df.loc[:, ~df.columns.duplicated()].copy()

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

    # Matched by suffix rather than listed, so adding a feature family above
    # does not mean remembering to name it again here.
    feature_cols = [
        c
        for c in df.columns
        if (
            c.endswith("_lag1")
            or "_roll" in c
            or "_season_avg" in c
            or "_momentum" in c
            or c in ["consecutive_starts", "minutes_trend", "games_since_start"]
        )
        and c != "played_lag1"
    ]

    future_fixture_cols = [
        c
        for c in df.columns
        if c.startswith(("opponent_gw", "was_home_gw", "fdr_gw", "fdr_attack_gw", "fdr_defence_gw"))
    ]

    keep += feature_cols + future_fixture_cols
    out = df[keep].copy()

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    out.to_csv(OUT_PATH, index=False)
    print("\nSaved:", OUT_PATH)
    print(f"rows dropped (no lag history): {before - after}")
    print(f"final shape: {out.shape}")

    # Counted by suffix so the printed split reflects what was actually
    # written, not what this file intended to write.
    baseline_features = len([c for c in out.columns if "_roll3" in c or "_roll5" in c or c.endswith("_lag1")])
    extended_features = len([c for c in out.columns if "_roll10" in c or "_season_avg" in c or "_momentum" in c])
    availability_features = len(
        [c for c in out.columns if c in ["consecutive_starts", "minutes_trend", "games_since_start"]]
    )
    fixture_features = len(
        [
            c
            for c in out.columns
            if c.startswith(("opponent_gw", "was_home_gw", "fdr_gw", "fdr_attack_gw", "fdr_defence_gw"))
        ]
    )
    target_count = len([c for c in out.columns if c.startswith("points_")])

    print("\nFeature breakdown:")
    print(f"baseline (lag1, roll3, roll5): {baseline_features}")
    print(f"extended (roll10, season_avg, momentum): {extended_features}")
    print(f"availability: {availability_features}")
    print(f"future fixtures: {fixture_features}")
    print(f"targets: {target_count}")
    remaining = (
        len(out.columns)
        - baseline_features
        - extended_features
        - availability_features
        - fixture_features
        - target_count
    )
    print(f"metadata: {remaining}")
    print(f"total: {len(out.columns)}")


if __name__ == "__main__":
    run()
