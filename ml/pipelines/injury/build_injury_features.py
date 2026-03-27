"""
Build 28 injury features from the FPL API's status and news fields.

Two feature groups:

1. Structured (13 features): status encoded as integer, chance_of_playing
   this/next round, binary flags (is_injured, is_doubtful, is_suspended),
   temporal patterns (gws_since_last_injury, consecutive_gws_missed).

2. News-extracted (15 features): regex on FPL's short news string to classify
   injury type (hamstring, knee, illness, etc.), estimate return timeline,
   and detect sentiment (returned to training vs ruled out).
"""

import re
from datetime import datetime
from pathlib import Path

import numpy as np
import pandas as pd

INPUT_PATH = Path("data/processed/injury/fpl_with_injury.csv")
EXTENDED_FEATURES = Path("data/features/extended_features.csv")
OUTPUT_DIR = Path("data/features")

# Ordinal encoding: higher = worse availability (n = not in squad)
STATUS_MAP = {"a": 0, "d": 1, "i": 2, "u": 3, "s": 4, "n": 5}

# First match wins, so specific body parts come before generic "muscle"/"fitness"
INJURY_PATTERNS = {
    "hamstring": r"hamstring",
    "knee": r"knee|acl|mcl|pcl|meniscus",
    "ankle": r"ankle",
    "groin": r"groin|adductor",
    "calf": r"calf",
    "thigh": r"thigh|quad",
    "back": r"back|spine",
    "shoulder": r"shoulder",
    "foot": r"foot|toe|metatarsal",
    "illness": r"ill|virus|flu|covid|sick",
    "head": r"head|concussion",
    "muscle": r"muscle",
    "fitness": r"fitness|match fit",
    "personal": r"personal|family|compassionate",
    "loan": r"loan",
    "not_registered": r"not registered|ineligible",
}

# Word-boundary matching to avoid false positives ("back" in "setback")
_NEGATIVE_KEYWORDS = [
    "injury",
    "injured",
    "out",
    "miss",
    "ruled out",
    "sidelined",
    "surgery",
    "operation",
    "torn",
    "broken",
    "fracture",
    "unknown return",
    "indefinite",
    "long-term",
    "serious",
    "concern",
    "doubt",
    "doubtful",
    "suspended",
    "ban",
]
_POSITIVE_KEYWORDS = [
    "return",
    "back",
    "fit",
    "available",
    "training",
    "recovered",
    "cleared",
    "ready",
    "resumed",
    "minor",
    "precaution",
    "rest",
]
_NEGATIVE_PATTERNS = [re.compile(r"\b" + re.escape(kw) + r"\b") for kw in _NEGATIVE_KEYWORDS]
_POSITIVE_PATTERNS = [re.compile(r"\b" + re.escape(kw) + r"\b") for kw in _POSITIVE_KEYWORDS]

_MAX_RETURN_WEEKS = 26  # ~half a season; cap to avoid outlier dates
_UNKNOWN_RETURN_WEEKS = 12.0  # "unknown"/"indefinite" = assume ~3 months
_DEFAULT_SHORT_TERM_WEEKS = 2.0

_MONTHS = {
    "jan": 1,
    "feb": 2,
    "mar": 3,
    "apr": 4,
    "may": 5,
    "jun": 6,
    "jul": 7,
    "aug": 8,
    "sep": 9,
    "oct": 10,
    "nov": 11,
    "dec": 12,
}

# Fill values for missing injury data (assumes player is fully available)
FILL_DEFAULTS = {
    "status_encoded": 0,
    "is_available": 1,
    "is_injured": 0,
    "is_doubtful": 0,
    "chance_this_round": 100,
    "chance_next_round": 100,
    "has_news": 0,
    "consecutive_gws_out": 0,
    "gws_since_last_injury": 38,  # never injured -> max season distance
    "injury_count_season": 0,
    "chance_delta": 0,
    "recovery_trajectory": 0,
    "expected_return_weeks": 0,
    "news_sentiment": 0,
}


# Structured features (13 cols: status encoding, chance fields, binary flags)
def add_structured_features(df: pd.DataFrame) -> pd.DataFrame:
    print("Adding structured features...")
    df = df.copy()

    df["status_encoded"] = df["status"].map(STATUS_MAP).fillna(0).astype(int)
    df["is_available"] = (df["status"] == "a").astype(int)
    df["is_injured"] = (df["status"] == "i").astype(int)
    df["is_doubtful"] = (df["status"] == "d").astype(int)

    # FPL API leaves chance fields null when player is available
    df["chance_this_round"] = df["chance_of_playing_this_round"].fillna(df["is_available"] * 100)
    df["chance_next_round"] = df["chance_of_playing_next_round"].fillna(df["is_available"] * 100)

    df["has_news"] = (df["news"].notna() & (df["news"] != "")).astype(int)

    return df


def add_temporal_features(df: pd.DataFrame) -> pd.DataFrame:
    print("Adding temporal features...")
    df = df.copy()
    df = df.sort_values(["season", "element", "GW"])

    grouped = df.groupby(["season", "element"], sort=False)

    df["consecutive_gws_out"] = grouped["status"].transform(_consecutive_unavailable)
    df["gws_since_last_injury"] = grouped["status"].transform(_gws_since_injury)
    df["injury_count_season"] = grouped["status"].transform(_injury_episode_count)
    df["chance_delta"] = grouped["chance_this_round"].diff().fillna(0.0)
    df["recovery_trajectory"] = grouped["chance_delta"].transform(lambda s: s.rolling(3, min_periods=1).mean())

    return df


def _consecutive_unavailable(status: pd.Series) -> pd.Series:
    counts = []
    streak = 0
    for s in status:
        streak = streak + 1 if s != "a" else 0
        counts.append(streak)
    return pd.Series(counts, index=status.index)


def _gws_since_injury(status: pd.Series) -> pd.Series:
    result = []
    last_injured = None
    for i, s in enumerate(status):
        if s == "i":
            last_injured = i
            result.append(0)
        elif last_injured is not None:
            result.append(i - last_injured)
        else:
            result.append(38)
    return pd.Series(result, index=status.index)


def _injury_episode_count(status: pd.Series) -> pd.Series:
    result = []
    count = 0
    prev = "a"
    for s in status:
        if s == "i" and prev != "i":
            count += 1
        result.append(count)
        prev = s
    return pd.Series(result, index=status.index)


# NLP features (15 cols: injury type dummies, return timeline, sentiment)
def extract_injury_type(news: str) -> str:
    if pd.isna(news) or news == "":
        return "none"

    news_lower = str(news).lower()

    for injury_type, pattern in INJURY_PATTERNS.items():
        if re.search(pattern, news_lower):
            return injury_type

    if re.search(r"injur", news_lower):
        return "other_injury"

    return "other"


def extract_return_weeks(news: str, snapshot_date=None) -> float:
    if pd.isna(news) or news == "":
        return 0.0

    news_str = str(news)

    if re.search(r"unknown|indefinite", news_str, re.IGNORECASE):
        return _UNKNOWN_RETURN_WEEKS

    # "expected back DD MMM"
    match = re.search(r"[Ee]xpected back (\d{1,2})\s*([A-Za-z]{3,})", news_str)
    if match and snapshot_date:
        weeks = _parse_return_date(match, snapshot_date)
        if weeks is not None:
            return weeks

    # Try range first to prevent partial match ("3-4 weeks" vs "4 weeks")
    match = re.search(r"(\d+)-(\d+)\s*weeks?", news_str, re.IGNORECASE)
    if match:
        avg = (float(match.group(1)) + float(match.group(2))) / 2
        return min(avg, _MAX_RETURN_WEEKS)

    match = re.search(r"(\d+)\s*weeks?", news_str, re.IGNORECASE)
    if match:
        return min(float(match.group(1)), _MAX_RETURN_WEEKS)

    return _DEFAULT_SHORT_TERM_WEEKS


def _parse_return_date(match: re.Match, snapshot_date) -> float | None:
    """convert a 'DD MMM' return date to weeks from snapshot_date."""
    day = int(match.group(1))
    month_str = match.group(2)[:3].lower()

    if month_str not in _MONTHS:
        return None

    try:
        snap = pd.to_datetime(snapshot_date) if isinstance(snapshot_date, str) else snapshot_date
        year = snap.year
        if _MONTHS[month_str] < snap.month:
            year += 1
        return_date = datetime(year, _MONTHS[month_str], day)
        weeks = (return_date - snap.to_pydatetime()).days / 7
        return max(0.0, min(weeks, _MAX_RETURN_WEEKS))
    except (ValueError, TypeError):
        return None


def news_sentiment(news: str) -> float:
    """Keyword-based sentiment score in [-1, +1]."""
    if pd.isna(news) or news == "":
        return 0.0

    news_lower = str(news).lower()

    neg_count = sum(1 for p in _NEGATIVE_PATTERNS if p.search(news_lower))
    pos_count = sum(1 for p in _POSITIVE_PATTERNS if p.search(news_lower))

    total = neg_count + pos_count
    if total == 0:
        return 0.0

    return (pos_count - neg_count) / total


def add_nlp_features(df: pd.DataFrame) -> pd.DataFrame:
    print("adding NLP features...")
    df = df.copy()

    print("classifying injury types...")
    df["injury_type"] = df["news"].apply(extract_injury_type)
    injury_dummies = pd.get_dummies(df["injury_type"], prefix="injury")
    df = pd.concat([df, injury_dummies], axis=1)

    print("estimating return dates...")
    df["expected_return_weeks"] = df.apply(
        lambda row: extract_return_weeks(row["news"], row.get("snapshot_date")),
        axis=1,
    )

    print("scoring sentiment...")
    df["news_sentiment"] = df["news"].apply(news_sentiment)

    return df


# Merge with extended features
def _merge_with_extended(df: pd.DataFrame) -> pd.DataFrame:
    from ml.pipelines.injury.download_historical import SEASONS as INJURY_SEASONS

    print("\nmerging with extended features...")
    extended_df = pd.read_csv(EXTENDED_FEATURES, low_memory=False)

    # injury_count_season appears in FILL_DEFAULTS AND matches "injury_*" prefix
    injury_feature_set = dict.fromkeys(FILL_DEFAULTS.keys())
    injury_feature_set.update((c, None) for c in df.columns if c.startswith("injury_") and c != "injury_type")

    merge_keys = ["season", "GW", "element"]
    available_cols = [c for c in injury_feature_set if c in df.columns]
    injury_subset = df[merge_keys + available_cols].drop_duplicates(subset=merge_keys)

    for col_df in [extended_df, injury_subset]:
        col_df["season"] = col_df["season"].astype(str)
        col_df["GW"] = pd.to_numeric(col_df["GW"], errors="coerce")
        col_df["element"] = pd.to_numeric(col_df["element"], errors="coerce")

    # Drop stale injury columns from prior runs to avoid _x/_y suffixes
    overlap = set(extended_df.columns) & set(injury_subset.columns) - set(merge_keys)
    if overlap:
        print(f"dropping {len(overlap)} stale columns from base: {sorted(overlap)[:5]}...")
        extended_df = extended_df.drop(columns=overlap)

    combined = extended_df.merge(injury_subset, on=merge_keys, how="left")
    combined = combined.reset_index(drop=True)

    # Pre-2018 seasons have no injury snapshots. We leave them as NaN rather
    # than filling with "available" defaults, because LightGBM learns optimal
    # split direction for NaN, treating missing as "unknown" rather than "healthy"
    has_injury = combined["season"].isin(INJURY_SEASONS).values
    all_injury_cols = list(
        dict.fromkeys(list(FILL_DEFAULTS.keys()) + [c for c in combined.columns if c.startswith("injury_")])
    )
    for col in all_injury_cols:
        if col in combined.columns:
            combined[col] = combined[col].astype(float)
            combined.loc[~has_injury, col] = np.nan

    n_real = has_injury.sum()
    n_nan = (~has_injury).sum()
    print(f"Seasons with real injury data: {n_real:,} rows")
    print(f"Pre-injury seasons (set to NaN): {n_nan:,} rows")

    # Fill defaults only for injury seasons (GW1 gaps, missing snapshots)
    for col, default in FILL_DEFAULTS.items():
        if col in combined.columns:
            mask = has_injury & combined[col].isna().values
            combined.loc[mask, col] = default
        else:
            combined[col] = np.where(has_injury, default, np.nan)

    for col in combined.columns:
        if col.startswith("injury_"):
            mask = has_injury & combined[col].isna().values
            combined.loc[mask, col] = 0

    return combined


# Main
def run() -> None:
    print("=" * 60)
    print("BUILD INJURY FEATURES")
    print("=" * 60)
    print("\nLoading data...")
    df = pd.read_csv(INPUT_PATH, low_memory=False)
    print(f"{len(df):,} rows loaded")

    df = add_structured_features(df)
    df = add_temporal_features(df)

    structured_cols = ["season", "GW", "element"] + [
        "status_encoded",
        "is_available",
        "is_injured",
        "is_doubtful",
        "chance_this_round",
        "chance_next_round",
        "has_news",
        "consecutive_gws_out",
        "gws_since_last_injury",
        "injury_count_season",
        "chance_delta",
        "recovery_trajectory",
    ]
    df[structured_cols].to_csv(OUTPUT_DIR / "injury_features_structured.csv", index=False)
    print(f"saved structured -> {OUTPUT_DIR / 'injury_features_structured.csv'}")

    df = add_nlp_features(df)

    all_cols = structured_cols + ["injury_type", "expected_return_weeks", "news_sentiment"]
    all_cols.extend(c for c in df.columns if c.startswith("injury_") and c not in all_cols)
    df[[c for c in all_cols if c in df.columns]].to_csv(OUTPUT_DIR / "injury_features_all.csv", index=False)
    print(f"Saved all injury -> {OUTPUT_DIR / 'injury_features_all.csv'}")

    combined = _merge_with_extended(df)
    combined.to_csv(OUTPUT_DIR / "extended_with_injury.csv", index=False)

    print(f"\n{'=' * 60}")
    print("BUILD COMPLETE")
    print(f"{'=' * 60}")
    print(f"Output: {OUTPUT_DIR / 'extended_with_injury.csv'}")
    print(f"Shape:  {combined.shape}")
    print("\nInjury feature summary:")
    print(f"Injury types found:      {df['injury_type'].nunique()}")
    print(f"Players with news:       {(df['has_news'] == 1).sum():,}")
    print(f"Max consecutive GWs out: {df['consecutive_gws_out'].max()}")
    print(f"Players ever injured:    {(df['injury_count_season'] > 0).sum():,}")
    print("\nInjury type distribution (top 10):")
    print(df["injury_type"].value_counts().head(10).to_string())


if __name__ == "__main__":
    run()
