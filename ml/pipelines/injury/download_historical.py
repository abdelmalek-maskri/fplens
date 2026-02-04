"""
Download historical injury/availability data from vaastav's FPL repository.
Uses GitHub API to fetch players_raw.csv at different commits, giving us
per-gameweek snapshots of player injury status without temporal leakage
"""

import json
import time
from pathlib import Path
from datetime import datetime
from io import StringIO
import pandas as pd
import requests

REPO_OWNER = "vaastav"
REPO_NAME = "Fantasy-Premier-League"
SEASONS = ["2021-22", "2022-23", "2023-24", "2024-25"]
OUTPUT_DIR = Path("data/processed/injury")
SNAPSHOTS_DIR = OUTPUT_DIR / "historical_snapshots"

# Rate limiting for GitHub API
REQUEST_DELAY = 0.5  # seconds between requests

def get_commits_for_file(season: str, per_page: int = 100) -> list[dict]:
    
    # get all commits that modified players_raw.csv for a season
    # returns list of {sha, date, message} dicts
    file_path = f"data/{season}/players_raw.csv"
    url = f"https://api.github.com/repos/{REPO_OWNER}/{REPO_NAME}/commits"

    all_commits = []
    page = 1

    while True:
        params = {
            "path": file_path,
            "per_page": per_page,
            "page": page,
        }

        response = requests.get(url, params=params)

        if response.status_code == 403:
            print("Rate limited. Waiting 60 seconds...")
            time.sleep(60)
            continue

        if response.status_code != 200:
            print(f"Error fetching commits: {response.status_code}")
            break

        commits = response.json()

        if not commits:
            break

        for commit in commits:
            all_commits.append({
                "sha": commit["sha"],
                "date": commit["commit"]["committer"]["date"],
                "message": commit["commit"]["message"].split("\n")[0],
            })

        if len(commits) < per_page:
            break

        page += 1
        time.sleep(REQUEST_DELAY)

    return all_commits


def extract_gw_from_message(message: str) -> int | None:
    # Extract gameweek number from commit message.
    import re
    patterns = [
        r"[Gg][Ww]\s*(\d+)",  # GW38, gw20, GW 38
        r"[Gg]ameweek\s*(\d+)",  # Gameweek 38
    ]

    for pattern in patterns:
        matches = re.findall(pattern, message)
        if matches:
            # Return the highest GW number found 
            return max(int(m) for m in matches)

    return None


def download_file_at_commit(season: str, sha: str) -> pd.DataFrame | None:
    
    # Download players_raw.csv at a specific commit.
    url = f"https://raw.githubusercontent.com/{REPO_OWNER}/{REPO_NAME}/{sha}/data/{season}/players_raw.csv"

    response = requests.get(url)
    if response.status_code != 200:
        print(f"Error downloading file: {response.status_code}")
        return None

    try:
        df = pd.read_csv(StringIO(response.text))
        return df
    except Exception as e:
        print(f"  Error parsing CSV: {e}")
        return None


def extract_injury_fields(df: pd.DataFrame, season: str, gw: int, commit_date: str) -> pd.DataFrame:

    # Extract injury-related fields from players_raw.csv.
    cols = [
        "id", 
        "first_name",
        "second_name",
        "web_name",
        "team",
        "status",
        "chance_of_playing_this_round",
        "chance_of_playing_next_round",
        "news",
        "news_added",
    ]

    #only keep columns that exist
    available_cols = [c for c in cols if c in df.columns]
    result = df[available_cols].copy()

    #rename 'id' to 'element' for consistency with GW data
    if "id" in result.columns:
        result = result.rename(columns={"id": "element"})

    #add metadata
    result["season"] = season
    result["GW"] = gw
    result["snapshot_date"] = commit_date

    return result


def build_gw_commit_mapping(seasons: list[str]) -> pd.DataFrame:

    # Build mapping of (season, GW) -> commit SHA.
    print("Building GW to commit mapping...")

    all_mappings = []

    for season in seasons:
        print(f"\n  Season {season}:")
        commits = get_commits_for_file(season)
        print(f"    Found {len(commits)} commits")

        for commit in commits:
            gw = extract_gw_from_message(commit["message"])

            if gw is not None:
                all_mappings.append({
                    "season": season,
                    "GW": gw,
                    "commit_sha": commit["sha"],
                    "commit_date": commit["date"],
                    "commit_message": commit["message"],
                })
                print(f"    GW{gw}: {commit['sha'][:8]} ({commit['date'][:10]})")

        time.sleep(REQUEST_DELAY)

    df = pd.DataFrame(all_mappings)

    # Sort by season and GW
    df = df.sort_values(["season", "GW"]).reset_index(drop=True)

    # Remove duplicates (keep earliest commit for each GW)
    df = df.drop_duplicates(subset=["season", "GW"], keep="first")

    return df


def download_all_snapshots(mapping_df: pd.DataFrame) -> pd.DataFrame:
    
    #download players_raw.csv for each GW and extract injury fields
    print("\nDownloading historical snapshots...")

    SNAPSHOTS_DIR.mkdir(parents=True, exist_ok=True)

    all_injury_data = []

    for _, row in mapping_df.iterrows():
        season = row["season"]
        gw = row["GW"]
        sha = row["commit_sha"]
        commit_date = row["commit_date"]

        snapshot_file = SNAPSHOTS_DIR / f"{season}_gw{gw}.csv"

        # Check if already downloaded
        if snapshot_file.exists():
            print(f"  {season} GW{gw}: Already downloaded")
            df = pd.read_csv(snapshot_file)
        else:
            print(f"  {season} GW{gw}: Downloading from {sha[:8]}...")
            df = download_file_at_commit(season, sha)

            if df is not None:
                df.to_csv(snapshot_file, index=False)
            else:
                print(f"    Failed to download")
                continue

            time.sleep(REQUEST_DELAY)

        #extract injury fields
        injury_df = extract_injury_fields(df, season, gw, commit_date)
        all_injury_data.append(injury_df)

    if all_injury_data:
        combined = pd.concat(all_injury_data, ignore_index=True)
        return combined
    else:
        return pd.DataFrame()


def validate_no_leakage(injury_df: pd.DataFrame) -> bool:
    #validate that news_added timestamps are before GW dates
    print("\nValidating temporal alignment...")

    #convert timestamps
    injury_df = injury_df.copy()
    injury_df["news_added_dt"] = pd.to_datetime(injury_df["news_added"], errors="coerce")
    injury_df["snapshot_dt"] = pd.to_datetime(injury_df["snapshot_date"], errors="coerce")

    #check for news added after snapshot
    with_news = injury_df[injury_df["news_added_dt"].notna()]

    if len(with_news) == 0:
        print("  no news entries to validate")
        return True

    # news should be added before or at the snapshot time
    future_news = with_news[with_news["news_added_dt"] > with_news["snapshot_dt"]]

    if len(future_news) > 0:
        print(f"  WARNING: {len(future_news)} entries have news_added after snapshot")
        print(future_news[["season", "GW", "web_name", "news_added", "snapshot_date"]].head())
        return False
    else:
        print(f"  OK: All {len(with_news)} news entries are properly aligned")
        return True


def run():
    print("=" * 60)
    print("HISTORICAL INJURY DATA DOWNLOAD")
    print("=" * 60)
    print(f"Seasons: {SEASONS}")
    print(f"Output: {OUTPUT_DIR}")
    print()

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # Step 1: Build GW-commit mapping
    mapping_file = OUTPUT_DIR / "gw_commit_mapping.csv"

    if mapping_file.exists():
        print(f"Loading existing mapping from {mapping_file}")
        mapping_df = pd.read_csv(mapping_file)
    else:
        mapping_df = build_gw_commit_mapping(SEASONS)
        mapping_df.to_csv(mapping_file, index=False)
        print(f"\nSaved mapping to {mapping_file}")

    print(f"\nMapping summary:")
    print(f"  Total GWs: {len(mapping_df)}")
    for season in SEASONS:
        season_df = mapping_df[mapping_df["season"] == season]
        print(f"  {season}: GW{season_df['GW'].min()}-{season_df['GW'].max()} ({len(season_df)} GWs)")

    # Step 2: Download snapshots
    injury_df = download_all_snapshots(mapping_df)

    if len(injury_df) == 0:
        print("No injury data downloaded!")
        return

    # Step 3: Validate no leakage
    validate_no_leakage(injury_df)

    # Step 4: Save combined injury data
    output_file = OUTPUT_DIR / "injury_states.csv"
    injury_df.to_csv(output_file, index=False)

    print(f"\n" + "=" * 60)
    print("DOWNLOAD COMPLETE")
    print("=" * 60)
    print(f"Total rows: {len(injury_df):,}")
    print(f"Unique players: {injury_df['element'].nunique()}")
    print(f"Seasons: {injury_df['season'].unique().tolist()}")
    print(f"GW range: {injury_df['GW'].min()}-{injury_df['GW'].max()}")
    print(f"\nOutput files:")
    print(f"  {mapping_file}")
    print(f"  {output_file}")
    print(f"  {SNAPSHOTS_DIR}/ ({len(list(SNAPSHOTS_DIR.glob('*.csv')))} files)")

    print(f"\nInjury status distribution:")
    print(injury_df["status"].value_counts().to_string())

    with_news = injury_df[injury_df["news"].notna() & (injury_df["news"] != "")]
    print(f"\nPlayers with news: {len(with_news):,} ({len(with_news)/len(injury_df)*100:.1f}%)")


if __name__ == "__main__":
    run()
