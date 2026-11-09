"""Security headers middleware implementing OWASP Top 10 web security recommendations."""

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Adds defensive HTTP security headers to all incoming/outgoing responses."""

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        response = await call_next(request)

        # 1. Prevent MIME-sniffing (forces browser to adhere to declared Content-Type)
        response.headers["X-Content-Type-Options"] = "nosniff"

        # 2. Prevent Clickjacking (disallows embedding API or docs inside foreign iframes)
        response.headers["X-Frame-Options"] = "DENY"

        # 3. Enable legacy browser XSS filtering
        response.headers["X-XSS-Protection"] = "1; mode=block"

        # 4. Enforce HTTPS via Strict-Transport-Security (1 year duration)
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload"

        # 5. Prevent referrer leakage on cross-origin requests
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

        # 6. Content Security Policy (restricts resources and disallows framing)
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; frame-ancestors 'none'; object-src 'none';"
        )

        # 7. Permissions Policy: Restricts access to sensitive device hardware APIs
        response.headers["Permissions-Policy"] = (
            "camera=(), microphone=(), geolocation=(), payment=(), usb=()"
        )

        # 8. Remove or obscure server identification to prevent attacker reconnaissance
        if "server" in response.headers:
            del response.headers["server"]

        return response
