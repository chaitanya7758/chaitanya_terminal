"""Read-only Zerodha Kite Connect v3 client.

The access token Zerodha issues CAN place orders. This application enforces read-only
behaviour itself: every request goes through `_request`, which only permits the allowlisted
(method, path) pairs below. Order placement/modification/cancellation endpoints are not
implemented and are rejected if anything tries to call them. tests/test_readonly_guard.py
fails the build if order functionality appears anywhere in the source.
"""

from __future__ import annotations

import hashlib
import re
from datetime import datetime, time, timedelta, timezone
from urllib.parse import quote, urlencode
from zoneinfo import ZoneInfo

import httpx

API_ROOT = "https://api.kite.trade"
LOGIN_URL = "https://kite.zerodha.com/connect/login"
IST = ZoneInfo("Asia/Kolkata")

READ_ONLY_ALLOWLIST: tuple[tuple[str, re.Pattern], ...] = tuple(
    (m, re.compile(p))
    for m, p in [
        ("GET", r"^/user/profile$"),
        ("GET", r"^/user/margins(/(equity|commodity))?$"),
        ("GET", r"^/portfolio/positions$"),
        ("GET", r"^/portfolio/holdings$"),
        ("GET", r"^/orders$"),  # order BOOK only (read)
        ("GET", r"^/trades$"),
        ("GET", r"^/quote(/ltp|/ohlc)?$"),
        ("GET", r"^/instruments(/[A-Z]+)?$"),
        ("GET", r"^/instruments/historical/\d+/[a-z0-9]+$"),
        ("POST", r"^/session/token$"),  # login token exchange
        ("DELETE", r"^/session/token$"),  # logout / invalidate token
    ]
)


class ReadOnlyViolation(RuntimeError):
    pass


class KiteError(RuntimeError):
    def __init__(self, status: int, error_type: str, message: str):
        super().__init__(f"{status} {error_type}: {message}")
        self.status, self.error_type, self.message = status, error_type, message


def assert_allowed(method: str, path: str) -> None:
    for m, rx in READ_ONLY_ALLOWLIST:
        if m == method.upper() and rx.match(path):
            return
    raise ReadOnlyViolation(f"Blocked by read-only policy: {method} {path}")


def login_url(api_key: str, state: str) -> str:
    # redirect_params are echoed back by Zerodha to our redirect URL (used as a CSRF state).
    return f"{LOGIN_URL}?{urlencode({'v': 3, 'api_key': api_key, 'redirect_params': f'state={state}'})}"


def checksum(api_key: str, request_token: str, api_secret: str) -> str:
    return hashlib.sha256(f"{api_key}{request_token}{api_secret}".encode()).hexdigest()


def token_expiry(login_at: datetime) -> datetime:
    """Kite access tokens are valid until ~6:00 AM IST the next day. Use 05:55 as a safety margin."""
    local = login_at.astimezone(IST)
    day = local.date() if local.time() < time(5, 55) else local.date() + timedelta(days=1)
    return datetime.combine(day, time(5, 55), IST).astimezone(timezone.utc)


def mask_user_id(user_id: str) -> str:
    return (user_id[:2] + "*" * max(0, len(user_id) - 2)) if user_id else ""


class KiteClient:
    def __init__(self, api_key: str, access_token: str | None = None, http: httpx.Client | None = None):
        self.api_key = api_key
        self.access_token = access_token
        self.http = http or httpx.Client(base_url=API_ROOT, timeout=10.0)

    def _request(self, method: str, path: str, params=None, data=None, raw: bool = False):
        assert_allowed(method, path)
        headers = {"X-Kite-Version": "3"}
        if self.access_token:
            headers["Authorization"] = f"token {self.api_key}:{self.access_token}"
        r = self.http.request(method, path, params=params, data=data, headers=headers)
        if raw and r.status_code == 200:
            return r.text
        try:
            body = r.json()
        except ValueError:
            raise KiteError(r.status_code, "BadResponse", r.text[:200])
        if r.status_code != 200 or body.get("status") != "success":
            raise KiteError(r.status_code, body.get("error_type", "Error"), body.get("message", ""))
        return body["data"]

    # ---- session ----
    def generate_session(self, request_token: str, api_secret: str) -> dict:
        return self._request(
            "POST", "/session/token",
            data={"api_key": self.api_key, "request_token": request_token,
                  "checksum": checksum(self.api_key, request_token, api_secret)},
        )

    def invalidate(self) -> None:
        self._request("DELETE", "/session/token", params={"api_key": self.api_key, "access_token": self.access_token})

    # ---- read-only data ----
    def profile(self): return self._request("GET", "/user/profile")
    def margins(self): return self._request("GET", "/user/margins")
    def positions(self): return self._request("GET", "/portfolio/positions")
    def holdings(self): return self._request("GET", "/portfolio/holdings")
    def order_book(self): return self._request("GET", "/orders")
    def trades(self): return self._request("GET", "/trades")
    def quote(self, instruments: list[str]): return self._request("GET", "/quote", params=[("i", i) for i in instruments])
    def ltp(self, instruments: list[str]): return self._request("GET", "/quote/ltp", params=[("i", i) for i in instruments])
    def instruments_csv(self, exchange: str): return self._request("GET", f"/instruments/{quote(exchange)}", raw=True)

    def historical(self, token: int, interval: str, start: datetime, end: datetime, oi: bool = False):
        return self._request(
            "GET", f"/instruments/historical/{int(token)}/{interval}",
            params={"from": start.strftime("%Y-%m-%d %H:%M:%S"), "to": end.strftime("%Y-%m-%d %H:%M:%S"), "oi": int(oi)},
        )
