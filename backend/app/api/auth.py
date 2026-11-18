from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field

from app.config import Settings, get_settings
from app import security as sec

router = APIRouter(prefix="/api/auth", tags=["auth"])


class LoginRequest(BaseModel):
    password: str = Field(min_length=1, max_length=256)
    totp: str = Field(pattern=r"^\d{6}$")


@router.post("/login")
def login(body: LoginRequest, request: Request, response: Response, settings: Settings = Depends(get_settings)):
    ip = sec.client_ip(request)
    if request.headers.get(sec.CSRF_HEADER) != "1":
        raise HTTPException(403, "Missing CSRF header")
    if sec.rate_limited(ip):
        sec.audit("login_rate_limited", ip=ip)
        raise HTTPException(429, "Too many attempts. Try again in 15 minutes.")
    if not sec.verify_credentials(settings, body.password, body.totp):
        sec.record_failure(ip)
        sec.audit("login_failed", ip=ip)
        raise HTTPException(401, "Invalid password or code")
    response.set_cookie(
        sec.SESSION_COOKIE, sec.issue_session(settings), max_age=settings.session_hours * 3600,
        httponly=True, secure=settings.secure_cookies, samesite="lax", path="/",
    )
    sec.audit("login_ok", ip=ip)
    return {"ok": True}


@router.post("/logout")
def logout(request: Request, response: Response, _: str = Depends(sec.require_user)):
    response.delete_cookie(sec.SESSION_COOKIE, path="/")
    sec.audit("logout", ip=sec.client_ip(request))
    return {"ok": True}


@router.get("/me")
def me(_: str = Depends(sec.require_user)):
    return {"user": "owner"}
