"""Tests for latest_squad_gw() in fetch_live_data.

FPL serves a manager's picks from the moment that gameweek's deadline passes,
not from the moment it finishes. The gap between the two is most of a week.
"""

from datetime import datetime, timedelta, timezone

import pytest

from job.fetch_live_data import latest_squad_gw

NOW = datetime(2026, 11, 7, 13, 0, tzinfo=timezone.utc)


def _gw(gw_id, deadline, finished=False):
    return {"id": gw_id, "deadline_time": deadline, "finished": finished}


# The live state on 2026-11-07, read off the FPL API. GW10's deadline had
# passed, it was not finished, and /entry/{id}/event/10/picks/ returned 15.
LIVE = [
    _gw(9, "2026-10-31T11:00:00Z", finished=True),
    _gw(10, "2026-11-06T18:30:00Z", finished=False),
    _gw(11, "2026-11-21T11:00:00Z", finished=False),
]


class TestLatestSquadGw:
    def test_picks_the_gameweek_being_played(self):
        """The regression. Keying off `finished` returned GW9 here."""
        assert latest_squad_gw(LIVE, now=NOW) == 10

    def test_ignores_a_gameweek_whose_deadline_has_not_passed(self):
        """Picks are private until the deadline, so asking would 404."""
        before = datetime(2026, 11, 6, 18, 29, tzinfo=timezone.utc)
        assert latest_squad_gw(LIVE, now=before) == 9

    def test_includes_a_deadline_that_has_only_just_passed(self):
        """The boundary is the moment picks become public."""
        at = datetime(2026, 11, 6, 18, 30, tzinfo=timezone.utc)
        assert latest_squad_gw(LIVE, now=at) == 10

    def test_stays_on_the_last_gameweek_during_the_gap(self):
        """Between GW10 ending and GW11's deadline there is nothing newer."""
        finished = [_gw(9, "2026-10-31T11:00:00Z", True), _gw(10, "2026-11-06T18:30:00Z", True), LIVE[2]]
        gap = datetime(2026, 11, 15, 12, 0, tzinfo=timezone.utc)
        assert latest_squad_gw(finished, now=gap) == 10

    def test_does_not_trust_list_order(self):
        """Nothing guarantees the API returns events sorted by id."""
        assert latest_squad_gw(list(reversed(LIVE)), now=NOW) == 10

    def test_refuses_before_the_season_starts(self):
        upcoming = [_gw(1, "2027-08-13T17:30:00Z")]
        with pytest.raises(RuntimeError, match="No gameweek deadline"):
            latest_squad_gw(upcoming, now=NOW)

    def test_skips_a_gameweek_with_no_deadline(self):
        """A missing field should cost one gameweek, not the whole lookup."""
        events = [LIVE[0], {"id": 10, "finished": False}]
        assert latest_squad_gw(events, now=NOW) == 9

    def test_skips_an_unparseable_deadline(self):
        events = [LIVE[0], _gw(10, "not a date")]
        assert latest_squad_gw(events, now=NOW) == 9

    def test_skips_a_timezone_less_deadline(self):
        events = [LIVE[0], _gw(10, "2026-11-06T18:30:00")]
        assert latest_squad_gw(events, now=NOW) == 9

    def test_accepts_a_deadline_with_a_timezone_offset(self):
        events = [LIVE[0], _gw(10, "2026-11-07T14:00:00+01:00")]
        assert latest_squad_gw(events, now=NOW) == 10

    def test_defaults_to_the_current_time(self):
        """The production path passes no clock."""
        just_gone = (datetime.now(timezone.utc) - timedelta(minutes=1)).isoformat().replace("+00:00", "Z")
        assert latest_squad_gw([_gw(7, just_gone)]) == 7
