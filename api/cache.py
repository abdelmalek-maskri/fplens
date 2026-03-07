"""TTL-based cache for FPL API responses and prediction results."""

import threading
from collections.abc import Callable
from datetime import datetime, timedelta
from typing import Any


class FPLDataCache:
    # Thread-safe in-memory cache with per-key TTL expiry

    def __init__(self, ttl_minutes: int = 15):
        self.ttl = timedelta(minutes=ttl_minutes)
        self._cache: dict[str, Any] = {}
        self._timestamps: dict[str, datetime] = {}
        self._lock = threading.Lock()

    def get_or_fetch(self, key: str, fetch_fn: Callable) -> Any:
        # return cached value if fresh, otherwise call fetch_fn and cache result
        with self._lock:
            now = datetime.now()
            if key in self._cache and (now - self._timestamps[key]) < self.ttl:
                return self._cache[key]

        # run fetch outside lock to avoid blocking other keys
        data = fetch_fn()

        with self._lock:
            self._cache[key] = data
            self._timestamps[key] = datetime.now()
        return data

    def invalidate(self, key: str | None = None):
        # clear one key or entire cache.
        with self._lock:
            if key:
                self._cache.pop(key, None)
                self._timestamps.pop(key, None)
            else:
                self._cache.clear()
                self._timestamps.clear()

    def keys(self) -> list[str]:
        return list(self._cache.keys())

    def last_updated(self, key: str) -> str | None:
        ts = self._timestamps.get(key)
        return ts.isoformat() if ts else None
