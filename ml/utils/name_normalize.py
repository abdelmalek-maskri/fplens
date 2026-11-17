"""Reduce a club or player name to one canonical form.

FPL, Understat and the Guardian each spell the same club three ways, and the
only key they share is the name. Everything here exists to make those three
spellings produce one string.
"""

from __future__ import annotations

import html
import re
import unicodedata

# ---------------------------------------------------------------------------
# Characters that NFKD does not decompose into ASCII base + combining mark.
# Map them explicitly before running the standard accent-strip pass.
_EXTRA_TRANSLITERATE = str.maketrans(
    {
        "\u00d8": "O",  # Ø
        "\u00f8": "o",  # ø
        "\u00c6": "AE",  # Æ
        "\u00e6": "ae",  # æ
        "\u00d0": "D",  # Ð
        "\u00f0": "d",  # ð
        "\u0141": "L",  # Ł
        "\u0142": "l",  # ł
        "\u00df": "ss",  # ß
        "\u0110": "D",  # Đ
        "\u0111": "d",  # đ
    }
)

# Applied after _basic_clean, so the keys here must already be in cleaned
# form: lowercase, no punctuation, single spaces. A key with an apostrophe
# in it would never match anything.
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

# Dropped because one source includes them and another does not, so they
# carry no information and only cause mismatches.
STOPWORDS = {
    "fc",
    "afc",
    "the",
}
# ---------------------------------------------------------------------------


def _strip_accents(s: str) -> str:
    """Normalize unicode accents: Kanté -> kante, Ødegaard -> odegaard."""
    s = s.translate(_EXTRA_TRANSLITERATE)
    s = unicodedata.normalize("NFKD", s)
    return "".join(ch for ch in s if not unicodedata.combining(ch))


def _basic_clean(s: str) -> str:
    """Lowercase, strip accents, drop punctuation, collapse spaces."""
    # Some sources double-encode, so a name can arrive as &#039; rather than
    # an apostrophe, and the regex below would turn that into three words.
    s = html.unescape(s)
    s = _strip_accents(s)
    s = s.lower().strip()

    s = s.replace("&", " and ")

    s = re.sub(r"[^a-z0-9]+", " ", s)

    s = re.sub(r"\s+", " ", s).strip()

    if s:
        parts = [p for p in s.split(" ") if p and p not in STOPWORDS]
        s = " ".join(parts)

    return s


def norm(s: str) -> str:
    """The canonical form every name-based join in this project uses.

    "Tottenham" and "Tottenham Hotspur" both become "spurs".
    "Wolverhampton Wanderers" becomes "wolves".
    "N'Golo Kanté" becomes "ngolo kante".
    """
    if s is None:
        return ""

    s = str(s)
    s_clean = _basic_clean(s)

    return ALIASES.get(s_clean, s_clean)
