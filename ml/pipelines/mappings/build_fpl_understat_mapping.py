# ml/pipelines/build_fpl_understat_mapping.py (7)

"""
Build FPL ↔ Understat player mapping for a given FPL season string (e.g. "2016-17").

Notes:
- Filters Understat players to only those with matches in the Understat matches file
"""

from pathlib import Path

import pandas as pd

from ml.config.seasons import SEASONS_ALL
from ml.utils.io import find_latest_snapshot
from ml.utils.name_normalize import norm

SNAPSHOT_ROOT = Path("data/raw/fpl")
UNDERSTAT_DIR = Path("data/processed/external/understat")
OUT_DIR = Path("data/processed/mappings")


def run_one(season: str, snapshot: Path) -> Path:
    """Build mapping CSV for a single season."""
    year = int(season.split("-")[0])
    season_dir = snapshot / season
    players_raw_path = season_dir / "players_raw.csv"

    if not players_raw_path.exists():
        raise FileNotFoundError(f"Missing FPL players_raw.csv: {players_raw_path}")

    understat_players_path = UNDERSTAT_DIR / f"players_EPL_{year}.csv"
    understat_matches_path = UNDERSTAT_DIR / f"player_matches_EPL_{year}_all_filtered.csv"

    if not understat_players_path.exists():
        raise FileNotFoundError(f"Missing Understat players: {understat_players_path}")
    if not understat_matches_path.exists():
        raise FileNotFoundError(f"Missing Understat matches: {understat_matches_path}")

    out_path = OUT_DIR / f"fpl_to_understat_{season}.csv"
    out_path.parent.mkdir(parents=True, exist_ok=True)

    # =========================
    # 1) Load FPL players
    # =========================
    fpl = pd.read_csv(players_raw_path, low_memory=False)

    # Vaastav sometimes uses "id" for the player element id; normalize to "element"
    if "id" in fpl.columns and "element" not in fpl.columns:
        fpl = fpl.rename(columns={"id": "element"})

    if "element" not in fpl.columns:
        raise ValueError(f"{players_raw_path} must contain 'element' (or 'id' to rename).")

    # Keep only columns relevant to building a name-based mapping
    keep_cols = [c for c in ["element", "first_name", "second_name", "web_name", "team"] if c in fpl.columns]
    fpl = fpl[keep_cols].drop_duplicates("element").copy()

    # Build two candidate name strings:
    # - name_full: first + second
    # - name_web: web_name (often a shortened or display name)
    fpl["name_full"] = (
        fpl.get("first_name", "").fillna("").astype(str) + " " + fpl.get("second_name", "").fillna("").astype(str)
    ).str.strip()
    fpl["name_web"] = fpl.get("web_name", "").fillna("").astype(str)

    # Normalize names for robust matching (case, spaces, accents, punctuation, etc.)
    fpl["n_full"] = fpl["name_full"].map(norm)
    fpl["n_web"] = fpl["name_web"].map(norm)

    # =========================
    # 2) Load Understat players
    # =========================
    us = pd.read_csv(understat_players_path, low_memory=False).copy()

    if "id" not in us.columns or "player_name" not in us.columns:
        raise ValueError(f"{understat_players_path} must contain 'id' and 'player_name' columns.")

    # Rename Understat id to avoid confusion with FPL ids
    us = us.rename(columns={"id": "us_player_id"})
    us["n_player"] = us["player_name"].map(norm)

    # =========================
    # 3) Restrict Understat players to those with match rows
    #  prevents mapping to players that never appear in matches file
    # =========================
    matches = pd.read_csv(understat_matches_path, low_memory=False)

    if "us_player_id" not in matches.columns:
        raise ValueError(f"{understat_matches_path} must contain 'us_player_id'.")

    valid_ids = set(matches["us_player_id"].dropna().astype(int).unique())

    us["us_player_id"] = pd.to_numeric(us["us_player_id"], errors="coerce")
    us = us[us["us_player_id"].isin(valid_ids)].copy()

    # =========================
    # 4) Name-based merges (candidate mappings)
    # =========================

    # Strategy A: match FPL normalized full name to Understat normalized player_name
    m1 = fpl.merge(
        us,
        left_on="n_full",
        right_on="n_player",
        how="left",
        suffixes=("_fpl", "_us"),
    )

    # Strategy B: match FPL normalized web_name to Understat normalized player_name
    m2 = fpl.merge(
        us,
        left_on="n_web",
        right_on="n_player",
        how="left",
        suffixes=("_fpl", "_us"),
    )

    # Keep a consistent output schema (only keep columns that exist)
    cols = ["element", "name_full", "web_name", "team", "us_player_id", "player_name", "team_title"]

    out1 = m1[[c for c in cols if c in m1.columns]].copy()
    out1["match_type"] = "full_name"

    out2 = m2[[c for c in cols if c in m2.columns]].copy()
    out2["match_type"] = "web_name"

    # =========================
    # 4b) Strategy C: token-subset matching for remaining unmatched
    #     Handles "Gabriel Fernando de Jesus" <-> "Gabriel Jesus" by checking
    #     if the shorter name's tokens are all contained in the longer name.
    # =========================

    # Identify elements already matched by A or B
    matched_by_ab = set()
    for df in [out1, out2]:
        matched_by_ab |= set(df.loc[df["us_player_id"].notna(), "element"])

    unmatched_fpl = fpl[~fpl["element"].isin(matched_by_ab)].copy()

    # also identify Understat players already claimed by A or B
    claimed_us_ids = set()
    for df in [out1, out2]:
        claimed_us_ids |= set(df["us_player_id"].dropna().astype(int))

    unclaimed_us = us[~us["us_player_id"].isin(claimed_us_ids)].copy()

    # Precompute token sets for unclaimed Understat players
    us_tokens = {row.us_player_id: set(row.n_player.split()) for row in unclaimed_us.itertuples() if row.n_player}

    token_rows = []
    for row in unmatched_fpl.itertuples():
        fpl_toks = set(row.n_full.split()) if row.n_full else set()
        if len(fpl_toks) < 2:
            continue
        for us_id, us_toks in us_tokens.items():
            if len(us_toks) < 2:
                continue
            shorter, longer = (us_toks, fpl_toks) if len(us_toks) <= len(fpl_toks) else (fpl_toks, us_toks)
            if shorter <= longer:  # subset check
                us_row = unclaimed_us.loc[unclaimed_us["us_player_id"] == us_id].iloc[0]
                token_rows.append(
                    {
                        "element": row.element,
                        "name_full": row.name_full,
                        "web_name": row.name_web,
                        "team": row.team,
                        "us_player_id": us_id,
                        "player_name": us_row["player_name"],
                        "team_title": us_row.get("team_title", ""),
                        "match_type": "token_subset",
                    }
                )

    if token_rows:
        out3 = pd.DataFrame(token_rows)
        # Deduplicate: keep only one match per FPL element (first found)
        out3 = out3.drop_duplicates("element", keep="first")
    else:
        out3 = pd.DataFrame(columns=list(cols) + ["match_type"])

    # =========================
    # 5) Combine candidates and choose best per FPL element
    # =========================
    comb = pd.concat([out1, out2, out3], ignore_index=True)

    # has_match = 1 if we found an Understat id, else 0
    comb["has_match"] = comb["us_player_id"].notna().astype(int)

    # Prefer full_name > web_name > token_subset when multiple exist
    comb["priority"] = comb["match_type"].map({"full_name": 0, "web_name": 1, "token_subset": 2}).fillna(9).astype(int)

    # Sort so "best" row is first per element:
    # - matched rows first
    # - then full_name before web_name
    comb = comb.sort_values(
        ["element", "has_match", "priority"],
        ascending=[True, False, True],
        kind="mergesort",  # stable sorting
    )

    # Keep the single best candidate per FPL player element
    best = comb.drop_duplicates("element", keep="first").copy()

    # Add metadata
    best["season"] = season
    best["confidence"] = best["us_player_id"].notna().map({True: "high", False: "missing"})

    # Save mapping
    best.to_csv(out_path, index=False)

    # Basic reporting
    print("Saved:", out_path)
    print("Season:", season, "| Understat YEAR:", year)
    print("Total FPL elements:", len(best))
    print("Matched:", int(best["us_player_id"].notna().sum()))
    print("Unmatched:", int(best["us_player_id"].isna().sum()))

    # Print a few examples of missing matches for debugging
    missing = best[best["us_player_id"].isna()].head(20)
    if len(missing):
        print("\nExamples unmatched (first 20):")
        show_cols = [c for c in ["element", "name_full", "web_name", "team"] if c in missing.columns]
        print(missing[show_cols].to_string(index=False))

    return out_path


def main() -> None:
    snap = find_latest_snapshot(SNAPSHOT_ROOT)

    for season in SEASONS_ALL:
        print("\n=== Processing season:", season, "===")
        run_one(season, snap)


if __name__ == "__main__":
    main()
