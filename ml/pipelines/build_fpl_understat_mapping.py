import pandas as pd
from pathlib import Path

from ml.utils.name_normalize import norm

SNAPSHOT = Path("data/raw/fpl/vaastav_snapshot_2025-12-30")  # change if needed
SEASON_DIR = SNAPSHOT / "2016-17"

UNDERSTAT_MATCHES = Path("data/processed/external/understat/player_matches_EPL_2016_all_filtered.csv")
UNDERSTAT_PLAYERS = Path("data/processed/external/understat/players_EPL_2016.csv")
OUT_PATH = Path("data/processed/mappings/fpl_to_understat_2016-17.csv")

def run():
    # ---- FPL players (element + names) ----
    fpl = pd.read_csv(SEASON_DIR / "players_raw.csv", low_memory=False)

    # Vaastav uses "id" for element in players_raw.csv
    if "id" in fpl.columns and "element" not in fpl.columns:
        fpl = fpl.rename(columns={"id": "element"})

    # Keep only relevant
    keep_cols = [c for c in ["element", "first_name", "second_name", "web_name", "team"] if c in fpl.columns]
    fpl = fpl[keep_cols].drop_duplicates("element")

    # Build candidate name strings
    fpl["name_full"] = (fpl["first_name"].fillna("") + " " + fpl["second_name"].fillna("")).str.strip()
    fpl["name_web"] = fpl["web_name"].fillna("").astype(str)

    fpl["n_full"] = fpl["name_full"].map(norm)
    fpl["n_web"] = fpl["name_web"].map(norm)

    # ---- Understat players (id + player_name + team_title) ----
    us = pd.read_csv(UNDERSTAT_PLAYERS, low_memory=False)
    us = us.rename(columns={"id": "us_player_id"})
    us["n_player"] = us["player_name"].map(norm)

    matches = pd.read_csv(UNDERSTAT_MATCHES, low_memory=False)
    valid_ids = set(matches["us_player_id"].unique())
    
    us = us[us["us_player_id"].isin(valid_ids)].copy()


    # ---- Exact matches (strong) ----
    # match by normalized full name OR web_name
    m1 = fpl.merge(us, left_on="n_full", right_on="n_player", how="left", suffixes=("_fpl","_us"))
    m2 = fpl.merge(us, left_on="n_web", right_on="n_player", how="left", suffixes=("_fpl","_us"))

    # choose best match per element:
    # priority: full-name match, else web-name match
    out = m1[["element","name_full","web_name","team","us_player_id","player_name","team_title"]].copy()
    out["match_type"] = "full_name"

    out2 = m2[["element","name_full","web_name","team","us_player_id","player_name","team_title"]].copy()
    out2["match_type"] = "web_name"

    # combine: keep first successful match
    comb = pd.concat([out, out2], ignore_index=True)
    comb["has_match"] = comb["us_player_id"].notna().astype(int)

    # sort so full_name comes first, and matched rows first
    comb["priority"] = comb["match_type"].map({"full_name": 0, "web_name": 1})
    comb = comb.sort_values(["element", "has_match", "priority"], ascending=[True, False, True])

    best = comb.drop_duplicates("element", keep="first").copy()
    best["season"] = "2016-17"

    # Confidence flag
    best["confidence"] = best["us_player_id"].notna().map({True: "high", False: "missing"})

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    best.to_csv(OUT_PATH, index=False)

    print("✅ Saved:", OUT_PATH)
    print("Total FPL elements:", len(best))
    print("Matched:", best["us_player_id"].notna().sum())
    print("Unmatched:", best["us_player_id"].isna().sum())

    # Show some unmatched examples
    missing = best[best["us_player_id"].isna()].head(20)
    if len(missing):
        print("\nExamples unmatched:")
        print(missing[["element","name_full","web_name","team"]].to_string(index=False))

if __name__ == "__main__":
    run()
