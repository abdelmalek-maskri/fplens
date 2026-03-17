"""Thread-safe TTL cache for FPL API responses and prediction results."""

import threading
from collections.abc import Callable
from datetime import datetime, timedelta
from typing import Any


class FPLDataCache:
    """In-memory cache with per-key TTL expiry and dedup locking."""

    def __init__(self, ttl_minutes: int = 15):
        self.ttl = timedelta(minutes=ttl_minutes)
        self._cache: dict[str, Any] = {}
        self._timestamps: dict[str, datetime] = {}
        self._lock = threading.Lock()
        self._key_locks: dict[str, threading.Lock] = {}

    def _get_key_lock(self, key: str) -> threading.Lock:
        with self._lock:
            if key not in self._key_locks:
                self._key_locks[key] = threading.Lock()
            return self._key_locks[key]

    def get_or_fetch(self, key: str, fetch_fn: Callable, ttl_minutes: int | None = None) -> Any:
        ttl = timedelta(minutes=ttl_minutes) if ttl_minutes is not None else self.ttl

        # Fast path: check under global lock
        with self._lock:
            now = datetime.now()
            if key in self._cache and (now - self._timestamps[key]) < ttl:
                return self._cache[key]

        # Per-key lock prevents duplicate fetches for the same key
        key_lock = self._get_key_lock(key)
        with key_lock:
            # Re-check: another thread may have populated while we waited
            with self._lock:
                now = datetime.now()
                if key in self._cache and (now - self._timestamps[key]) < ttl:
                    return self._cache[key]

            data = fetch_fn()

            with self._lock:
                self._cache[key] = data
                self._timestamps[key] = datetime.now()
            return data

    def invalidate(self, key: str | None = None):
        with self._lock:
            if key:
                self._cache.pop(key, None)
                self._timestamps.pop(key, None)
                self._key_locks.pop(key, None)
            else:
                self._cache.clear()
                self._timestamps.clear()
                self._key_locks.clear()

    def keys(self) -> list[str]:
        return list(self._cache.keys())

    def last_updated(self, key: str) -> str | None:
        ts = self._timestamps.get(key)
        return ts.isoformat() if ts else None
