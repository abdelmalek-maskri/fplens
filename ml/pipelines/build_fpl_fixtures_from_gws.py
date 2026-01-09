import pandas as pd
from pathlib import Path

SNAP = Path("data/raw/fpl/vaastav_snapshot_2025-12-30")
SEASON = "2016-17"

OUT = Path(f"data/processed/mappings/fpl_fixtures_{SEASON}.csv")

def safe_read_csv(path: Path) -> pd.DataFrame:
    # 1) Fast path: C engine + utf-8
    try:
        return pd.read_csv(path, encoding="utf-8", low_memory=False)
    except UnicodeDecodeError:
        pass

    # 2) Still-fast fallbacks: C engine + common encodings
    for enc in ("utf-8-sig", "cp1252", "latin1"):
        try:
            return pd.read_csv(path, encoding=enc, low_memory=False)
        except UnicodeDecodeError:
            continue

    # 3) Last resort: python engine (NO low_memory here)
    return pd.read_csv(
        path,
        encoding="cp1252",
        engine="python",
        on_bad_lines="skip",
    )


def run():
    season_dir = SNAP / SEASON
    gws_dir = season_dir / "gws"
    players_path = season_dir / "players_raw.csv"

    if not gws_dir.exists():
        raise FileNotFoundError(f"Missing gws dir: {gws_dir}")
    if not players_path.exists():
        raise FileNotFoundError(f"Missing players_raw.csv: {players_path}")

    players = safe_read_csv(players_path)

    # Vaastav uses 'id' for element in players_raw.csv
    if "id" in players.columns and "element" not in players.columns:
        players = players.rename(columns={"id": "element"})

    if "element" not in players.columns or "team" not in players.columns:
        raise ValueError(f"players_raw missing required columns. cols={list(players.columns)}")

    players_small = players[["element", "team"]].drop_duplicates()
    players_small["element"] = pd.to_numeric(players_small["element"], errors="coerce")
    players_small["team"] = pd.to_numeric(players_small["team"], errors="coerce")

    rows = []
    gw_files = sorted(gws_dir.glob("gw*.csv"))
    if not gw_files:
        raise FileNotFoundError(f"No gw*.csv found in {gws_dir}")

    for f in gw_files:
        df = safe_read_csv(f)

        needed = ["fixture", "element", "was_home", "opponent_team", "team_h_score", "team_a_score", "kickoff_time"]
        missing = [c for c in needed if c not in df.columns]
        if missing:
            raise ValueError(f"{f} missing {missing}")

        df["element"] = pd.to_numeric(df["element"], errors="coerce")
        df["opponent_team"] = pd.to_numeric(df["opponent_team"], errors="coerce")
        df["fixture"] = pd.to_numeric(df["fixture"], errors="coerce")

        df = df.merge(players_small, on="element", how="left")  # adds player team id

        # infer home/away team ids per row
        df["home_team_id"] = df["team"]
        df["away_team_id"] = df["opponent_team"]

        away_mask = df["was_home"].astype(str).str.lower().isin(["false", "0"])
        # if was_home == False: swap
        df.loc[away_mask, ["home_team_id", "away_team_id"]] = df.loc[away_mask, ["away_team_id", "home_team_id"]].values

        # parse kickoff
        df["kickoff_time"] = pd.to_datetime(df["kickoff_time"], errors="coerce", utc=True)

        rows.append(df[["fixture", "kickoff_time", "home_team_id", "away_team_id", "team_h_score", "team_a_score"]])

    all_rows = pd.concat(rows, ignore_index=True)

    # aggregate to one row per fixture
    fx = (
        all_rows
        .groupby("fixture", as_index=False)
        .agg(
            kickoff_time=("kickoff_time", "min"),
            home_team_id=("home_team_id", "first"),
            away_team_id=("away_team_id", "first"),
            team_h_score=("team_h_score", "max"),
            team_a_score=("team_a_score", "max"),
        )
        .sort_values("kickoff_time")
        .reset_index(drop=True)
    )

    fx["season"] = SEASON
    fx["date"] = fx["kickoff_time"].dt.date.astype(str)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    fx.to_csv(OUT, index=False)

    print("✅ Saved:", OUT)
    print("rows:", len(fx))
    print(fx.head(8).to_string(index=False))

if __name__ == "__main__":
    run()
