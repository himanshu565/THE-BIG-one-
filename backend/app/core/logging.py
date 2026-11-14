"""Structured JSON logging with request correlation IDs (X-Request-ID)."""

import json
import logging
import sys
import time
import uuid
from typing import Any

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response

logger = logging.getLogger("vectorly")


class JSONLogFormatter(logging.Formatter):
    """Formats log records as structured single-line JSON entries."""

    def format(self, record: logging.LogRecord) -> str:
        log_entry: dict[str, Any] = {
            "timestamp": self.formatTime(record, "%Y-%m-%dT%H:%M:%S%z"),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }

        # Optional correlation fields
        for field in ("request_id", "method", "path", "http_status", "duration_ms", "client_ip"):
            if hasattr(record, field):
                log_entry[field] = getattr(record, field)

        if record.exc_info:
            log_entry["exception"] = self.formatException(record.exc_info)

        return json.dumps(log_entry, default=str)


class RequestCorrelationMiddleware(BaseHTTPMiddleware):
    """Injects and propagates X-Request-ID header and logs structured request metrics."""

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        # 1. Resolve or generate correlation request ID
        request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
        request.state.request_id = request_id

        start_time = time.perf_counter()
        try:
            response = await call_next(request)
        except Exception as exc:
            duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
            logger.error(
                f"Unhandled exception during {request.method} {request.url.path}: {exc}",
                extra={
                    "request_id": request_id,
                    "method": request.method,
                    "path": request.url.path,
                    "http_status": 500,
                    "duration_ms": duration_ms,
                },
                exc_info=True,
            )
            raise exc

        duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
        response.headers["X-Request-ID"] = request_id

        # Log structured request completion metrics
        logger.info(
            f"{request.method} {request.url.path} -> {response.status_code} ({duration_ms}ms)",
            extra={
                "request_id": request_id,
                "method": request.method,
                "path": request.url.path,
                "http_status": response.status_code,
                "duration_ms": duration_ms,
            },
        )
        return response


def configure_logging(level: int = logging.INFO) -> None:
    """Configure handler with JSONLogFormatter on the vectorly logger."""
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JSONLogFormatter())
    logger.setLevel(level)
    # Remove old handlers to prevent duplicates
    logger.handlers.clear()
    logger.addHandler(handler)
    logger.propagate = False
