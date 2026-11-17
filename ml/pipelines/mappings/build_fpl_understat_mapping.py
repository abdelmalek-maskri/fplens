"""Build an FPL to Understat player mapping for each season.

The two sources share no player ID, so the only thing to join on is the name,
and neither spells them the same way. Three strategies run in order of how
much they can be trusted, and each player keeps the best match found.

Only Understat players who appear in the filtered matches file are considered,
so a player listed for the season but never on the pitch cannot absorb a match
intended for someone else.
"""

from pathlib import Path

import pandas as pd

from ml.config.seasons import SEASONS_ALL
from ml.utils.io import find_latest_snapshot, safe_read_csv
from ml.utils.name_normalize import norm

# ---------------------------------------------------------------------------
SNAPSHOT_ROOT = Path("data/raw/fpl")
UNDERSTAT_DIR = Path("data/raw/understat")
OUT_DIR = Path("data/processed/mappings")
# ---------------------------------------------------------------------------


def run_one(season: str, snapshot: Path) -> Path:
    """Build a player mapping CSV for a single season."""
    # Understat files use the season start year, e.g. 2023 for 2023-24.
    year = int(season.split("-")[0])
    season_dir = snapshot / season
    players_raw_path = season_dir / "players_raw.csv"
    understat_players_path = UNDERSTAT_DIR / f"players_EPL_{year}.csv"
    understat_matches_path = UNDERSTAT_DIR / f"player_matches_EPL_{year}_all_filtered.csv"
    out_path = OUT_DIR / f"fpl_to_understat_{season}.csv"

    # Checked up front rather than mid-merge, so a missing season fails with
    # the filename instead of an empty-frame error 80 lines later.
    if not players_raw_path.exists():
        raise FileNotFoundError(f"missing FPL players_raw.csv: {players_raw_path}")
    if not understat_players_path.exists():
        raise FileNotFoundError(f"missing Understat players: {understat_players_path}")
    if not understat_matches_path.exists():
        raise FileNotFoundError(f"missing Understat matches: {understat_matches_path}")

    out_path.parent.mkdir(parents=True, exist_ok=True)

    fpl = safe_read_csv(players_raw_path)

    # Vaastav sometimes uses "id" instead of "element". Standardise to "element".
    if "id" in fpl.columns and "element" not in fpl.columns:
        fpl = fpl.rename(columns={"id": "element"})

    if "element" not in fpl.columns:
        raise ValueError(f"{players_raw_path} must contain 'element' (or 'id' to rename).")

    keep_cols = [c for c in ["element", "first_name", "second_name", "web_name", "team"] if c in fpl.columns]
    fpl = fpl[keep_cols].drop_duplicates("element").copy()

    # Two spellings per player, because Understat is inconsistent about which
    # one it uses: "Son Heung-min" appears as the full name for some players
    # and the short display name for others.
    fpl["name_full"] = (
        fpl.get("first_name", "").fillna("").astype(str) + " " + fpl.get("second_name", "").fillna("").astype(str)
    ).str.strip()
    fpl["name_web"] = fpl.get("web_name", "").fillna("").astype(str)

    # Strips accents, punctuation and case, so "Ødegaard" and "Odegaard"
    # are the same string before any comparison happens.
    fpl["n_full"] = fpl["name_full"].map(norm)
    fpl["n_web"] = fpl["name_web"].map(norm)

    us = safe_read_csv(understat_players_path).copy()

    if "id" not in us.columns or "player_name" not in us.columns:
        raise ValueError(f"{understat_players_path} must contain 'id' and 'player_name' columns.")

    # Renamed on the way in. Both sources call their key "id", and a merge
    # that silently picks the wrong one is hard to notice afterwards.
    us = us.rename(columns={"id": "us_player_id"})
    us["n_player"] = us["player_name"].map(norm)

    # A player on the season roster who never played cannot be the right
    # match for anyone, but their name can still beat the correct player to
    # a token match. Restricting to players with minutes removes that risk.
    matches = safe_read_csv(understat_matches_path)

    if "us_player_id" not in matches.columns:
        raise ValueError(f"{understat_matches_path} must contain 'us_player_id'.")

    valid_ids = set(matches["us_player_id"].dropna().astype(int).unique())

    us["us_player_id"] = pd.to_numeric(us["us_player_id"], errors="coerce")
    us = us[us["us_player_id"].isin(valid_ids)].copy()

    # Strategy A, the most trustworthy: both sides spell the full name the same.
    m1 = fpl.merge(
        us,
        left_on="n_full",
        right_on="n_player",
        how="left",
        suffixes=("_fpl", "_us"),
    )

    # Strategy B: FPL's short display name matches what Understat calls them.
    m2 = fpl.merge(
        us,
        left_on="n_web",
        right_on="n_player",
        how="left",
        suffixes=("_fpl", "_us"),
    )

    # One schema for all three strategies, so they can be concatenated and
    # ranked against each other below.
    cols = ["element", "name_full", "web_name", "team", "us_player_id", "player_name", "team_title"]

    out1 = m1[[c for c in cols if c in m1.columns]].copy()
    out1["match_type"] = "full_name"

    out2 = m2[[c for c in cols if c in m2.columns]].copy()
    out2["match_type"] = "web_name"

    # Strategy C, the loosest, for players neither exact match reached: if
    # every word of the shorter name appears in the longer one, call it a
    # match. FPL's "Gabriel Fernando de Jesus" against Understat's "Gabriel
    # Jesus" is the case this exists for. Last because it is the one that can
    # be wrong.
    matched_by_ab = set()
    for df in [out1, out2]:
        matched_by_ab |= set(df.loc[df["us_player_id"].notna(), "element"])

    unmatched_fpl = fpl[~fpl["element"].isin(matched_by_ab)].copy()

    # Already claimed by an exact match, so they cannot be offered to a token
    # match as well. Two FPL players matching one Understat player would make
    # both of their xG columns wrong.
    claimed_us_ids = set()
    for df in [out1, out2]:
        claimed_us_ids |= set(df["us_player_id"].dropna().astype(int))

    unclaimed_us = us[~us["us_player_id"].isin(claimed_us_ids)].copy()

    us_tokens = {row.us_player_id: set(row.n_player.split()) for row in unclaimed_us.itertuples() if row.n_player}

    token_rows = []

    for row in unmatched_fpl.itertuples():
        fpl_toks = set(row.n_full.split()) if row.n_full else set()

        # A single token is almost always a surname, and surnames repeat.
        # "Silva" alone would match three different players.
        if len(fpl_toks) < 2:
            continue

        for us_id, us_toks in us_tokens.items():
            if len(us_toks) < 2:
                continue

            shorter, longer = (us_toks, fpl_toks) if len(us_toks) <= len(fpl_toks) else (fpl_toks, us_toks)

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

        out3 = out3.drop_duplicates("element", keep="first")
    else:
        out3 = pd.DataFrame(columns=list(cols) + ["match_type"])

    comb = pd.concat([out1, out2, out3], ignore_index=True)

    comb["has_match"] = comb["us_player_id"].notna().astype(int)

    # Lower sorts first below, so the order here is the order of trust.
    comb["priority"] = comb["match_type"].map({"full_name": 0, "web_name": 1, "token_subset": 2}).fillna(9).astype(int)

    # Matched rows before unmatched, then by how much the strategy can be
    # trusted. mergesort because it is stable: equal rows keep the order the
    # strategies produced them in.
    comb = comb.sort_values(
        ["element", "has_match", "priority"],
        ascending=[True, False, True],
        kind="mergesort",
    )

    best = comb.drop_duplicates("element", keep="first").copy()

    best["season"] = season
    best["confidence"] = best["us_player_id"].notna().map({True: "high", False: "missing"})

    best.to_csv(out_path, index=False)
    print("saved:", out_path)
    print("season:", season, "| Understat YEAR:", year)
    print("total FPL elements:", len(best))
    print("matched:", int(best["us_player_id"].notna().sum()))
    print("unmatched:", int(best["us_player_id"].isna().sum()))

    # Printed rather than only counted: an unmatched player is usually a name
    # the normaliser could have handled, and seeing them is how that is found.
    missing = best[best["us_player_id"].isna()].head(20)
    if len(missing):
        print("\nExamples unmatched (first 20):")
        show_cols = [c for c in ["element", "name_full", "web_name", "team"] if c in missing.columns]
        print(missing[show_cols].to_string(index=False))

    return out_path


def main() -> None:
    """Build the FPL-to-Understat player mapping for every season."""
    snap = find_latest_snapshot(SNAPSHOT_ROOT)
    for season in SEASONS_ALL:
        print("\n=== Processing season:", season, "===")
        run_one(season, snap)


if __name__ == "__main__":
    main()
