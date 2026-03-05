"""Token-bucket rate limiter with retry logic for Riot API."""

import time
import threading
import logging
from typing import Optional

import requests

from config import RATE_LIMIT_PER_SECOND, RATE_LIMIT_PER_2MIN

logger = logging.getLogger(__name__)


class RateLimiter:
    """Sliding-window rate limiter that enforces both per-second and per-2-minute limits."""

    def __init__(
        self,
        per_second: int = RATE_LIMIT_PER_SECOND,
        per_2min: int = RATE_LIMIT_PER_2MIN,
    ):
        self._per_second = per_second
        self._per_2min = per_2min
        self._timestamps: list[float] = []
        self._lock = threading.Lock()

    def _wait_if_needed(self) -> None:
        """Block until the next request is allowed."""
        while True:
            with self._lock:
                now = time.time()
                # Purge timestamps older than 2 minutes
                self._timestamps = [t for t in self._timestamps if now - t < 120]

                recent_1s = sum(1 for t in self._timestamps if now - t < 1)
                recent_2m = len(self._timestamps)

                if recent_1s < self._per_second and recent_2m < self._per_2min:
                    self._timestamps.append(now)
                    return

            # Calculate how long to sleep
            with self._lock:
                now = time.time()
                waits: list[float] = []
                recent_1s_ts = [t for t in self._timestamps if now - t < 1]
                if len(recent_1s_ts) >= self._per_second:
                    waits.append(recent_1s_ts[0] + 1.0 - now)
                if len(self._timestamps) >= self._per_2min:
                    waits.append(self._timestamps[0] + 120.0 - now)
                sleep_time = max(min(waits) if waits else 0.05, 0.05)

            logger.debug("Rate limit reached, sleeping %.2fs", sleep_time)
            time.sleep(sleep_time)

    def request(
        self,
        session: requests.Session,
        url: str,
        params: Optional[dict] = None,
        max_retries: int = 3,
    ) -> requests.Response:
        """Make a rate-limited GET request with retry logic.

        - 429: respect Retry-After header
        - 5xx: exponential back-off (up to max_retries)
        """
        for attempt in range(max_retries + 1):
            self._wait_if_needed()
            try:
                resp = session.get(url, params=params)
            except requests.ConnectionError as exc:
                logger.warning("Connection error (attempt %d): %s", attempt + 1, exc)
                if attempt == max_retries:
                    raise
                time.sleep(2 ** attempt)
                continue

            if resp.status_code == 200:
                return resp

            if resp.status_code == 429:
                retry_after = int(resp.headers.get("Retry-After", 5))
                logger.warning("429 rate limited — retrying after %ds", retry_after)
                time.sleep(retry_after)
                continue

            if 500 <= resp.status_code < 600:
                wait = 2 ** attempt
                logger.warning(
                    "%d server error (attempt %d) — retrying in %ds",
                    resp.status_code,
                    attempt + 1,
                    wait,
                )
                if attempt == max_retries:
                    resp.raise_for_status()
                time.sleep(wait)
                continue

            # 4xx (non-429) — raise immediately
            resp.raise_for_status()

        # Should not reach here, but just in case
        resp.raise_for_status()
        return resp  # type: ignore[return-value]
