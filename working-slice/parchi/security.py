"""Protections every response and request gets: security headers, a same-origin check for
anything that changes data, and a size limit on uploaded audio."""

from fastapi import HTTPException, Request
from starlette.datastructures import MutableHeaders
from starlette.types import ASGIApp, Message, Receive, Scope, Send

# The built UI is static files from this server. Next.js inlines its start-up scripts and
# React sets inline styles, hence 'unsafe-inline'; everything else must come from here.
CSP = "; ".join([
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    "media-src 'self' data: blob:",       # Parchi's voice arrives as data: URLs; recordings from /api
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
])


class SecurityHeaders:
    """Adds the security headers to every response. Plain ASGI, not BaseHTTPMiddleware, so
    streamed responses (live calls) pass straight through and a listener leaving is noticed."""

    def __init__(self, app: ASGIApp, production: bool) -> None:
        self.app, self.production = app, production

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        async def with_headers(message: Message) -> None:
            if message["type"] == "http.response.start":
                headers = MutableHeaders(scope=message)
                headers["X-Content-Type-Options"] = "nosniff"
                headers["Referrer-Policy"] = "no-referrer"
                headers["X-Frame-Options"] = "DENY"
                headers["Permissions-Policy"] = "microphone=(self), camera=(), geolocation=()"
                headers["Content-Security-Policy"] = CSP
                if scope["path"].startswith("/api/"):
                    headers["Cache-Control"] = "no-store"          # patient data is never cached
                if self.production:
                    headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
            await send(message)

        await self.app(scope, receive, with_headers)


def require_same_origin(request: Request, allowed_origins: list[str]) -> None:
    """Refuses a data-changing request sent from another site's page (cross-site request forgery).
    The session cookie is already SameSite=Strict; this is the second lock."""
    origin = request.headers.get("origin")
    if origin is None:
        return                                    # not sent by a browser page (e.g. tests, curl)
    own = f"{request.url.scheme}://{request.headers.get('host', '')}"
    if origin != own and origin not in allowed_origins:
        raise HTTPException(status_code=403, detail="Request from another site refused.")


async def read_limited(request: Request, max_bytes: int) -> bytes:
    """The request body, refusing anything larger than max_bytes without reading it all."""
    declared = request.headers.get("content-length")
    if declared and declared.isdigit() and int(declared) > max_bytes:
        raise HTTPException(status_code=413, detail=f"Recording too large (over {max_bytes // 1_000_000} MB).")
    body = bytearray()
    async for chunk in request.stream():
        body.extend(chunk)
        if len(body) > max_bytes:
            raise HTTPException(status_code=413, detail=f"Recording too large (over {max_bytes // 1_000_000} MB).")
    return bytes(body)
