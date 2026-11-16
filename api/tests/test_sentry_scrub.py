"""A manager's FPL ID must not leave the process inside an error report.

The scrubber is the last thing to touch an event before it is sent, so if it
misses a field the ID is on Sentry's servers and cannot be recalled."""

from api.main import scrub_fpl_id


def test_manager_id_is_replaced_in_the_request_url():
    event = {"request": {"url": "https://api.fplens.app/api/team/1234567"}}
    assert scrub_fpl_id(event, None)["request"]["url"] == "https://api.fplens.app/api/team/{fpl_id}"


def test_manager_id_is_replaced_in_breadcrumbs():
    event = {
        "breadcrumbs": {
            "values": [
                {"data": {"url": "http://localhost:8000/api/team/42"}},
                {"data": {"url": "http://localhost:8000/api/news"}},
                {"message": "no data key at all"},
            ]
        }
    }
    crumbs = scrub_fpl_id(event, None)["breadcrumbs"]["values"]
    assert crumbs[0]["data"]["url"] == "http://localhost:8000/api/team/{fpl_id}"
    assert crumbs[1]["data"]["url"] == "http://localhost:8000/api/news"


def test_other_urls_are_left_alone():
    event = {"request": {"url": "https://api.fplens.app/api/health"}}
    assert scrub_fpl_id(event, None)["request"]["url"] == "https://api.fplens.app/api/health"


def test_event_without_a_request_survives():
    # Not every event comes from a request. A crash in the scrubber would drop
    # the error report entirely, which is worse than the error it describes.
    assert scrub_fpl_id({"message": "startup failed"}, None) == {"message": "startup failed"}


def test_non_string_url_is_ignored():
    event = {"request": {"url": None}}
    assert scrub_fpl_id(event, None)["request"]["url"] is None
