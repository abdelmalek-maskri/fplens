"""Window boundary regressions for the upstream budget."""

from contextlib import contextmanager
from unittest.mock import patch

import pytest

from api.ratelimit import FixedWindowLimiter, RateLimited


def test_charge_uses_the_window_after_acquiring_the_lock():
    limiter = FixedWindowLimiter("test", limit=1)
    with patch("api.ratelimit.time.monotonic", return_value=59) as clock:
        limiter.charge("caller")

        @contextmanager
        def lock_after_boundary():
            # Simulate waiting for the lock across a window boundary.
            clock.return_value = 60
            yield

        limiter._lock = lock_after_boundary()
        limiter.charge("caller")

        # The new window's budget was spent by the charge above.
        limiter._lock = lock_after_boundary()
        with pytest.raises(RateLimited) as exc:
            limiter.charge("caller")
        assert exc.value.retry_after == 60
