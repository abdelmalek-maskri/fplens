"""
Download historical injury/availability snapshots from vaastav's FPL repository.

Uses GitHub API to walk the commit history of players_raw.csv for each season, giving per-GW snapshots of player injury status. Each commit corresponds to a post-match data update, so snapshot N reflects the state AFTER GW N.

The downstream merge (merge_with_fpl.py) shifts these by +1 GW to prevent
temporal leakage.
"""

import re
import time
from io import StringIO
from pathlib import Path

import pandas as pd
import requests

REPO_OWNER = "vaastav"
REPO_NAME = "Fantasy-Premier-League"

# 2016-17 and 2017-18 were bulk-uploaded without per-GW commits.
# 2019-20 COVID ghost commits (GW30-37) are harmlessly dropped during merge.
SEASONS = [
    "2018-19",
    "2019-20",
    "2020-21",
    "2021-22",
    "2022-23",
    "2023-24",
    "2024-25",
]

OUTPUT_DIR = Path("data/processed/injury")
SNAPSHOTS_DIR = OUTPUT_DIR / "historical_snapshots"
_REQUEST_DELAY = 0.5


def get_commits_for_file(season: str, per_page: int = 100) -> list[dict]:
    """Fetch all commits that modified players_raw.csv for a given season."""
    file_path = f"data/{season}/players_raw.csv"
    url = f"https://api.github.com/repos/{REPO_OWNER}/{REPO_NAME}/commits"
    all_commits = []
    page = 1

    while True:
        params = {"path": file_path, "per_page": per_page, "page": page}
        response = requests.get(url, params=params)

        if response.status_code == 403:
            print("Rate limited. Waiting 60 seconds")
            time.sleep(60)
            continue

        if response.status_code != 200:
            print(f"Error fetching commits: {response.status_code}")
            break

        commits = response.json()
        if not commits:
            break

        for commit in commits:
            all_commits.append(
                {
                    "sha": commit["sha"],
                    "date": commit["commit"]["committer"]["date"],
                    "message": commit["commit"]["message"].split("\n")[0],
                }
            )

        if len(commits) < per_page:
            break

        page += 1
        time.sleep(_REQUEST_DELAY)

    return all_commits


def extract_gws_from_message(message: str) -> list[int]:
    """Extract all gameweek numbers from a commit message."""
    patterns = [
        r"[Gg][Ww]\s*(\d+)",
        r"[Gg]ameweek\s*(\d+)",
    ]
    found = set()
    for pattern in patterns:
        for m in re.findall(pattern, message):
            gw = int(m)
            if 1 <= gw <= 47:  # 47 for 2019-20 COVID restart
                found.add(gw)

    return sorted(found)


def download_file_at_commit(season: str, sha: str) -> pd.DataFrame | None:
    """Download players_raw.csv at a specific commit SHA."""
    url = f"https://raw.githubusercontent.com/{REPO_OWNER}/{REPO_NAME}/{sha}/data/{season}/players_raw.csv"
    response = requests.get(url)
    if response.status_code != 200:
        print(f"Error downloading: {response.status_code}")
        return None

    try:
        return pd.read_csv(StringIO(response.text))
    except Exception as e:
        print(f"Error parsing CSV: {e}")
        return None


def extract_injury_fields(df: pd.DataFrame, season: str, gw: int, commit_date: str) -> pd.DataFrame:
    """Extract injury-related columns from a players_raw.csv snapshot."""
    wanted = [
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
    available = [c for c in wanted if c in df.columns]
    result = df[available].copy()

    if "id" in result.columns:
        result = result.rename(columns={"id": "element"})

    result["season"] = season
    result["GW"] = gw
    result["snapshot_date"] = commit_date

    return result


def build_gw_commit_mapping(seasons: list[str]) -> pd.DataFrame:
    """Build a mapping of (season, GW) -> commit SHA from GitHub history."""
    print("Building GW -> commit mapping...")
    all_mappings = []

    for season in seasons:
        print(f"\nSeason {season}:")
        commits = get_commits_for_file(season)
        print(f"Found {len(commits)} commits")

        for commit in commits:
            for gw in extract_gws_from_message(commit["message"]):
                all_mappings.append(
                    {
                        "season": season,
                        "GW": gw,
                        "commit_sha": commit["sha"],
                        "commit_date": commit["date"],
                        "commit_message": commit["message"],
                    }
                )
                print(f"GW{gw}: {commit['sha'][:8]} ({commit['date'][:10]})")

        time.sleep(_REQUEST_DELAY)

    df = pd.DataFrame(all_mappings)
    df = df.sort_values(["season", "GW"]).reset_index(drop=True)
    df = df.drop_duplicates(subset=["season", "GW"], keep="first")
    return df


def download_all_snapshots(mapping_df: pd.DataFrame) -> pd.DataFrame:
    """Download players_raw.csv for each mapped GW and extract injury fields."""
    print("\nDownloading historical snapshots...")
    SNAPSHOTS_DIR.mkdir(parents=True, exist_ok=True)
    all_injury_data = []

    for _, row in mapping_df.iterrows():
        season, gw = row["season"], row["GW"]
        sha, commit_date = row["commit_sha"], row["commit_date"]
        snapshot_file = SNAPSHOTS_DIR / f"{season}_gw{gw}.csv"

        if snapshot_file.exists():
            print(f"{season} GW{gw}: cached")
            df = pd.read_csv(snapshot_file)
        else:
            print(f"{season} GW{gw}: downloading {sha[:8]}...")
            df = download_file_at_commit(season, sha)
            if df is None:
                continue
            df.to_csv(snapshot_file, index=False)
            time.sleep(_REQUEST_DELAY)

        all_injury_data.append(extract_injury_fields(df, season, gw, commit_date))

    if all_injury_data:
        return pd.concat(all_injury_data, ignore_index=True)
    return pd.DataFrame()


def validate_snapshots(injury_df: pd.DataFrame, mapping_df: pd.DataFrame) -> bool:
    """Validate snapshot integrity: ordering, coverage, and commit timing."""
    print("\nValidating snapshot integrity...")
    ok = True

    for season in mapping_df["season"].unique():
        s = mapping_df[mapping_df["season"] == season].sort_values("GW")
        dates = pd.to_datetime(s["commit_date"])
        backwards = dates.diff().dropna()
        backwards = backwards[backwards < pd.Timedelta(0)]
        if len(backwards) > 0:
            print(f"WARNING: {season} has {len(backwards)} commits out of order")
            ok = False
        else:
            print(f"{season}: chronologically ordered")

    print()
    for season in mapping_df["season"].unique():
        gws = sorted(mapping_df[mapping_df["season"] == season]["GW"].astype(int))
        full_range = set(range(min(gws), max(gws) + 1))
        gaps = sorted(full_range - set(gws))
        if gaps:
            print(f"WARNING: {season} has gaps in GW{min(gws)}-{max(gws)}: {gaps}")
            ok = False
        else:
            print(f"{season}: GW{min(gws)}-{max(gws)} ({len(gws)} GWs, contiguous)")

    print()
    m = mapping_df.copy()
    m["weekday"] = pd.to_datetime(m["commit_date"]).dt.day_name()
    counts = m["weekday"].value_counts()
    total = len(m)

    print("Commit weekday distribution:")
    for day in ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]:
        n = counts.get(day, 0)
        bar = "#" * (n * 40 // total) if total > 0 else ""
        print(f"{day:>10}: {n:>3} {bar}")

    pre_match = counts.get("Friday", 0) + counts.get("Saturday", 0)
    if pre_match > total * 0.3:
        print(
            f"\nWARNING: {pre_match}/{total} commits on Fri/Sat "
            f"({pre_match / total * 100:.0f}%) — some may be pre-match"
        )
        ok = False
    else:
        print(f"\n{pre_match}/{total} commits on Fri/Sat ({pre_match / total * 100:.0f}%) — consistent with post-match")

    if ok:
        print("\nAll checks passed.")
    return ok


def run() -> None:
    """Download and validate all historical injury snapshots."""
    print("=" * 60)
    print("HISTORICAL INJURY DATA DOWNLOAD")
    print("=" * 60)
    print(f"Seasons: {SEASONS}")
    print(f"Output:  {OUTPUT_DIR}")
    print()

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    mapping_file = OUTPUT_DIR / "gw_commit_mapping.csv"

    if mapping_file.exists():
        print(f"Loading cached mapping from {mapping_file}")
        mapping_df = pd.read_csv(mapping_file)
    else:
        mapping_df = build_gw_commit_mapping(SEASONS)
        mapping_df.to_csv(mapping_file, index=False)
        print(f"\nSaved mapping -> {mapping_file}")

    print(f"\nMapping summary: {len(mapping_df)} total GWs")
    for season in SEASONS:
        s = mapping_df[mapping_df["season"] == season]
        print(f"  {season}: GW{s['GW'].min()}-{s['GW'].max()} ({len(s)} GWs)")

    injury_df = download_all_snapshots(mapping_df)
    if len(injury_df) == 0:
        print("No injury data downloaded!")
        return

    validate_snapshots(injury_df, mapping_df)

    output_file = OUTPUT_DIR / "injury_states.csv"
    injury_df.to_csv(output_file, index=False)

    print(f"\n{'=' * 60}")
    print("DOWNLOAD COMPLETE")
    print(f"{'=' * 60}")
    print(f"Rows:    {len(injury_df):,}")
    print(f"Players: {injury_df['element'].nunique()}")
    print(f"Seasons: {injury_df['season'].unique().tolist()}")
    print(f"GW range: {injury_df['GW'].min()}-{injury_df['GW'].max()}")
    print("\nOutput files:")
    print(f"{mapping_file}")
    print(f"{output_file}")
    print(f"{SNAPSHOTS_DIR}/ ({len(list(SNAPSHOTS_DIR.glob('*.csv')))} files)")
    print("\nStatus distribution:")
    print(injury_df["status"].value_counts().to_string())

    with_news = injury_df[injury_df["news"].notna() & (injury_df["news"] != "")]
    print(f"\nPlayers with news: {len(with_news):,} ({len(with_news) / len(injury_df) * 100:.1f}%)")


if __name__ == "__main__":
    run()
