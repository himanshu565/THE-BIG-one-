"""In-memory sliding-window rate limiting middleware for anti-brute-force and anti-DoS protection."""

import threading
import time
from collections import defaultdict

from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response

from app.config.settings import get_settings


class SlidingWindowRateLimiter:
    """Thread-safe sliding-window rate limiter per client IP."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        # map: ip -> list of request timestamps (float)
        self._hits: dict[str, list[float]] = defaultdict(list)

    def is_allowed(self, client_ip: str, max_requests: int, window_seconds: int = 60) -> tuple[bool, int]:
        """Check whether a request is within limit. Returns (is_allowed, retry_after_seconds)."""
        now = time.time()
        window_start = now - window_seconds

        with self._lock:
            timestamps = self._hits[client_ip]
            # Prune timestamps older than window_start
            valid_timestamps = [t for t in timestamps if t > window_start]
            self._hits[client_ip] = valid_timestamps

            if len(valid_timestamps) >= max_requests:
                # Calculate remaining time until the oldest hit in window expires
                oldest_hit = valid_timestamps[0]
                retry_after = max(1, int(oldest_hit + window_seconds - now))
                return False, retry_after

            # Record this request
            self._hits[client_ip].append(now)
            return True, 0

    def reset(self) -> None:
        """Clear all recorded hits (useful for testing)."""
        with self._lock:
            self._hits.clear()


# Global singleton instances
_auth_limiter = SlidingWindowRateLimiter()
_query_limiter = SlidingWindowRateLimiter()
_global_limiter = SlidingWindowRateLimiter()


def reset_rate_limiters() -> None:
    """Reset rate limiter state (used in automated test fixtures)."""
    _auth_limiter.reset()
    _query_limiter.reset()
    _global_limiter.reset()


def get_client_ip(request: Request) -> str:
    """Extract client IP address, respecting X-Forwarded-For if available."""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client:
        return request.client.host
    return "127.0.0.1"


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Enforces tiered rate limits to prevent brute-forcing, credential stuffing, and DoS."""

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        settings = get_settings()
        if not settings.rate_limit_enabled:
            return await call_next(request)

        path = request.url.path

        # Whitelist health and docs from rate limiting
        if path == "/health" or path.startswith("/docs") or path.startswith("/openapi.json"):
            return await call_next(request)

        client_ip = get_client_ip(request)

        # 1. Tier: Auth Endpoints (strictly throttled against brute-force / credential stuffing)
        if "/api/v1/auth/login" in path or "/api/v1/auth/register" in path:
            allowed, retry_after = _auth_limiter.is_allowed(
                f"auth_{client_ip}",
                max_requests=settings.auth_rate_limit_per_minute,
                window_seconds=60,
            )
            if not allowed:
                return JSONResponse(
                    status_code=429,
                    content={
                        "detail": f"Too many authentication attempts. Please wait {retry_after} seconds before retrying.",
                        "error_code": "AUTH_RATE_LIMIT_EXCEEDED",
                    },
                    headers={"Retry-After": str(retry_after)},
                )

        # 2. Tier: RAG Query & Ingestion Endpoints (protects LLM tokens & vector compute)
        elif "/query" in path or "/search" in path or "/documents/upload" in path:
            allowed, retry_after = _query_limiter.is_allowed(
                f"query_{client_ip}",
                max_requests=settings.query_rate_limit_per_minute,
                window_seconds=60,
            )
            if not allowed:
                return JSONResponse(
                    status_code=429,
                    content={
                        "detail": f"Retrieval rate limit exceeded. Please wait {retry_after} seconds.",
                        "error_code": "QUERY_RATE_LIMIT_EXCEEDED",
                    },
                    headers={"Retry-After": str(retry_after)},
                )

        # 3. Tier: Global Platform Requests
        allowed, retry_after = _global_limiter.is_allowed(
            f"global_{client_ip}",
            max_requests=settings.global_rate_limit_per_minute,
            window_seconds=60,
        )
        if not allowed:
            return JSONResponse(
                status_code=429,
                content={
                    "detail": f"Rate limit exceeded. Try again in {retry_after} seconds.",
                    "error_code": "RATE_LIMIT_EXCEEDED",
                },
                headers={"Retry-After": str(retry_after)},
            )

        return await call_next(request)
