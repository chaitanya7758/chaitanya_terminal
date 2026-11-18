import secrets
from datetime import datetime, timezone

from cryptography.fernet import Fernet, InvalidToken
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from sqlalchemy import select

from app import security as sec
from app.config import Settings, get_settings
from app.db import KiteSession, get_sessionmaker
from app.integrations import kite

router = APIRouter(prefix="/api/kite", tags=["zerodha"])
STATE_COOKIE = "ct_kite_state"


def _fernet(settings: Settings) -> Fernet:
    if not settings.token_encryption_key:
        raise HTTPException(503, "Token encryption key is not configured")
    return Fernet(settings.token_encryption_key.encode())


def _configured(settings: Settings) -> None:
    if not settings.kite_api_key or not settings.kite_api_secret:
        raise HTTPException(503, "Zerodha API key/secret are not configured on the server")


def current_session(settings: Settings) -> tuple[KiteSession, str] | None:
    """Newest unexpired, unrevoked session and its decrypted token, or None."""
    now = datetime.now(timezone.utc)
    with get_sessionmaker()() as s:
        row = s.scalars(select(KiteSession).where(KiteSession.revoked == 0).order_by(KiteSession.id.desc())).first()
    if not row:
        return None
    exp = row.expires_at if row.expires_at.tzinfo else row.expires_at.replace(tzinfo=timezone.utc)
    if exp <= now:
        return None
    try:
        return row, _fernet(settings).decrypt(row.access_token_enc.encode()).decode()
    except InvalidToken:
        return None


def client(settings: Settings = Depends(get_settings), _: str = Depends(sec.require_user)) -> kite.KiteClient:
    _configured(settings)
    cur = current_session(settings)
    if not cur:
        raise HTTPException(409, "Zerodha not connected. Log in to Zerodha to start today's session.")
    return kite.KiteClient(settings.kite_api_key, cur[1])


@router.get("/status")
def status(settings: Settings = Depends(get_settings), _: str = Depends(sec.require_user)):
    configured = bool(settings.kite_api_key and settings.kite_api_secret and settings.token_encryption_key)
    cur = current_session(settings) if configured else None
    return {
        "configured": configured,
        "connected": bool(cur),
        "user": cur[0].user_id_masked if cur else None,
        "login_time": cur[0].login_time.isoformat() if cur else None,
        "expires_at": cur[0].expires_at.isoformat() if cur else None,
        "mode": "read-only",
        "checked_at": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/login")
def start_login(settings: Settings = Depends(get_settings), _: str = Depends(sec.require_user)):
    _configured(settings)
    state = secrets.token_urlsafe(24)
    resp = RedirectResponse(kite.login_url(settings.kite_api_key, state), status_code=302)
    resp.set_cookie(STATE_COOKIE, state, max_age=600, httponly=True, secure=settings.secure_cookies, samesite="lax", path="/api/kite")
    return resp


@router.get("/callback")
def callback(request: Request, settings: Settings = Depends(get_settings), _: str = Depends(sec.require_user)):
    """Zerodha redirects here with ?request_token=...&status=success&state=..."""
    _configured(settings)
    q = request.query_params
    expected = request.cookies.get(STATE_COOKIE)
    if not expected or not secrets.compare_digest(expected, q.get("state", "")):
        sec.audit("kite_login_bad_state", ip=sec.client_ip(request))
        raise HTTPException(400, "Login state mismatch. Start the Zerodha login again from the app.")
    if q.get("status") != "success" or not q.get("request_token"):
        raise HTTPException(400, "Zerodha login was not completed")
    try:
        data = kite.KiteClient(settings.kite_api_key).generate_session(q["request_token"], settings.kite_api_secret)
    except kite.KiteError as e:
        sec.audit("kite_login_failed", e.error_type, sec.client_ip(request))
        raise HTTPException(502, f"Zerodha rejected the token exchange: {e.error_type}")
    now = datetime.now(timezone.utc)
    with get_sessionmaker()() as s:
        s.add(KiteSession(
            access_token_enc=_fernet(settings).encrypt(data["access_token"].encode()).decode(),
            user_id_masked=kite.mask_user_id(data.get("user_id", "")),
            login_time=now, expires_at=kite.token_expiry(now),
        ))
        s.commit()
    sec.audit("kite_login_ok", ip=sec.client_ip(request))
    resp = RedirectResponse(f"{settings.public_base_url}/settings?zerodha=connected", status_code=302)
    resp.delete_cookie(STATE_COOKIE, path="/api/kite")
    return resp


@router.post("/disconnect")
def disconnect(request: Request, settings: Settings = Depends(get_settings), _: str = Depends(sec.require_user)):
    cur = current_session(settings)
    if cur:
        try:
            kite.KiteClient(settings.kite_api_key, cur[1]).invalidate()
        except kite.KiteError:
            pass  # still revoke locally
        with get_sessionmaker()() as s:
            row = s.get(KiteSession, cur[0].id)
            row.revoked = 1
            s.commit()
    sec.audit("kite_disconnect", ip=sec.client_ip(request))
    return {"connected": False}
