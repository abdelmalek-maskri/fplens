# Tests for ml/pipelines/inference/news.py
# Covers: _is_pl_relevant, _build_player_lookup, _link_articles_to_players, _compute_sentiment

from ml.pipelines.inference.news import (
    _build_player_lookup,
    _compute_sentiment,
    _is_pl_relevant,
    _link_articles_to_players,
)


class TestIsPLRelevant:
    def test_accepts_plain_pl_article(self):
        assert _is_pl_relevant("Salah scores for Liverpool", "Premier League match") is True

    def test_rejects_womens_football(self):
        assert _is_pl_relevant("Women's Super League preview", "") is False

    def test_rejects_championship(self):
        assert _is_pl_relevant("Championship round-up", "Leeds vs Ipswich") is False

    def test_rejects_la_liga(self):
        assert _is_pl_relevant("La Liga title race", "Real Madrid vs Barcelona") is False

    def test_rejects_world_cup(self):
        assert _is_pl_relevant("World Cup 2026 qualifiers", "") is False

    def test_accepts_article_with_pl_team(self):
        assert _is_pl_relevant("Man City beat Arsenal", "Premier League top four battle") is True


class TestBuildPlayerLookup:
    def _make_bootstrap(self, players):
        return {
            "teams": [{"id": 1, "short_name": "LIV"}, {"id": 2, "short_name": "ARS"}],
            "elements": players,
        }

    def test_lookup_contains_web_name(self):
        bootstrap = self._make_bootstrap([
            {"id": 1, "web_name": "Salah", "first_name": "Mohamed", "second_name": "Salah", "team": 1, "element_type": 3},
        ])
        lookup, player_info = _build_player_lookup(bootstrap)
        assert "salah" in lookup
        assert lookup["salah"] == 1

    def test_lookup_contains_full_name(self):
        bootstrap = self._make_bootstrap([
            {"id": 1, "web_name": "Salah", "first_name": "Mohamed", "second_name": "Salah", "team": 1, "element_type": 3},
        ])
        lookup, _ = _build_player_lookup(bootstrap)
        assert "mohamed salah" in lookup

    def test_player_info_has_required_fields(self):
        bootstrap = self._make_bootstrap([
            {"id": 5, "web_name": "Gabriel", "first_name": "Gabriel", "second_name": "Magalhaes", "team": 2, "element_type": 2},
        ])
        _, player_info = _build_player_lookup(bootstrap)
        p = player_info[5]
        assert p["element"] == 5
        assert p["web_name"] == "Gabriel"
        assert p["team_name"] == "ARS"
        assert p["position"] == "DEF"

    def test_empty_bootstrap_returns_empty(self):
        bootstrap = {"teams": [], "elements": []}
        lookup, player_info = _build_player_lookup(bootstrap)
        assert lookup == {}
        assert player_info == {}


class TestLinkArticlesToPlayers:
    def _make_lookup(self):
        return {"salah": 1, "mohamed salah": 1, "haaland": 2, "erling haaland": 2}

    def test_links_surname_in_title(self):
        articles = [{"title": "Salah scores hat-trick", "body_text": ""}]
        result = _link_articles_to_players(articles, self._make_lookup(), nlp=None)
        assert 1 in result[0]["player_elements"]

    def test_links_full_name_in_body(self):
        articles = [{"title": "Liverpool win big", "body_text": "Erling Haaland was outstanding today."}]
        result = _link_articles_to_players(articles, self._make_lookup(), nlp=None)
        assert 2 in result[0]["player_elements"]

    def test_single_word_body_not_matched(self):
        # Single-word variants should not match in body (too much false positive risk)
        articles = [{"title": "No player here", "body_text": "Haaland was mentioned in body only."}]
        result = _link_articles_to_players(articles, self._make_lookup(), nlp=None)
        assert 2 not in result[0]["player_elements"]

    def test_case_insensitive_match(self):
        articles = [{"title": "SALAH BRILLIANT", "body_text": ""}]
        result = _link_articles_to_players(articles, self._make_lookup(), nlp=None)
        assert 1 in result[0]["player_elements"]

    def test_injury_flag_set_for_injury_article(self):
        articles = [{"title": "Salah ruled out", "body_text": "He is sidelined with a hamstring injury."}]
        result = _link_articles_to_players(articles, self._make_lookup(), nlp=None)
        assert result[0]["injury_flag"] is True

    def test_injury_flag_false_for_clean_article(self):
        articles = [{"title": "Salah scores again", "body_text": "Another brilliant performance."}]
        result = _link_articles_to_players(articles, self._make_lookup(), nlp=None)
        assert result[0]["injury_flag"] is False

    def test_no_match_returns_empty_list(self):
        articles = [{"title": "General football news", "body_text": "No specific player mentioned."}]
        result = _link_articles_to_players(articles, self._make_lookup(), nlp=None)
        assert result[0]["player_elements"] == []


class TestComputeSentiment:
    def test_keyword_positive_sentiment(self):
        articles = [{"title": "Salah brilliant hat-trick", "snippet": "Superb dominant performance wins"}]
        result = _compute_sentiment(articles, sentiment_pipe=None)
        assert result[0]["sentiment"] > 0

    def test_keyword_negative_sentiment(self):
        articles = [{"title": "Salah injury blow", "snippet": "ruled out miss doubt concern worry"}]
        result = _compute_sentiment(articles, sentiment_pipe=None)
        assert result[0]["sentiment"] < 0

    def test_neutral_returns_zero(self):
        articles = [{"title": "Match preview", "snippet": "Teams prepare for the fixture"}]
        result = _compute_sentiment(articles, sentiment_pipe=None)
        assert result[0]["sentiment"] == 0.0

    def test_sentiment_is_float(self):
        articles = [{"title": "Salah scores", "snippet": "brilliant goals wins"}]
        result = _compute_sentiment(articles, sentiment_pipe=None)
        assert isinstance(result[0]["sentiment"], float)

    def test_sentiment_in_range(self):
        articles = [{"title": "Test", "snippet": "injury blow doubt ruled out sidelined"}]
        result = _compute_sentiment(articles, sentiment_pipe=None)
        assert -1.0 <= result[0]["sentiment"] <= 1.0
