"""Private single-user authentication: Argon2 password + TOTP, signed session cookie, CSRF header check."""

import time
from collections import defaultdict, deque
from datetime import datetime, timezone

import pyotp
from argon2 import PasswordHasher
from argon2.exceptions import VerificationError, InvalidHashError
from fastapi import Depends, HTTPException, Request
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer

from app.config import Settings, get_settings
from app.db import AuditLog, get_sessionmaker

SESSION_COOKIE = "ct_session"
CSRF_HEADER = "x-ct-request"

_ph = PasswordHasher()
_attempts: dict[str, deque] = defaultdict(deque)
MAX_ATTEMPTS, WINDOW_S = 5, 15 * 60


def audit(event: str, detail: str = "", ip: str = "") -> None:
    S = get_sessionmaker()
    with S() as s:
        s.add(AuditLog(at=datetime.now(timezone.utc), event=event, detail=detail[:2000], ip=ip[:64]))
        s.commit()


def client_ip(request: Request) -> str:
    # Behind Caddy on the same host; X-Forwarded-For is set by the proxy we control.
    return (request.headers.get("x-forwarded-for", "").split(",")[0].strip()) or (request.client.host if request.client else "")


def rate_limited(ip: str) -> bool:
    q = _attempts[ip]
    now = time.monotonic()
    while q and now - q[0] > WINDOW_S:
        q.popleft()
    return len(q) >= MAX_ATTEMPTS


def record_failure(ip: str) -> None:
    _attempts[ip].append(time.monotonic())


def reset_rate_limits() -> None:
    _attempts.clear()


def verify_credentials(settings: Settings, password: str, totp: str) -> bool:
    if not settings.password_hash or not settings.totp_secret:
        return False  # fail closed when not configured
    try:
        _ph.verify(settings.password_hash, password)
    except (VerificationError, InvalidHashError):
        return False
    return pyotp.TOTP(settings.totp_secret).verify(totp, valid_window=1)


def _serializer(settings: Settings) -> URLSafeTimedSerializer:
    if len(settings.session_secret) < 32:
        raise HTTPException(503, "Server session secret is not configured")
    return URLSafeTimedSerializer(settings.session_secret, salt="ct-session")


def issue_session(settings: Settings) -> str:
    return _serializer(settings).dumps({"u": "owner", "iat": int(time.time())})


def require_user(request: Request, settings: Settings = Depends(get_settings)) -> str:
    token = request.cookies.get(SESSION_COOKIE)
    if not token:
        raise HTTPException(401, "Not signed in")
    try:
        _serializer(settings).loads(token, max_age=settings.session_hours * 3600)
    except (BadSignature, SignatureExpired):
        raise HTTPException(401, "Session expired")
    if request.method not in ("GET", "HEAD", "OPTIONS") and request.headers.get(CSRF_HEADER) != "1":
        raise HTTPException(403, "Missing CSRF header")
    return "owner"
