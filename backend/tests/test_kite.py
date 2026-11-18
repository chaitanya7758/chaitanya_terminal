from datetime import datetime, timezone
from urllib.parse import parse_qs, urlparse

import httpx
import pytest

from app.integrations import kite
from tests.conftest import login


def test_allowlist_blocks_orders():
    for method, path in [("POST", "/orders/regular"), ("PUT", "/orders/regular/123"), ("DELETE", "/orders/regular/123"),
                         ("POST", "/gtt/triggers"), ("POST", "/mf/orders"), ("GET", "/orders/123/../../x")]:
        with pytest.raises(kite.ReadOnlyViolation):
            kite.assert_allowed(method, path)
    kite.assert_allowed("GET", "/portfolio/positions")
    kite.assert_allowed("GET", "/instruments/historical/256265/5minute")


def test_client_never_sends_blocked_request():
    sent = []
    c = kite.KiteClient("k", "t", http=httpx.Client(base_url=kite.API_ROOT, transport=httpx.MockTransport(lambda r: sent.append(r) or httpx.Response(200, json={}))))
    with pytest.raises(kite.ReadOnlyViolation):
        c._request("POST", "/orders/regular", data={"x": 1})
    assert sent == []


def test_checksum_and_auth_header():
    seen = {}

    def handler(req: httpx.Request):
        seen["auth"] = req.headers.get("authorization")
        seen["ver"] = req.headers.get("x-kite-version")
        return httpx.Response(200, json={"status": "success", "data": {"net": [], "day": []}})

    c = kite.KiteClient("key", "tok", http=httpx.Client(base_url=kite.API_ROOT, transport=httpx.MockTransport(handler)))
    assert c.positions() == {"net": [], "day": []}
    assert seen == {"auth": "token key:tok", "ver": "3"}
    # sha256("abc" + "req" + "sec")
    import hashlib
    assert kite.checksum("abc", "req", "sec") == hashlib.sha256(b"abcreqsec").hexdigest()


def test_kite_error_surfaces():
    c = kite.KiteClient("k", "t", http=httpx.Client(base_url=kite.API_ROOT, transport=httpx.MockTransport(
        lambda r: httpx.Response(403, json={"status": "error", "error_type": "TokenException", "message": "expired"}))))
    with pytest.raises(kite.KiteError) as e:
        c.margins()
    assert e.value.error_type == "TokenException"


@pytest.mark.parametrize("ist_login,expected_utc", [
    ("2026-11-18T09:00:00+05:30", "2026-11-19T00:25:00+00:00"),  # morning login -> next day 05:55 IST
    ("2026-11-18T23:30:00+05:30", "2026-11-19T00:25:00+00:00"),
    ("2026-11-18T05:00:00+05:30", "2026-11-18T00:25:00+00:00"),  # before 05:55 -> same day
])
def test_token_expiry(ist_login, expected_utc):
    assert kite.token_expiry(datetime.fromisoformat(ist_login)).isoformat() == expected_utc


def test_mask():
    assert kite.mask_user_id("AB1234") == "AB****"


def test_status_not_connected(client):
    login(client)
    s = client.get("/api/kite/status").json()
    assert s["configured"] and not s["connected"] and s["mode"] == "read-only"
    assert client.get("/api/kite/portfolio").status_code == 409


def test_full_login_flow(client, monkeypatch):
    login(client)
    r = client.get("/api/kite/login", follow_redirects=False)
    assert r.status_code == 302
    loc = urlparse(r.headers["location"])
    assert loc.netloc == "kite.zerodha.com"
    state = parse_qs(parse_qs(loc.query)["redirect_params"][0])["state"][0]

    def fake_generate(self, request_token, api_secret):
        assert request_token == "rt" and api_secret == "testsecret"
        return {"access_token": "ACCESS-123", "user_id": "AB1234"}

    monkeypatch.setattr(kite.KiteClient, "generate_session", fake_generate)

    bad = client.get("/api/kite/callback", params={"request_token": "rt", "status": "success", "state": "wrong"}, follow_redirects=False)
    assert bad.status_code == 400

    ok = client.get("/api/kite/callback", params={"request_token": "rt", "status": "success", "state": state}, follow_redirects=False)
    assert ok.status_code == 302
    s = client.get("/api/kite/status").json()
    assert s["connected"] and s["user"] == "AB****"

    # token is encrypted at rest
    from app.db import KiteSession, get_sessionmaker
    with get_sessionmaker()() as db:
        row = db.query(KiteSession).first()
    assert "ACCESS-123" not in row.access_token_enc

    monkeypatch.setattr(kite.KiteClient, "invalidate", lambda self: None)
    assert client.post("/api/kite/disconnect", headers={"X-CT-Request": "1"}).json() == {"connected": False}
    assert client.get("/api/kite/status").json()["connected"] is False
