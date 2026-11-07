"""Budgets for the calls this process makes to the FPL API on a caller's behalf.

Everything else the API serves is either a committed file or a single shared
cache key, so no caller can make this process talk to a third party more than
once per TTL. /team is the exception: the fpl_id *is* the cache key, so a caller
who varies it turns this process into a proxy that calls the FPL API twice per
new value, from an IP we do not own.

Path(ge=1, le=15_000_000) bounds the value, not the rate.

The budget is spent on upstream fetches rather than on requests. A second
lookup of an already-cached squad costs the FPL API nothing, so it costs the
caller nothing, which keeps a manager refreshing their own team off the limit
entirely.
"""

import os
import threading
import time

from fastapi import Request

# Fixed windows, so the per-caller limit is "this many new squads a minute".
WINDOW_SECONDS = 60

# A human types in an FPL ID, maybe a friend's, maybe a rival's. Ten new squads
# a minute is far more than that and still leaves a scraper needing years for
# the full ID range.
PER_CLIENT_LIMIT = 10

# What FPL sees from us at worst, whatever the number of callers. The snapshot
# job makes ~800 calls in 30 seconds without trouble, so one a second sustained
# is well inside what they tolerate, and it caps a distributed scrape that the
# per-caller limit alone would miss.
OVERALL_LIMIT = 60

# Each tracked key is a short tuple, so this bounds the limiter's own memory at
# a few MB. Reaching it means the current window holds more distinct callers
# than any real traffic would, and the sweep below drops the stale ones.
MAX_TRACKED_KEYS = 100_000


def _env_int(name: str, default: int) -> int:
    """A positive int from the environment, or the default.

    Validated here because a typo that silently became 0 would switch the limit
    off, which is the one failure mode worth being loud about.
    """
    raw = os.environ.get(name, "").strip()
    if not raw:
        return default
    try:
        value = int(raw)
    except ValueError:
        raise ValueError(f"{name} must be a positive integer, got {raw!r}") from None
    if value < 1:
        raise ValueError(f"{name} must be at least 1, got {value}")
    return value


# Trusting X-Forwarded-For by default would hand every caller a free way to look
# like a million callers, which is worse than having no per-caller limit at all.
# Turn it on only when a proxy is genuinely in front, as on Render.
TRUST_PROXY_HEADERS = os.environ.get("TRUST_PROXY_HEADERS", "").strip() == "1"


class RateLimited(Exception):
    """A budget is spent. Carries the seconds until it refills."""

    def __init__(self, retry_after: int, scope: str):
        super().__init__(f"{scope} rate limit exceeded")
        self.retry_after = retry_after
        self.scope = scope


class FixedWindowLimiter:
    """Counts events per key in fixed windows, and refuses past a limit.

    A fixed window lets through up to twice the limit across a boundary. That is
    acceptable here: the budget protects a third party from sustained traffic,
    not from a one-second burst, and a sliding window would mean keeping a
    timestamp per event.
    """

    def __init__(self, name: str, limit: int, window_seconds: int = WINDOW_SECONDS):
        self.name = name
        self.limit = limit
        self.window = window_seconds
        self._lock = threading.Lock()
        # key -> (window start, events so far in that window)
        self._counts: dict[str, tuple[int, int]] = {}

    def charge(self, key: str) -> None:
        """Record one event against `key`, or raise RateLimited."""
        with self._lock:
            # monotonic, so a clock change cannot hand out a fresh window.
            now = int(time.monotonic())
            window_start = now - (now % self.window)

            if len(self._counts) > MAX_TRACKED_KEYS:
                self._counts = {k: v for k, v in self._counts.items() if v[0] == window_start}

            start, count = self._counts.get(key, (window_start, 0))
            if start != window_start:
                start, count = window_start, 0

            if count >= self.limit:
                raise RateLimited(retry_after=start + self.window - now, scope=self.name)

            self._counts[key] = (start, count + 1)

    def reset(self) -> None:
        with self._lock:
            self._counts.clear()


class UpstreamGuard:
    """The per-caller and overall budgets for one upstream service."""

    def __init__(self, per_client_limit: int | None = None, overall_limit: int | None = None):
        self.per_client = FixedWindowLimiter(
            "per-client",
            per_client_limit if per_client_limit is not None else _env_int("RATE_LIMIT_PER_CLIENT", PER_CLIENT_LIMIT),
        )
        self.overall = FixedWindowLimiter(
            "overall",
            overall_limit if overall_limit is not None else _env_int("RATE_LIMIT_OVERALL", OVERALL_LIMIT),
        )

    def charge(self, client: str) -> None:
        """Bill one upstream fetch, or raise RateLimited.

        Per-caller first, so one noisy caller is stopped before it can spend the
        shared budget and make everyone else wait. A caller that passes its own
        limit and then hits the overall one loses a unit of its own budget; the
        window refills it within the minute.
        """
        self.per_client.charge(client)
        self.overall.charge("all")

    def reset(self) -> None:
        self.per_client.reset()
        self.overall.reset()


def client_key(request: Request) -> str:
    """Who to bill for an upstream fetch.

    The last entry in X-Forwarded-For, not the first. A proxy appends the
    address it received the request from, so the last entry is the only one the
    nearest proxy wrote and the only one a caller cannot set. Render appends,
    which means reading the first entry would let anyone spend someone else's
    budget by sending their own header.

    Behind two proxies the last entry is the outer one, so everything arriving
    through it shares a budget. That still protects FPL, which is the point; it
    just stops being fair.

    With TRUST_PROXY_HEADERS unset, every caller behind a proxy looks like the
    proxy and the per-caller budget collapses into a second overall one.
    """
    if TRUST_PROXY_HEADERS:
        forwarded = request.headers.get("X-Forwarded-For", "")
        hops = [hop.strip() for hop in forwarded.split(",") if hop.strip()]
        if hops:
            return hops[-1]
    return request.client.host if request.client else "unknown"
