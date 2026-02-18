"""
Fetch Guardian Premier League articles for news feature pipeline.
Scrapes articles tagged football/premierleague from the Guardian API,
cleans HTML to plain text, filters for PL relevance, and caches results.
"""

import json
import os
import re
import time
from pathlib import Path
import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv

load_dotenv()

GUARDIAN_API_KEY = os.environ.get("GUARDIAN_API_KEY", "test")
GUARDIAN_ENDPOINT = "https://content.guardianapis.com/search"

RAW_DIR = Path("data/raw/news")
PAGE_SIZE = 50
RATE_LIMIT_SECONDS = 1.0
MAX_ARTICLES_PER_SEASON = 1500

SEASONS = {
    "2018-19": ("2018-08-01", "2019-05-31"),
    "2019-20": ("2019-08-01", "2020-07-31"),  # extended due to COVID restart
    "2020-21": ("2020-09-01", "2021-05-31"),  # late start due to COVID
    "2021-22": ("2021-08-01", "2022-05-31"),
    "2022-23": ("2022-08-01", "2023-05-31"),
    "2023-24": ("2023-08-01", "2024-05-31"),
    "2024-25": ("2024-08-01", "2025-05-31"),
}

# Filter out non-PL articles that slip through the tag
_EXCLUDE_PATTERNS = re.compile(
    r"\b("
    r"women'?s|wsl|nwsl|lionesses|super league|w-league|"
    r"championship|league one|league two|scottish|"
    r"la liga|bundesliga|serie a|ligue 1|"
    r"mls|a-league|eredivisie|"
    r"world cup|euro 20\d{2}|nations league"
    r")\b",
    re.IGNORECASE,
)


def html_to_text(html: str) -> str:
    """Convert HTML body to clean plain text."""
    if not html:
        return ""
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup.find_all(["script", "style", "aside", "nav", "footer"]):
        tag.decompose()
    text = soup.get_text(separator=" ", strip=True)
    return re.sub(r"\s+", " ", text).strip()


def extract_first_paragraph(text: str, num_sentences: int = 3) -> str:
    """Extract first N sentences (inverted pyramid — key info first)."""
    if not text:
        return ""
    sentences = re.split(r"(?<=[.!?])\s+", text)
    return " ".join(sentences[:num_sentences])


def is_pl_relevant(title: str, body: str) -> bool:
    """Check if article is about Premier League"""
    combined = f"{title} {body[:500]}"
    return not bool(_EXCLUDE_PATTERNS.search(combined))


def fetch_page(from_date: str, to_date: str, page: int = 1) -> dict:
    """Fetch one page of Guardian search results."""
    params = {
        "api-key": GUARDIAN_API_KEY,
        "tag": "football/premierleague",
        "from-date": from_date,
        "to-date": to_date,
        "show-fields": "headline,trailText,body,byline",
        "page-size": PAGE_SIZE,
        "page": page,
        "order-by": "oldest",
    }
    resp = requests.get(GUARDIAN_ENDPOINT, params=params, timeout=30)
    resp.raise_for_status()
    return resp.json()["response"]


def scrape_season(season: str, from_date: str, to_date: str) -> list[dict]:
    """Scrape all PL articles for one season. Skips if already cached."""
    out_path = RAW_DIR / f"guardian_{season}.json"
    if out_path.exists():
        existing = json.loads(out_path.read_text())
        print(f"{season}: cached ({len(existing)} articles)")
        return existing

    print(f"{season}: scraping {from_date} to {to_date}...")
    articles = []
    page = 1

    while len(articles) < MAX_ARTICLES_PER_SEASON:
        if page > 1:
            time.sleep(RATE_LIMIT_SECONDS)

        data = fetch_page(from_date, to_date, page)
        results = data.get("results", [])
        if not results:
            break

        for r in results:
            fields = r.get("fields", {})
            title = fields.get("headline", "")
            body_html = fields.get("body", "")
            body_text = html_to_text(body_html)

            if not is_pl_relevant(title, body_text):
                continue

            articles.append(
                {
                    "id": r["id"],
                    "title": title,
                    "body_text": body_text,
                    "first_paragraph": extract_first_paragraph(body_text),
                    "published_date": r.get("webPublicationDate", ""),
                    "season": season,
                }
            )

        total_pages = data.get("pages", 1)
        print(f"    page {page}/{total_pages} — {len(articles)} PL articles so far")

        if page >= total_pages:
            break
        page += 1

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(articles, indent=2))
    print(f"{season}: saved {len(articles)} articles -> {out_path}")
    return articles


def run(seasons: list[str] | None = None) -> None:
    """Scrape Guardian articles for all configured seasons."""
    print("=" * 60)
    print("FETCH GUARDIAN ARTICLES")
    print("=" * 60)

    if GUARDIAN_API_KEY == "test":
        print("\nWARNING: Using test API key (rate-limited)")
        print("Set GUARDIAN_API_KEY env var for production use.")
        print("Get free key: https://open-platform.theguardian.com/access/\n")

    target_seasons = seasons or list(SEASONS.keys())
    total = 0

    for season in target_seasons:
        if season not in SEASONS:
            print(f"{season}: unknown season, skipping")
            continue
        from_date, to_date = SEASONS[season]
        articles = scrape_season(season, from_date, to_date)
        total += len(articles)

    print(f"\n{'=' * 60}")
    print("FETCH COMPLETE")
    print(f"{'=' * 60}")
    print(f"Total articles: {total:,}")
    print(f"Output: {RAW_DIR}")


if __name__ == "__main__":
    run()
