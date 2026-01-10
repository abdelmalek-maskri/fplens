# ml/utils/name_normalize.py
from __future__ import annotations

import re
import unicodedata

# Canonical aliases AFTER basic cleaning (lowercase, punctuation removed, etc.)
# Keep keys in their "cleaned" form (spaces only, no punctuation).
ALIASES = {
    # Spurs / Tottenham
    "tottenham": "spurs",
    "tottenham hotspur": "spurs",

    # Manchester clubs
    "manchester united": "man utd",
    "man united": "man utd",
    "manchester utd": "man utd",
    "manchester city": "man city",

    # Wolves
    "wolverhampton": "wolves",
    "wolverhampton wanderers": "wolves",

    # West Brom naming variants
    "west bromwich albion": "west brom",
    "west bromwich": "west brom",

    # Sheffield United variants
    "sheffield united": "sheffield utd",

    # Nottingham Forest variants (just in case)
    "nottingham forest": "nottm forest",
    "notts forest": "nottm forest",

    # Brighton variants
    "brighton and hove albion": "brighton",

    # Newcastle variants
    "newcastle united": "newcastle",

    # Stoke variants (older seasons)
    "stoke city": "stoke",

    # Swansea variants
    "swansea city": "swansea",

    # Hull variants (older seasons)
    "hull city": "hull",

    # Cardiff
    "cardiff city": "cardiff",

    # Leicester / Everton etc usually consistent, but you can add here as needed
}

# Words to drop when cleaning names (keep conservative)
STOPWORDS = {
    "fc",
    "afc",
    "the",
}


def _strip_accents(s: str) -> str:
    """Normalize unicode accents: Kanté -> kante."""
    s = unicodedata.normalize("NFKD", s)
    return "".join(ch for ch in s if not unicodedata.combining(ch))


def _basic_clean(s: str) -> str:
    """
    Lowercase, remove accents, replace & with and,
    drop punctuation, normalize spaces.
    """
    s = _strip_accents(s)
    s = s.lower().strip()

    s = s.replace("&", " and ")

    # Replace any non-alphanumeric with spaces (keep digits/letters)
    s = re.sub(r"[^a-z0-9]+", " ", s)

    # Collapse whitespace
    s = re.sub(r"\s+", " ", s).strip()

    # Drop stopwords (conservative)
    if s:
        parts = [p for p in s.split(" ") if p and p not in STOPWORDS]
        s = " ".join(parts)

    return s


def norm(s: str) -> str:
    """
    Canonical normalization used across the pipeline to join team/player names.

    Example:
      - "Tottenham" -> "spurs"
      - "Wolverhampton Wanderers" -> "wolves"
      - "Manchester United" -> "man utd"
      - "N'Golo Kanté" -> "ngolo kante"
    """
    if s is None:
        return ""

    s = str(s)
    s_clean = _basic_clean(s)

    # Apply aliases (keys must match cleaned form)
    return ALIASES.get(s_clean, s_clean)
