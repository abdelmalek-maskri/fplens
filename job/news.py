"""
Live news fetcher for the /api/news endpoint.

Fetches recent Guardian articles (last 7 days), links them to FPL players
using spaCy NER + regex matching, and computes per-article sentiment via
RoBERTa. Results are cached for 60 minutes by the API cache layer.

This is separate from the training news pipeline (ml/pipelines/news/)
which processes historical articles for feature engineering.
"""

import logging
import os
import re
import time
from datetime import datetime, timedelta

import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

GUARDIAN_API_KEY = os.environ.get("GUARDIAN_API_KEY", "")
GUARDIAN_ENDPOINT = "https://content.guardianapis.com/search"
PAGE_SIZE = 50
MAX_PAGES = 5
RATE_LIMIT_SECONDS = 1.0

EXCLUDE_PATTERNS = re.compile(
    r"\b("
    r"women'?s|wsl|nwsl|lionesses|super league|w-league|"
    r"championship|league one|league two|scottish|"
    r"la liga|bundesliga|serie a|ligue 1|"
    r"mls|a-league|eredivisie|"
    r"world cup|euro 20\d{2}|nations league"
    r")\b",
    re.IGNORECASE,
)

INJURY_KEYWORDS = re.compile(
    r"\b(injur\w*|hamstring|knee|ankle|groin|calf|thigh|muscle|"
    r"concuss\w*|surgery|operation|torn|broken|fractur\w*|"
    r"sidelined|ruled out|doubt|fitness)\b",
    re.IGNORECASE,
)

MIN_SURNAME_LENGTH = 4

# Load NLP models once at module level (avoids reloading on every cache miss)
_nlp = None
_sentiment_pipe = None

try:
    import spacy

    _nlp = spacy.load("en_core_web_sm", disable=["tagger", "parser", "lemmatizer"])
    logger.info("spaCy NER loaded for player linking")
except Exception:
    logger.info("spaCy not available, using regex-only player linking")

try:
    from transformers import pipeline as hf_pipeline

    _sentiment_pipe = hf_pipeline(
        "sentiment-analysis",
        model="cardiffnlp/twitter-roberta-base-sentiment-latest",
        top_k=3,
        truncation=True,
        max_length=512,
    )
    logger.info("RoBERTa sentiment model loaded")
except Exception:
    logger.info("Transformers not available, using keyword sentiment fallback")


def _html_to_text(html):
    if not html:
        return ""
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup.find_all(["script", "style", "aside", "nav", "footer"]):
        tag.decompose()
    text = soup.get_text(separator=" ", strip=True)
    return re.sub(r"\s+", " ", text).strip()


def _extract_snippet(text, num_sentences=3):
    if not text:
        return ""
    sentences = re.split(r"(?<=[.!?])\s+", text)
    return " ".join(sentences[:num_sentences])


def _is_pl_relevant(title, body):
    combined = f"{title} {body[:500]}"
    return not bool(EXCLUDE_PATTERNS.search(combined))


def _fetch_guardian_articles(days=7):
    # Fetch recent Guardian PL articles.
    if not GUARDIAN_API_KEY:
        logger.warning("GUARDIAN_API_KEY not set, returning empty articles")
        return []

    to_date = datetime.now().strftime("%Y-%m-%d")
    from_date = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")

    articles = []
    for page in range(1, MAX_PAGES + 1):
        if page > 1:
            time.sleep(RATE_LIMIT_SECONDS)

        try:
            resp = requests.get(
                GUARDIAN_ENDPOINT,
                params={
                    "api-key": GUARDIAN_API_KEY,
                    "tag": "football/premierleague",
                    "from-date": from_date,
                    "to-date": to_date,
                    "show-fields": "headline,trailText,body,byline",
                    "page-size": PAGE_SIZE,
                    "page": page,
                    "order-by": "newest",
                },
                timeout=30,
            )
            resp.raise_for_status()
        except requests.RequestException as e:
            logger.error("Guardian API request failed: %s", e)
            break

        data = resp.json().get("response", {})
        results = data.get("results", [])
        if not results:
            break

        for r in results:
            fields = r.get("fields", {})
            title = fields.get("headline", "")
            body_html = fields.get("body", "")
            body_text = _html_to_text(body_html)

            if not _is_pl_relevant(title, body_text):
                continue

            articles.append(
                {
                    "guardian_id": r["id"],
                    "title": title,
                    "body_text": body_text,
                    "snippet": _extract_snippet(body_text),
                    "published_date": r.get("webPublicationDate", ""),
                }
            )

        total_pages = data.get("pages", 1)
        if page >= total_pages:
            break

    logger.info("Fetched %d Guardian articles from last %d days", len(articles), days)
    return articles


def _build_player_lookup(bootstrap_data):
    # Build name variant -> player info lookup from FPL bootstrap data.
    # Uses live API data instead of extended_features.csv.
    teams = {t["id"]: t["short_name"] for t in bootstrap_data["teams"]}
    position_map = {1: "GK", 2: "DEF", 3: "MID", 4: "FWD"}

    lookup = {}
    player_info = {}

    for p in bootstrap_data["elements"]:
        element = p["id"]
        web_name = p["web_name"]
        full_name = f"{p['first_name']} {p['second_name']}".lower()
        team_name = teams.get(p["team"], "???")
        position = position_map.get(p["element_type"], "???")

        player_info[element] = {
            "element": element,
            "web_name": web_name,
            "team_name": team_name,
            "position": position,
        }

        # generate name variants
        variants = [full_name]
        parts = full_name.split()
        if len(parts) >= 2:
            surname = parts[-1]
            if len(surname) >= MIN_SURNAME_LENGTH:
                variants.append(surname)
                variants.append(f"{parts[0][0]}. {surname}")
                variants.append(f"{parts[0][0]} {surname}")
        # also match web_name (e.g. "Salah", "Palmer")
        wn_lower = web_name.lower()
        if len(wn_lower) >= MIN_SURNAME_LENGTH:
            variants.append(wn_lower)

        for v in variants:
            # only keep unambiguous (first wins, collisions ignored)
            if v not in lookup:
                lookup[v] = element

    return lookup, player_info


def _link_articles_to_players(articles, lookup, nlp=None):
    # Link articles to players using regex matching.
    # Optionally uses spaCy NER if nlp model is provided.

    # pre-compile regex patterns once (avoids re-compiling per article)
    compiled = {variant: re.compile(r"\b" + re.escape(variant) + r"\b", re.IGNORECASE) for variant in lookup}

    for article in articles:
        title = article["title"]
        body = article["body_text"][:5000]
        found = {}

        # regex on title (all variants, low FP risk)
        for variant, element in lookup.items():
            if compiled[variant].search(title):
                found[element] = True

        # regex on body for full names only (2+ words)
        for variant, element in lookup.items():
            if " " not in variant:
                continue
            if element in found:
                continue
            if compiled[variant].search(body):
                found[element] = True

        # spaCy NER if available (better recall for unusual name forms)
        if nlp is not None:
            try:
                doc = nlp(f"{title}. {body}")
                for ent in doc.ents:
                    if ent.label_ != "PERSON":
                        continue
                    normalized = ent.text.lower().strip()
                    if normalized in lookup:
                        found[lookup[normalized]] = True
                    # try surname
                    parts = normalized.split()
                    if len(parts) >= 2:
                        surname = parts[-1]
                        if surname in lookup:
                            found[lookup[surname]] = True
            except Exception as e:
                logger.warning("spaCy NER failed for article: %s", e)

        article["player_elements"] = list(found.keys())
        article["injury_flag"] = bool(INJURY_KEYWORDS.search(body))

    return articles


def _compute_sentiment(articles, sentiment_pipe=None):
    # Compute sentiment for each article.
    # Uses RoBERTa if available, falls back to keyword heuristic.
    for article in articles:
        if sentiment_pipe is not None:
            try:
                text = f"{article['title']}. {article['snippet']}"
                results = sentiment_pipe(text[:512], top_k=3)
                scores = {r["label"].lower(): r["score"] for r in results}
                pos = scores.get("positive", 0.0)
                neg = scores.get("negative", 0.0)
                # map to -1..1 scale: positive high = positive, negative high = negative
                article["sentiment"] = round(pos - neg, 4)
            except Exception:
                article["sentiment"] = 0.0
        else:
            # keyword heuristic fallback
            text = f"{article['title']} {article['snippet']}".lower()
            pos_words = len(re.findall(r"\b(scores?|goals?|wins?|brilliant|superb|dominant|impressive)\b", text))
            neg_words = len(re.findall(r"\b(injur\w+|doubt|miss\w*|blow|worry|concern|ruled out|sidelined)\b", text))
            total = pos_words + neg_words
            if total > 0:
                article["sentiment"] = round((pos_words - neg_words) / total, 4)
            else:
                article["sentiment"] = 0.0

    return articles


def fetch_recent_news(bootstrap_data, days=7):
    # Main entry point: fetch, link, score, and format recent news.
    # Returns dict matching frontend expected shape.

    articles = _fetch_guardian_articles(days=days)
    if not articles:
        return {"articles": [], "trending": []}

    lookup, player_info = _build_player_lookup(bootstrap_data)

    articles = _link_articles_to_players(articles, lookup, _nlp)
    articles = _compute_sentiment(articles, _sentiment_pipe)

    # format articles for frontend
    formatted = []
    for i, article in enumerate(articles):
        players = []
        for eid in article.get("player_elements", []):
            if eid in player_info:
                players.append(player_info[eid])

        guardian_id = article.get("guardian_id", "")
        url = f"https://www.theguardian.com/{guardian_id}" if guardian_id else ""

        formatted.append(
            {
                "id": i + 1,
                "headline": article["title"],
                "url": url,
                "source": "The Guardian",
                "date": article["published_date"][:10] if article["published_date"] else "",
                "sentiment": article.get("sentiment", 0.0),
                "players": players,
                "injury_flag": article.get("injury_flag", False),
                "snippet": article.get("snippet", ""),
            }
        )

    # compute trending players (sorted by mention frequency)
    mention_counts = {}
    for article in formatted:
        for p in article["players"]:
            eid = p["element"]
            if eid not in mention_counts:
                mention_counts[eid] = {"player": p, "count": 0, "sentiments": []}
            mention_counts[eid]["count"] += 1
            mention_counts[eid]["sentiments"].append(article["sentiment"])

    trending = []
    for _, data in sorted(mention_counts.items(), key=lambda x: x[1]["count"], reverse=True):
        sents = data["sentiments"]
        trending.append(
            {
                **data["player"],
                "mention_count": data["count"],
                "avg_sentiment": round(sum(sents) / len(sents), 4) if sents else 0.0,
            }
        )

    return {"articles": formatted, "trending": trending}
