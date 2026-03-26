# ml/pipelines/build_fpl_understat_mapping.py

"""
Build an FPL ↔ Understat player mapping for each season.

Notes:
- Only Understat players that appear in the filtered Understat matches file are considered.
- Matching is name-based because FPL and Understat do not share a common player ID.
"""

from pathlib import Path

import pandas as pd

from ml.config.seasons import SEASONS_ALL
from ml.utils.io import find_latest_snapshot, safe_read_csv
from ml.utils.name_normalize import norm

SNAPSHOT_ROOT = Path("data/raw/fpl")
UNDERSTAT_DIR = Path("data/raw/understat")
OUT_DIR = Path("data/processed/mappings")


def run_one(season: str, snapshot: Path) -> Path:
    """Build a player mapping CSV for a single season."""
    # Understat files use the season start year, e.g. 2023 for 2023-24.
    year = int(season.split("-")[0])
    season_dir = snapshot / season
    players_raw_path = season_dir / "players_raw.csv"
    understat_players_path = UNDERSTAT_DIR / f"players_EPL_{year}.csv"
    understat_matches_path = UNDERSTAT_DIR / f"player_matches_EPL_{year}_all_filtered.csv"
    out_path = OUT_DIR / f"fpl_to_understat_{season}.csv"

    # check required inputs exist before running.
    if not players_raw_path.exists():
        raise FileNotFoundError(f"missing FPL players_raw.csv: {players_raw_path}")
    if not understat_players_path.exists():
        raise FileNotFoundError(f"missing Understat players: {understat_players_path}")
    if not understat_matches_path.exists():
        raise FileNotFoundError(f"missing Understat matches: {understat_matches_path}")

    out_path.parent.mkdir(parents=True, exist_ok=True)

    # ------------------------------------------------------------------
    # 1) Load and prepare FPL players
    # ------------------------------------------------------------------
    fpl = safe_read_csv(players_raw_path)

    # Vaastav sometimes uses "id" instead of "element". Standardise to "element".
    if "id" in fpl.columns and "element" not in fpl.columns:
        fpl = fpl.rename(columns={"id": "element"})

    if "element" not in fpl.columns:
        raise ValueError(f"{players_raw_path} must contain 'element' (or 'id' to rename).")

    # keep only columns needed for name-based matching.
    keep_cols = [c for c in ["element", "first_name", "second_name", "web_name", "team"] if c in fpl.columns]
    fpl = fpl[keep_cols].drop_duplicates("element").copy()

    # build two FPL name variants:
    # - full name: first_name + second_name
    # - web name: display/shortened FPL name
    fpl["name_full"] = (
        fpl.get("first_name", "").fillna("").astype(str) + " " + fpl.get("second_name", "").fillna("").astype(str)
    ).str.strip()
    fpl["name_web"] = fpl.get("web_name", "").fillna("").astype(str)

    # normalise names to make matching more robust.
    fpl["n_full"] = fpl["name_full"].map(norm)
    fpl["n_web"] = fpl["name_web"].map(norm)

    # ------------------------------------------------------------------
    # 2) Load and prepare Understat players
    # ------------------------------------------------------------------
    us = safe_read_csv(understat_players_path).copy()

    if "id" not in us.columns or "player_name" not in us.columns:
        raise ValueError(f"{understat_players_path} must contain 'id' and 'player_name' columns.")

    # rename Understat player id to avoid confusion with FPL ids.
    us = us.rename(columns={"id": "us_player_id"})
    us["n_player"] = us["player_name"].map(norm)

    # ------------------------------------------------------------------
    # 3) Restrict Understat players to those that actually appear in matches
    # ------------------------------------------------------------------
    matches = safe_read_csv(understat_matches_path)

    if "us_player_id" not in matches.columns:
        raise ValueError(f"{understat_matches_path} must contain 'us_player_id'.")

    valid_ids = set(matches["us_player_id"].dropna().astype(int).unique())

    us["us_player_id"] = pd.to_numeric(us["us_player_id"], errors="coerce")
    us = us[us["us_player_id"].isin(valid_ids)].copy()

    # ------------------------------------------------------------------
    # 4) Strategy A: exact match on normalised full name
    # ------------------------------------------------------------------
    m1 = fpl.merge(
        us,
        left_on="n_full",
        right_on="n_player",
        how="left",
        suffixes=("_fpl", "_us"),
    )

    # ------------------------------------------------------------------
    # 5) Strategy B: exact match on normalised web/display name
    # ------------------------------------------------------------------
    m2 = fpl.merge(
        us,
        left_on="n_web",
        right_on="n_player",
        how="left",
        suffixes=("_fpl", "_us"),
    )

    # Keep a consistent output schema across all strategies.
    cols = ["element", "name_full", "web_name", "team", "us_player_id", "player_name", "team_title"]

    out1 = m1[[c for c in cols if c in m1.columns]].copy()
    out1["match_type"] = "full_name"

    out2 = m2[[c for c in cols if c in m2.columns]].copy()
    out2["match_type"] = "web_name"

    # ------------------------------------------------------------------
    # 6) Strategy C: token-subset matching for still-unmatched players
    #
    # Example:
    #   FPL:      "Gabriel Fernando de Jesus"
    #   Understat:"Gabriel Jesus"
    #
    # If all tokens of the shorter name are contained in the longer one,
    # treat it as a candidate match.
    # ------------------------------------------------------------------

    # identify FPL players already matched by strategies A or B.
    matched_by_ab = set()
    for df in [out1, out2]:
        matched_by_ab |= set(df.loc[df["us_player_id"].notna(), "element"])

    unmatched_fpl = fpl[~fpl["element"].isin(matched_by_ab)].copy()

    # identify Understat players already claimed by strategies A or B.
    claimed_us_ids = set()
    for df in [out1, out2]:
        claimed_us_ids |= set(df["us_player_id"].dropna().astype(int))

    unclaimed_us = us[~us["us_player_id"].isin(claimed_us_ids)].copy()

    # precompute token sets for remaining Understat players.
    us_tokens = {row.us_player_id: set(row.n_player.split()) for row in unclaimed_us.itertuples() if row.n_player}

    token_rows = []

    for row in unmatched_fpl.itertuples():
        fpl_toks = set(row.n_full.split()) if row.n_full else set()

        # skip very short names because they are too ambiguous.
        if len(fpl_toks) < 2:
            continue

        for us_id, us_toks in us_tokens.items():
            if len(us_toks) < 2:
                continue

            shorter, longer = (us_toks, fpl_toks) if len(us_toks) <= len(fpl_toks) else (fpl_toks, us_toks)

            # match if the shorter token set is fully contained in the longer one.
            if shorter <= longer:
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

        # keep only one token-based candidate per FPL player.
        out3 = out3.drop_duplicates("element", keep="first")
    else:
        out3 = pd.DataFrame(columns=list(cols) + ["match_type"])

    # ------------------------------------------------------------------
    # 7) Combine all candidate matches and choose the best one per element
    # ------------------------------------------------------------------
    comb = pd.concat([out1, out2, out3], ignore_index=True)

    # 1 if a candidate found an Understat player, else 0.
    comb["has_match"] = comb["us_player_id"].notna().astype(int)

    # prefer stronger strategies when multiple candidates exist.
    comb["priority"] = comb["match_type"].map({"full_name": 0, "web_name": 1, "token_subset": 2}).fillna(9).astype(int)

    # Sort so the best row appears first for each FPL element:
    # - matched rows before unmatched rows
    # - then full_name before web_name before token_subset
    comb = comb.sort_values(
        ["element", "has_match", "priority"],
        ascending=[True, False, True],
        kind="mergesort",
    )

    # keep the single best candidate per FPL player.
    best = comb.drop_duplicates("element", keep="first").copy()

    # add metadata for downstream use.
    best["season"] = season
    best["confidence"] = best["us_player_id"].notna().map({True: "high", False: "missing"})

    best.to_csv(out_path, index=False)
    print("saved:", out_path)
    print("season:", season, "| Understat YEAR:", year)
    print("total FPL elements:", len(best))
    print("matched:", int(best["us_player_id"].notna().sum()))
    print("unmatched:", int(best["us_player_id"].isna().sum()))

    # Show a sample of unmatched players for debugging.
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
