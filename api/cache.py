"""Thread-safe TTL cache for the live calls that cannot be precomputed.

Holds a manager's squad, the FPL bootstrap and the Guardian feed. Predictions
are not in here: they come from the snapshot on disk.

Bounded on purpose. The squad key is an FPL ID the caller chooses, so an
unbounded dict grows one entry and one lock per ID ever asked for, and a
scanner walking the ID range exhausts memory long before it exhausts the range.
Eviction is least-recently-used once `maxsize` is passed, and expired entries
go first because they are dead weight however recently they were read.

One process, one cache. Two workers means two copies and twice the upstream
traffic, so horizontal scaling wants a shared cache (Redis) rather than more of
these.
"""

import threading
from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any

# A cached value may legitimately be None or empty, so absence needs its own
# marker rather than relying on falsiness.
_MISS = object()

# ~1000 squads at roughly 20KB each once parsed, so tens of MB at worst. Chosen
# to fit a small instance with room to spare, not to hold every manager.
DEFAULT_MAXSIZE = 1000


@dataclass
class _Entry:
    value: Any
    stored_at: datetime
    expires_at: datetime


class FPLDataCache:
    """In-memory cache with per-key TTL, LRU eviction and dedup locking."""

    def __init__(self, ttl_minutes: int = 15, maxsize: int = DEFAULT_MAXSIZE):
        if maxsize < 1:
            raise ValueError(f"maxsize must be at least 1, got {maxsize}")
        self.ttl = timedelta(minutes=ttl_minutes)
        self.maxsize = maxsize
        self._entries: dict[str, _Entry] = {}
        self._lock = threading.Lock()
        self._key_locks: dict[str, threading.Lock] = {}

    def _get_key_lock(self, key: str) -> threading.Lock:
        with self._lock:
            lock = self._key_locks.get(key)
            if lock is not None:
                return lock

            lock = threading.Lock()
            self._key_locks[key] = lock
            # Evicting a lock another thread is currently holding is safe: that
            # thread holds its own reference, so its lock still works. The only
            # cost is that a later arrival may make one duplicate upstream
            # fetch, which is bounded, unlike a lock per ID ever requested.
            while len(self._key_locks) > self.maxsize:
                oldest = next(iter(self._key_locks))
                del self._key_locks[oldest]
            return lock

    def _get_fresh(self, key: str) -> Any:
        """The live value for `key`, or `_MISS`. Drops it if it has expired."""
        with self._lock:
            entry = self._entries.get(key)
            if entry is None:
                return _MISS
            if datetime.now() >= entry.expires_at:
                del self._entries[key]
                return _MISS
            # Python 3.7+ dicts keep insertion order, so re-inserting moves the
            # key to the end and makes the first key the least recently used.
            del self._entries[key]
            self._entries[key] = entry
            return entry.value

    def _store(self, key: str, value: Any, ttl: timedelta) -> None:
        now = datetime.now()
        with self._lock:
            self._entries.pop(key, None)
            self._entries[key] = _Entry(value=value, stored_at=now, expires_at=now + ttl)

            for dead in [k for k, e in self._entries.items() if now >= e.expires_at]:
                del self._entries[dead]
            while len(self._entries) > self.maxsize:
                del self._entries[next(iter(self._entries))]

    def get_or_fetch(self, key: str, fetch_fn: Callable, ttl_minutes: int | None = None) -> Any:
        """The cached value for `key`, calling `fetch_fn` once if it is absent.

        The expiry is fixed when the value is stored, so a caller passing
        `ttl_minutes` sets how long *that* value lives rather than how stale a
        reader is willing to tolerate.
        """
        ttl = timedelta(minutes=ttl_minutes) if ttl_minutes is not None else self.ttl

        value = self._get_fresh(key)
        if value is not _MISS:
            return value

        # One fetch per key at a time. Without this, 50 simultaneous misses for
        # the same key would become 50 identical upstream calls.
        with self._get_key_lock(key):
            value = self._get_fresh(key)
            if value is not _MISS:
                return value

            data = fetch_fn()
            self._store(key, data, ttl)
            return data

    def invalidate(self, key: str | None = None):
        with self._lock:
            if key:
                self._entries.pop(key, None)
                self._key_locks.pop(key, None)
            else:
                self._entries.clear()
                self._key_locks.clear()

    def keys(self) -> list[str]:
        with self._lock:
            return list(self._entries)

    def last_updated(self, key: str) -> str | None:
        with self._lock:
            entry = self._entries.get(key)
            return entry.stored_at.isoformat() if entry else None
