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

# ---------------------------------------------------------------------------
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
# ---------------------------------------------------------------------------

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
    """Strip tags from a Guardian article body."""
    if not html:
        return ""
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup.find_all(["script", "style", "aside", "nav", "footer"]):
        tag.decompose()
    text = soup.get_text(separator=" ", strip=True)
    return re.sub(r"\s+", " ", text).strip()


def _extract_snippet(text, num_sentences=3):
    """The first couple of sentences, for the card on the news page."""
    if not text:
        return ""
    sentences = re.split(r"(?<=[.!?])\s+", text)
    return " ".join(sentences[:num_sentences])


def _is_pl_relevant(title, body):
    """Whether an article is about the Premier League at all."""
    combined = f"{title} {body[:500]}"
    return not bool(EXCLUDE_PATTERNS.search(combined))


def _fetch_guardian_articles(days=7):
    """Recent Premier League articles from the Guardian's open platform.

    Returns an empty list rather than raising when no key is configured, so
    the news page degrades to empty instead of failing the whole response.
    """
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

            # The standfirst is the editor's one-line summary. The opening of
            # a live blog is the sign-off ("that's it from me, thanks all"),
            # so the body is only a fallback.
            snippet = _html_to_text(fields.get("trailText", "")) or _extract_snippet(body_text)

            articles.append(
                {
                    "guardian_id": r["id"],
                    "title": title,
                    "body_text": body_text,
                    "snippet": snippet,
                    "published_date": r.get("webPublicationDate", ""),
                }
            )

        total_pages = data.get("pages", 1)
        if page >= total_pages:
            break

    logger.info("Fetched %d Guardian articles from last %d days", len(articles), days)
    return articles


def _build_player_lookup(bootstrap_data):
    """Map every spelling of a player's name to that player.

    Built from the live bootstrap rather than the training features, so a
    player who signed this week is still recognised in a headline.
    """
    teams = {t["id"]: t["short_name"] for t in bootstrap_data["teams"]}
    position_map = {1: "GK", 2: "DEF", 3: "MID", 4: "FWD"}

    # Every player who could be meant by each variant. A bare surname like
    # "Silva" belongs to four players, so it links to none of them; the full
    # name still does.
    claims = {}
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

        # A headline may use any of these, so each one claims the player.
        # "Mohamed Salah", "Salah", "M. Salah" and "M Salah" are all him.
        variants = [full_name]
        parts = full_name.split()
        if len(parts) >= 2:
            surname = parts[-1]
            if len(surname) >= MIN_SURNAME_LENGTH:
                variants.append(surname)
                variants.append(f"{parts[0][0]}. {surname}")
                variants.append(f"{parts[0][0]} {surname}")
        # FPL's own display name, which is often but not always the surname.
        wn_lower = web_name.lower()
        if len(wn_lower) >= MIN_SURNAME_LENGTH:
            variants.append(wn_lower)

        for v in set(variants):
            claims.setdefault(v, set()).add(element)

    lookup = {v: next(iter(owners)) for v, owners in claims.items() if len(owners) == 1}
    return lookup, player_info


def _link_articles_to_players(articles, lookup, nlp=None):
    """Mark which players each article is about.

    Regex is the primary pass. spaCy, when installed, adds the spellings a
    fixed pattern cannot anticipate, and the project runs without it.
    """
    # Compiled once for all 2000 variants rather than per article, which is
    # the difference between one pass and two thousand.
    compiled = {variant: re.compile(r"\b" + re.escape(variant) + r"\b", re.IGNORECASE) for variant in lookup}

    # Longest variant first. One player's web_name can be another's first name:
    # a Hull defender is "Jacob", so "Jacob Ramsey" in a headline would match
    # both unless the full name claims that text first.
    by_length = sorted(lookup, key=len, reverse=True)

    for article in articles:
        title = article["title"]
        body = article["body_text"][:5000]
        body_lower = body.lower()
        found = {}

        # The title gets every variant, including bare surnames: a headline
        # naming one word is naming that player.
        claimed: list[tuple[int, int]] = []
        for variant in by_length:
            for m in compiled[variant].finditer(title):
                if any(start <= m.start() and m.end() <= end for start, end in claimed):
                    continue
                found[lookup[variant]] = True
                claimed.append((m.start(), m.end()))

        # Body uses full names only, so the nesting problem above cannot occur
        # here: no single-token web_name is ever tested against the body.
        # Two thousand full names against every body is the whole cost of this
        # endpoint. Variants are already lowercase and the pattern is a plain
        # \bvariant\b, so a name absent as a substring cannot match the regex
        # either, and Python's substring search is far cheaper than entering the
        # regex engine. ASCII only: str.lower() and re.IGNORECASE disagree on
        # the Turkish dotless i, so "KADIOĞLU" lowercases to a dotted i and
        # would skip a variant the regex does match. Those 11% keep the slow path.
        for variant, element in lookup.items():
            if " " not in variant:
                continue
            if element in found:
                continue
            if variant.isascii() and variant not in body_lower:
                continue
            if compiled[variant].search(body):
                found[element] = True

        # Catches spellings the variant list does not hold, such as a name
        # written with an accent the lookup stripped.
        if nlp is not None:
            try:
                doc = nlp(f"{title}. {body}")
                for ent in doc.ents:
                    if ent.label_ != "PERSON":
                        continue
                    normalized = ent.text.lower().strip()
                    if normalized in lookup:
                        found[lookup[normalized]] = True
                    # The entity may be the full name where the lookup only
                    # knows the surname, or the other way round.
                    parts = normalized.split()
                    if len(parts) >= 2:
                        surname = parts[-1]
                        if surname in lookup:
                            found[lookup[surname]] = True
            except Exception as e:
                logger.warning("spaCy NER failed for article: %s", e)

        article["player_elements"] = list(found.keys())
        # Headline, standfirst and the first paragraph. Scanning the whole body
        # flagged half of all articles, because "knee" or "injured" turns up
        # somewhere in most match reports. If the injury is the story, it is
        # in the opening. 500 characters keeps the weekly team-news piece,
        # which lists who is out, and drops the reports that mention a knock
        # in passing.
        lead = f"{title} {article.get('snippet', '')} {body[:500]}"
        article["injury_flag"] = bool(INJURY_KEYWORDS.search(lead))

    return articles


def _compute_sentiment(articles, sentiment_pipe=None):
    """Score each article from -1 to +1.

    RoBERTa when the transformer stack is installed, keyword counting when it
    is not. The fallback is crude but keeps the news page working without
    ~400MB of wheels on the serving image.
    """
    for article in articles:
        if sentiment_pipe is not None:
            try:
                text = f"{article['title']}. {article['snippet']}"
                results = sentiment_pipe(text[:512], top_k=3)
                scores = {r["label"].lower(): r["score"] for r in results}
                pos = scores.get("positive", 0.0)
                neg = scores.get("negative", 0.0)
                # One number from the model's two: -1 is wholly negative and
                # +1 wholly positive, so a mixed article lands near zero.
                article["sentiment"] = round(pos - neg, 4)
            except Exception:
                article["sentiment"] = 0.0
        else:
            # No transformer installed. Counting words is crude, but it keeps
            # the news page working without 400MB of wheels.
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
    """Fetch Guardian articles, link them to players, score them, format them.

    The entry point the API calls. Nothing here is cached to disk: the
    Guardian's licence forbids retaining content beyond 24 hours, which is
    why this is the one endpoint that fetches live.
    """
    articles = _fetch_guardian_articles(days=days)
    if not articles:
        return {"articles": [], "trending": []}

    lookup, player_info = _build_player_lookup(bootstrap_data)

    articles = _link_articles_to_players(articles, lookup, _nlp)
    articles = _compute_sentiment(articles, _sentiment_pipe)

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

    # Mention counts are a derived aggregate, not Guardian content, so unlike
    # the articles themselves these are free to persist.
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
