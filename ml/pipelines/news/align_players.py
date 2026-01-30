# ml/pipelines/news/align_players.py
"""
Player-Article Alignment

This script maps news articles to FPL player IDs by detecting player name
mentions in article text. This is a key step for creating features.

The Challenge:
    - Articles mention players by various names: "Salah", "Mo Salah", "Mohamed Salah"
    - We need to map these to FPL element IDs (e.g., element=308)
    - Some names are ambiguous (e.g., "Silva" could be Bernardo or Thiago)

Our Approach:
    1. Build a dictionary of name variants from FPL data
    2. Search for these names in article text
    3. Score relevance based on where the name appears (title > body)
    4. Handle ambiguity by preferring longer matches

Usage:
    python -m ml.pipelines.news.align_players
"""

import json
import re
from collections import defaultdict
from pathlib import Path

import pandas as pd

from ml.pipelines.news.config import (
    PROCESSED_NEWS_DIR,
    MIN_RELEVANCE_SCORE,
    RELEVANCE_WEIGHTS,
)


def load_player_names() -> dict[str, list[int]]:
    """
    Build a dictionary mapping name variants to FPL element IDs.

    We extract multiple name forms from FPL data:
    - full name: "Mohamed Salah"
    - web_name: "Salah"
    - first + last: "Mohamed Salah"
    - last name only: "Salah" (with caution for common names)

    Returns:
        Dictionary: {normalized_name: [list of element IDs]}
        (list because some names map to multiple players)
    """
    # Load FPL base data to get player names
    fpl_path = Path("data/processed/merged/fpl_base.csv")

    if not fpl_path.exists():
        raise FileNotFoundError(f"FPL data not found at {fpl_path}. Run the data pipeline first.")

    df = pd.read_csv(fpl_path, low_memory=False)

    # Get unique players (element is the FPL player ID)
    # We need: element, name (full name), web_name (display name)
    players = df[["element", "name"]].drop_duplicates()

    name_to_ids: dict[str, list[int]] = defaultdict(list)

    for _, row in players.iterrows():
        element = int(row["element"])
        full_name = str(row["name"]).strip()

        if not full_name or full_name == "nan":
            continue

        # Normalize: lowercase, remove extra spaces
        def normalize(s: str) -> str:
            return re.sub(r"\s+", " ", s.lower().strip())

        # Add full name
        norm_full = normalize(full_name)
        if norm_full and len(norm_full) > 2:
            name_to_ids[norm_full].append(element)

        # Add individual name parts (for partial matches)
        parts = full_name.split()
        if len(parts) >= 2:
            # Last name (most common reference)
            last_name = normalize(parts[-1])
            if len(last_name) > 3:  # Avoid very short names like "Son"
                name_to_ids[last_name].append(element)

            # First + Last
            first_last = normalize(f"{parts[0]} {parts[-1]}")
            name_to_ids[first_last].append(element)

    # Remove ambiguous names that map to too many players
    # (e.g., "Silva" maps to 5+ players)
    filtered = {}
    for name, ids in name_to_ids.items():
        unique_ids = list(set(ids))
        if len(unique_ids) <= 3:  # Allow up to 3 players per name
            filtered[name] = unique_ids

    print(f"Built name dictionary with {len(filtered)} name variants")
    return filtered


def find_player_mentions(
    text: str,
    name_dict: dict[str, list[int]],
    weight: float = 1.0,
) -> dict[int, float]:
    """
    Find player mentions in text and score them.

    Args:
        text: Text to search
        name_dict: {name: [element_ids]} mapping
        weight: Multiplier for relevance score

    Returns:
        Dictionary: {element_id: relevance_score}
    """
    if not text:
        return {}

    text_lower = text.lower()
    scores: dict[int, float] = defaultdict(float)

    # Sort names by length (longer first) to prefer specific matches
    # e.g., "Mohamed Salah" over "Salah"
    sorted_names = sorted(name_dict.keys(), key=len, reverse=True)

    for name in sorted_names:
        # Use word boundaries to avoid partial matches
        # e.g., "Salah" shouldn't match "Salahuddin"
        pattern = r"\b" + re.escape(name) + r"\b"

        matches = re.findall(pattern, text_lower)
        if matches:
            # Add score for each player this name could refer to
            for element_id in name_dict[name]:
                scores[element_id] += len(matches) * weight

    return dict(scores)


def align_article(
    article: dict,
    name_dict: dict[str, list[int]],
) -> list[dict]:
    """
    Find all player mentions in an article and create alignment records.

    Args:
        article: Article dictionary with title, body, first_paragraph
        name_dict: Player name mapping

    Returns:
        List of alignment records, one per player mentioned
    """
    alignments = []

    # Score different parts of the article
    title_scores = find_player_mentions(
        article.get("title", ""),
        name_dict,
        weight=RELEVANCE_WEIGHTS["title_mention"],
    )

    first_para_scores = find_player_mentions(
        article.get("first_paragraph", ""),
        name_dict,
        weight=RELEVANCE_WEIGHTS["first_para_mention"],
    )

    body_scores = find_player_mentions(
        article.get("body", ""),
        name_dict,
        weight=RELEVANCE_WEIGHTS["body_mention"],
    )

    # Combine scores for each player
    all_elements = set(title_scores.keys()) | set(first_para_scores.keys()) | set(body_scores.keys())

    for element in all_elements:
        total_score = (
            title_scores.get(element, 0)
            + first_para_scores.get(element, 0)
            + body_scores.get(element, 0)
        )

        if total_score >= MIN_RELEVANCE_SCORE:
            alignment = {
                "article_id": article.get("article_id", ""),
                "element": element,
                "relevance_score": round(total_score, 2),
                "in_title": element in title_scores,
                "season": article.get("season", ""),
                "source": article.get("source", ""),
                "date": article.get("timestamp", "")[:8] if article.get("timestamp") else "",
                "title": article.get("title", "")[:200],  # Truncate for storage
            }
            alignments.append(alignment)

    return alignments


def run():
    """Main function: Align all articles to players."""
    print("=" * 60)
    print("PLAYER-ARTICLE ALIGNMENT")
    print("=" * 60)

    # Load extracted articles
    articles_path = PROCESSED_NEWS_DIR / "extracted_articles.json"

    if not articles_path.exists():
        print(f"No extracted articles found at {articles_path}")
        print("Run extract_article.py first.")
        return

    with open(articles_path, "r", encoding="utf-8") as f:
        articles = json.load(f)

    print(f"Loaded {len(articles)} articles")

    # Build player name dictionary
    name_dict = load_player_names()

    # Align each article
    all_alignments = []

    for i, article in enumerate(articles):
        if (i + 1) % 100 == 0:
            print(f"  Processed {i + 1}/{len(articles)} articles...")

        alignments = align_article(article, name_dict)
        all_alignments.extend(alignments)

    print(f"\nCreated {len(all_alignments)} player-article alignments")

    # Convert to DataFrame and save
    df = pd.DataFrame(all_alignments)

    if len(df) > 0:
        # Sort by relevance score
        df = df.sort_values("relevance_score", ascending=False)

        # Summary statistics
        print(f"\nSummary:")
        print(f"  Total alignments: {len(df)}")
        print(f"  Unique articles: {df['article_id'].nunique()}")
        print(f"  Unique players: {df['element'].nunique()}")
        print(f"  Avg alignments per article: {len(df) / df['article_id'].nunique():.1f}")

        # Save
        output_path = PROCESSED_NEWS_DIR / "player_articles.csv"
        df.to_csv(output_path, index=False)
        print(f"\nSaved to {output_path}")

        # Also save a sample for inspection
        sample_path = PROCESSED_NEWS_DIR / "player_articles_sample.csv"
        df.head(100).to_csv(sample_path, index=False)
        print(f"Sample saved to {sample_path}")

    else:
        print("No alignments found. Check if player names match article content.")

    print(f"\n{'=' * 60}")
    print("DONE")
    print(f"{'=' * 60}")


if __name__ == "__main__":
    run()
