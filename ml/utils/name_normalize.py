# ml/utils/name_normalize.py

from __future__ import annotations
import html
import re
import unicodedata

# Characters that NFKD does not decompose into ASCII base + combining mark.
# Map them explicitly before running the standard accent-strip pass.
_EXTRA_TRANSLITERATE = str.maketrans({
    "\u00d8": "O",   # Ø
    "\u00f8": "o",   # ø
    "\u00c6": "AE",  # Æ
    "\u00e6": "ae",  # æ
    "\u00d0": "D",   # Ð
    "\u00f0": "d",   # ð
    "\u0141": "L",   # Ł
    "\u0142": "l",   # ł
    "\u00df": "ss",  # ß
    "\u0110": "D",   # Đ
    "\u0111": "d",   # đ
})

# Canonical aliases AFTER basic cleaning (lowercase, punctuation removed, etc.)
# Keep keys in their "cleaned" form (spaces only, no punctuation).
ALIASES = {
    "tottenham": "spurs",
    "tottenham hotspur": "spurs",

    "manchester united": "man utd",
    "man united": "man utd",
    "manchester utd": "man utd",
    "manchester city": "man city",

    "wolverhampton": "wolves",
    "wolverhampton wanderers": "wolves",

    "west bromwich albion": "west brom",
    "west bromwich": "west brom",

    "sheffield united": "sheffield utd",

    "nottingham forest": "nottm forest",
    "notts forest": "nottm forest",
    "nott m forest": "nottm forest",

    "brighton and hove albion": "brighton",

    "newcastle united": "newcastle",

    "stoke city": "stoke",

    "swansea city": "swansea",

    "hull city": "hull",

    "cardiff city": "cardiff",

}

# Words to drop when cleaning names 
STOPWORDS = {
    "fc",
    "afc",
    "the",
}


def _strip_accents(s: str) -> str:
    """Normalize unicode accents: Kanté -> kante, Ødegaard -> odegaard."""
    s = s.translate(_EXTRA_TRANSLITERATE)
    s = unicodedata.normalize("NFKD", s)
    return "".join(ch for ch in s if not unicodedata.combining(ch))


def _basic_clean(s: str) -> str:
    """
    Lowercase, remove accents, replace & with and,
    drop punctuation, normalize spaces.
    """
    s = html.unescape(s)          # &#039; -> '
    s = _strip_accents(s)
    s = s.lower().strip()

    s = s.replace("&", " and ")

    # Replace any non-alphanumeric with spaces
    s = re.sub(r"[^a-z0-9]+", " ", s)

    # Collapse whitespace
    s = re.sub(r"\s+", " ", s).strip()

    # Drop stopwords
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
