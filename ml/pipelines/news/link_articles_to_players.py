"""
Link Guardian articles to FPL players and compute article-level features.
Uses spaCy NER + regex fallback for player name matching.
Computes per-article sentiment (RoBERTa) and injury context detection.
"""

import json
import re
from pathlib import Path

import pandas as pd
import spacy
from transformers import pipeline as hf_pipeline

RAW_NEWS_DIR = Path("data/raw/news")
FPL_DATA_PATH = Path("data/features/extended_features.csv")
OUTPUT_DIR = Path("data/processed/news")

MIN_SURNAME_LENGTH = 4
MIN_RELEVANCE = 1.0
TITLE_WEIGHT = 3.0
FIRST_PARA_WEIGHT = 2.0
BODY_WEIGHT = 1.0

INJURY_KEYWORDS = re.compile(
    r"\b(injur\w*|hamstring|knee|ankle|groin|calf|thigh|muscle|"
    r"concuss\w*|surgery|operation|torn|broken|fractur\w*|"
    r"sidelined|ruled out|doubt|fitness)\b",
    re.IGNORECASE,
)

NEWS_SEASONS = [
    "2018-19",
    "2019-20",
    "2020-21",
    "2021-22",
    "2022-23",
    "2023-24",
    "2024-25",
]

# Name matching


def normalize_name(name: str) -> str:
    """normalize player name: 'Aaron_Cresswell_402' -> 'aaron cresswell'"""
    clean = name.replace("_", " ").strip().lower()
    # Strip trailing numeric suffix (element ID baked into older seasons)
    parts = clean.split()
    if len(parts) >= 2 and parts[-1].isdigit():
        clean = " ".join(parts[:-1])
    return clean


def generate_name_variants(full_name: str) -> list[str]:
    """generate matching variants for a player name:
    'mohamed salah' -> ['mohamed salah', 'salah', 'm. salah', 'm salah']
    """
    parts = full_name.split()
    if not parts:
        return []

    variants = [full_name]

    if len(parts) >= 2:
        surname = parts[-1]
        if len(surname) >= MIN_SURNAME_LENGTH:
            variants.append(surname)
            initial = parts[0][0]
            variants.append(f"{initial}. {surname}")
            variants.append(f"{initial} {surname}")

    return variants


def build_knowledge_base(seasons: list[str]) -> dict[str, dict[str, int]]:
    """build a per-season lookup from name variants to FPL element IDs.
    For each player, generates multiple name variants (full name, surname,
    first name) that might appear in newspaper text. Ambiguous variants
    that map to multiple players in the same season (e.g. "silva" matching
    Bernardo, Thiago, and David Silva) are dropped to avoid false links.

    Returns {season: {name_variant: element_id}} with only unambiguous entries.
    """
    print("building player knowledge base...")
    df = pd.read_csv(
        FPL_DATA_PATH,
        usecols=["season", "name", "element"],
        low_memory=False,
    )

    kb = {}
    for season in seasons:
        sdf = df[df["season"] == season][["element", "name"]].drop_duplicates()

        variant_map: dict[str, set[int]] = {}
        for _, row in sdf.iterrows():
            full_name = normalize_name(row["name"])
            for variant in generate_name_variants(full_name):
                if variant not in variant_map:
                    variant_map[variant] = set()
                variant_map[variant].add(int(row["element"]))

        unambiguous = {v: next(iter(els)) for v, els in variant_map.items() if len(els) == 1}
        n_ambig = sum(1 for els in variant_map.values() if len(els) > 1)

        kb[season] = unambiguous
        print(f"{season}: {len(sdf)} players, {len(unambiguous)} unambiguous variants, {n_ambig} ambiguous")

    return kb


def match_entity_to_player(entity_text: str, lookup: dict[str, int]) -> int | None:
    """Match a text string to a player element ID. Tries full text first, then surname (last word)"""
    normalized = normalize_name(entity_text)

    if normalized in lookup:
        return lookup[normalized]

    parts = normalized.split()
    if len(parts) >= 2:
        surname = parts[-1]
        if len(surname) >= MIN_SURNAME_LENGTH and surname in lookup:
            return lookup[surname]

    return None


# Article processing


def find_player_mentions(
    article: dict,
    lookup: dict[str, int],
    nlp,
) -> dict[int, dict]:
    """Find player mentions via spaCy NER + regex fallback.
    Returns {element_id: {"relevance": float, "in_title": bool, "count": int}}.
    """
    title = article["title"]
    first_para = article.get("first_paragraph", "")
    body = article["body_text"]

    matches: dict[int, dict] = {}

    def record(element: int, weight: float, is_title: bool):
        if element not in matches:
            matches[element] = {"relevance": 0.0, "in_title": False, "count": 0}
        matches[element]["relevance"] = max(matches[element]["relevance"], weight)
        matches[element]["in_title"] = matches[element]["in_title"] or is_title
        matches[element]["count"] += 1

    # spaCy NER on title + body (PERSON entities only)
    combined = f"{title}. {body[:5000]}"
    doc = nlp(combined)
    title_end = len(title) + 2
    first_para_end = title_end + len(first_para)

    for ent in doc.ents:
        if ent.label_ != "PERSON":
            continue
        element = match_entity_to_player(ent.text, lookup)
        if element is None:
            continue

        if ent.start_char < title_end:
            record(element, TITLE_WEIGHT, True)
        elif ent.start_char < first_para_end:
            record(element, FIRST_PARA_WEIGHT, False)
        else:
            record(element, BODY_WEIGHT, False)

    # Regex fallback on title for all variants (titles are short enough
    # that false-positive risk is low, and catches names spaCy misclassifies)
    for variant, element in lookup.items():
        pattern = re.compile(r"\b" + re.escape(variant) + r"\b", re.IGNORECASE)
        if pattern.search(title):
            record(element, TITLE_WEIGHT, True)

    # Body regex only for multi-word names (single words = too many false positives)
    for variant, element in lookup.items():
        if " " not in variant:
            continue
        if element in matches:
            continue
        pattern = re.compile(r"\b" + re.escape(variant) + r"\b", re.IGNORECASE)
        if first_para and pattern.search(first_para):
            record(element, FIRST_PARA_WEIGHT, False)
        elif pattern.search(body[:5000]):
            record(element, BODY_WEIGHT, False)

    return matches


def compute_article_sentiment(
    text: str,
    sentiment_pipe,
) -> tuple[float, float]:
    """compute positive and negative sentiment probabilities via RoBERTa."""
    if not text:
        return 0.0, 0.0
    try:
        results = sentiment_pipe(text[:1000], top_k=3)
        scores = {r["label"].lower(): r["score"] for r in results}
        return scores.get("positive", 0.0), scores.get("negative", 0.0)
    except Exception:
        return 0.0, 0.0


# Main


def run(seasons: list[str] | None = None) -> None:
    """link articles to players and compute article features."""
    print("=" * 60)
    print("LINK ARTICLES TO PLAYERS")
    print("=" * 60)

    target_seasons = seasons or NEWS_SEASONS

    print("\nloading spaCy model...")
    nlp = spacy.load("en_core_web_sm", disable=["tagger", "parser", "lemmatizer"])

    print("loading sentiment model...")
    sentiment_pipe = hf_pipeline(
        "sentiment-analysis",
        model="cardiffnlp/twitter-roberta-base-sentiment-latest",
        top_k=3,
        truncation=True,
        max_length=512,
    )

    kb = build_knowledge_base(target_seasons)

    all_links = []
    total_articles = 0
    total_links = 0

    for season in target_seasons:
        raw_path = RAW_NEWS_DIR / f"guardian_{season}.json"
        if not raw_path.exists():
            print(f"\n{season}: no cached articles, run fetch_guardian first")
            continue

        articles = json.loads(raw_path.read_text())
        print(f"\n{season}: processing {len(articles)} articles...")

        lookup = kb.get(season, {})
        if not lookup:
            print(f"{season}: no player data, skipping")
            continue

        season_links = 0

        for i, article in enumerate(articles):
            mentions = find_player_mentions(article, lookup, nlp)
            if not mentions:
                continue

            sentiment_text = f"{article['title']}. {article.get('first_paragraph', '')}"
            sent_pos, sent_neg = compute_article_sentiment(
                sentiment_text,
                sentiment_pipe,
            )
            has_injury = bool(INJURY_KEYWORDS.search(article["body_text"]))

            for element, info in mentions.items():
                if info["relevance"] < MIN_RELEVANCE:
                    continue
                all_links.append(
                    {
                        "article_id": article["id"],
                        "element": element,
                        "season": season,
                        "published_date": article["published_date"],
                        "relevance_score": info["relevance"],
                        "in_title": int(info["in_title"]),
                        "mention_count": info["count"],
                        "sentiment_pos": round(sent_pos, 4),
                        "sentiment_neg": round(sent_neg, 4),
                        "has_injury_context": int(has_injury),
                    }
                )
                season_links += 1

            if (i + 1) % 200 == 0:
                print(f"{i + 1}/{len(articles)} — {season_links} links")

        total_articles += len(articles)
        total_links += season_links
        print(f"  {season}: {season_links} player-article links")

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    links_df = pd.DataFrame(all_links)
    out_path = OUTPUT_DIR / "article_player_links.csv"
    links_df.to_csv(out_path, index=False)

    print(f"\n{'=' * 60}")
    print("LINKING COMPLETE")
    print(f"{'=' * 60}")
    print(f"Articles processed:    {total_articles:,}")
    print(f"Player-article links:  {total_links:,}")
    if len(links_df) > 0:
        print(f"Unique players linked: {links_df['element'].nunique():,}")
        print(
            f"Injury context links:  {links_df['has_injury_context'].sum():,} "
            f"({links_df['has_injury_context'].mean() * 100:.1f}%)"
        )
        print(f"Title mention links:   {links_df['in_title'].sum():,} ({links_df['in_title'].mean() * 100:.1f}%)")
    print(f"Output: {out_path}")


if __name__ == "__main__":
    run()
