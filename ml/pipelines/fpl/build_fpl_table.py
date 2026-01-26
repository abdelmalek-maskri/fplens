#ml/pipelines/fpl/buildfpl_table.py (1)
import pandas as pd
from pathlib import Path

SNAPSHOT_ROOT = Path("data/raw/fpl")
OUT_PATH = Path("data/processed/merged/fpl_base.csv")

KEEP_COLS = [
    #identifiers
    "season", "GW", "element", "name", "position", "team",

    #target base (will be shifted later)
    "total_points",

    #core minutes + basic stats
    "minutes", "starts",
    "goals_scored", "assists",
    "clean_sheets", "goals_conceded",
    "saves",
    "yellow_cards", "red_cards",
    "own_goals",
    "penalties_missed", "penalties_saved",

    #fpl indices
    "influence", "creativity", "threat", "ict_index",
    "bps", "bonus",

    #fixture/context
    "was_home", "opponent_team",
    "team_h_score", "team_a_score",

    #market
    "value", "selected",
    "transfers_in", "transfers_out", "transfers_balance",

    #expected stats (already inside vaastav merged_gw)
    "xP",
    "expected_goals", "expected_assists",
    "expected_goal_involvements",
    "expected_goals_conceded",
]

def find_latest_snapshot(root: Path) -> Path:
    snaps = sorted([p for p in root.glob("vaastav_snapshot_*") if p.is_dir()])
    if not snaps:
        raise FileNotFoundError("No snapshot found under data/raw/fpl/vaastav_snapshot_*")
    return snaps[-1]

def safe_read_csv(path):
    #try fast C engine first
    try:
        return pd.read_csv(path, encoding="utf-8")
    except UnicodeDecodeError:
        pass
    except pd.errors.ParserError:
        pass

    #fallback
    return pd.read_csv(
        path,
        encoding="latin1",
        engine="python",
        on_bad_lines="skip"
    )


def run():
    snapshot = find_latest_snapshot(SNAPSHOT_ROOT)
    print("using snapshot:", snapshot)

    rows = []
    season_dirs = sorted([p for p in snapshot.iterdir() if p.is_dir()])

    for season_dir in season_dirs:
        season = season_dir.name
        f = season_dir / "gws" / "merged_gw.csv"
        if not f.exists():
            continue

        df = safe_read_csv(f)
        
        before_rows = len(df)
        print(f"{season}: loaded {before_rows} rows")

        #add season column (not present in merged_gw.csv)
        df["season"] = season

        #if position/team missing, merge from players_raw.csv
        if ("position" not in df.columns) or ("team" not in df.columns) or df["position"].isna().all() or df["team"].isna().all():
            players_path = season_dir / "players_raw.csv"
            if players_path.exists():
                players = safe_read_csv(players_path)

                #rename columns if needed
                if "id" in players.columns:
                    players = players.rename(columns={"id": "element"})

                if "element_type" in players.columns:
                    pos_map = {1: "GK", 2: "DEF", 3: "MID", 4: "FWD"}
                    players["position"] = players["element_type"].map(pos_map)

                #team might be numeric
                if "team" not in players.columns and "team_code" in players.columns:
                    players = players.rename(columns={"team_code": "team"})

                #use only needed columns
                players_small = players[["element", "position", "team"]].drop_duplicates()

                df = df.merge(players_small, on="element", how="left", suffixes=("", "_from_players"))

                #if df already had columns but empty, fill them
                if "position_from_players" in df.columns:
                    df["position"] = df["position"].fillna(df["position_from_players"])
                    df.drop(columns=["position_from_players"], inplace=True)

                if "team_from_players" in df.columns:
                    df["team"] = df["team"].fillna(df["team_from_players"])
                    df.drop(columns=["team_from_players"], inplace=True)


        #keep only columns that exist (some seasons may miss a few)
        existing = [c for c in KEEP_COLS if c in df.columns]
        missing = [c for c in KEEP_COLS if c not in df.columns]
        if missing:
            print(f"{season}: missing columns (will fill with NaN): {missing}")
            for m in missing:
                df[m] = pd.NA
            existing = KEEP_COLS

        df = df[existing]
        rows.append(df)

    full = pd.concat(rows, ignore_index=True)

    #clean types
    full["GW"] = pd.to_numeric(full["GW"], errors="coerce").astype("Int64")
    full["element"] = pd.to_numeric(full["element"], errors="coerce").astype("Int64")
    full["total_points"] = pd.to_numeric(full["total_points"], errors="coerce")

    #sort for downstream target shifting and rolling features
    full = full.sort_values(["season", "element", "GW"]).reset_index(drop=True)

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    full.to_csv(OUT_PATH, index=False)

    print("Saved:", OUT_PATH)
    print("Shape:", full.shape)
    print("Columns:", list(full.columns))

if __name__ == "__main__":
    run() 