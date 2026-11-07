"""The cache is the only thing standing between a chosen key and the FPL API,
so it has to stay bounded and keep deduplicating."""

import threading
import time

import pytest

from api.cache import FPLDataCache


@pytest.fixture
def cache():
    return FPLDataCache(ttl_minutes=15, maxsize=3)


def test_fetches_once_then_serves_from_memory(cache):
    calls = []
    fetch = lambda: calls.append(1) or "squad"  # noqa: E731
    assert cache.get_or_fetch("team_1", fetch) == "squad"
    assert cache.get_or_fetch("team_1", fetch) == "squad"
    assert len(calls) == 1


def test_refetches_once_the_entry_expires():
    cache = FPLDataCache(ttl_minutes=0, maxsize=3)
    calls = []
    fetch = lambda: calls.append(1) or "squad"  # noqa: E731
    cache.get_or_fetch("team_1", fetch)
    cache.get_or_fetch("team_1", fetch)
    assert len(calls) == 2


# A squad with nothing in it is still an answer, and must not look like a miss.
def test_a_falsy_value_is_a_hit(cache):
    calls = []
    fetch = lambda: calls.append(1) or None  # noqa: E731
    assert cache.get_or_fetch("team_1", fetch) is None
    assert cache.get_or_fetch("team_1", fetch) is None
    assert len(calls) == 1


class TestBounds:
    """An FPL ID is caller-chosen, so anything keyed by one has to be capped."""

    def test_never_holds_more_than_maxsize_entries(self, cache):
        for i in range(50):
            cache.get_or_fetch(f"team_{i}", lambda: "squad")
        assert len(cache.keys()) == 3

    def test_never_holds_more_than_maxsize_locks(self, cache):
        for i in range(50):
            cache.get_or_fetch(f"team_{i}", lambda: "squad")
        assert len(cache._key_locks) <= 3

    def test_drops_the_least_recently_used(self, cache):
        for key in ("a", "b", "c"):
            cache.get_or_fetch(key, lambda k=key: k)
        cache.get_or_fetch("a", lambda: "a")  # "b" is now the coldest
        cache.get_or_fetch("d", lambda: "d")
        assert set(cache.keys()) == {"a", "c", "d"}

    # Refusing a fetch still creates a lock, so a flood of rejected requests
    # would leak just as fast as a flood of accepted ones.
    def test_stays_bounded_when_every_fetch_fails(self, cache):
        def boom():
            raise RuntimeError("refused")

        for i in range(50):
            with pytest.raises(RuntimeError):
                cache.get_or_fetch(f"team_{i}", boom)
        assert len(cache._key_locks) <= 3
        assert cache.keys() == []


class TestDedup:
    def test_simultaneous_misses_make_one_upstream_call(self, cache):
        """Otherwise a cold key with 20 readers becomes 20 identical calls."""
        calls = []
        started = threading.Barrier(20)

        def slow_fetch():
            calls.append(1)
            time.sleep(0.05)
            return "squad"

        def reader():
            started.wait()
            cache.get_or_fetch("team_1", slow_fetch)

        threads = [threading.Thread(target=reader) for _ in range(20)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        assert len(calls) == 1

    def test_different_keys_do_not_block_each_other(self, cache):
        done = []

        def reader(key):
            cache.get_or_fetch(key, lambda: time.sleep(0.05) or key)
            done.append(key)

        threads = [threading.Thread(target=reader, args=(f"k{i}",)) for i in range(3)]
        start = time.monotonic()
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        assert len(done) == 3
        # Serialised they would take 0.15s; in parallel, well under.
        assert time.monotonic() - start < 0.12


class TestInvalidate:
    def test_drops_one_key(self, cache):
        cache.get_or_fetch("a", lambda: "a")
        cache.get_or_fetch("b", lambda: "b")
        cache.invalidate("a")
        assert cache.keys() == ["b"]

    def test_drops_everything(self, cache):
        cache.get_or_fetch("a", lambda: "a")
        cache.invalidate()
        assert cache.keys() == []
        assert cache._key_locks == {}


def test_reports_when_a_key_was_stored(cache):
    assert cache.last_updated("a") is None
    cache.get_or_fetch("a", lambda: "a")
    assert cache.last_updated("a") is not None


def test_refuses_a_maxsize_that_bounds_nothing():
    with pytest.raises(ValueError, match="at least 1"):
        FPLDataCache(maxsize=0)
