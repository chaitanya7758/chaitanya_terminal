import pyotp

from tests.conftest import PASSWORD, TOTP_SECRET, login

H = {"X-CT-Request": "1"}


def test_requires_login(client):
    assert client.get("/api/auth/me").status_code == 401
    assert client.get("/api/kite/status").status_code == 401


def test_login_and_me(client):
    login(client)
    assert client.get("/api/auth/me").json() == {"user": "owner"}


def test_wrong_totp_rejected(client):
    r = client.post("/api/auth/login", json={"password": PASSWORD, "totp": "000000"}, headers=H)
    assert r.status_code == 401


def test_wrong_password_rejected(client):
    r = client.post("/api/auth/login", json={"password": "nope", "totp": pyotp.TOTP(TOTP_SECRET).now()}, headers=H)
    assert r.status_code == 401


def test_csrf_header_required(client):
    r = client.post("/api/auth/login", json={"password": PASSWORD, "totp": pyotp.TOTP(TOTP_SECRET).now()})
    assert r.status_code == 403
    login(client)
    assert client.post("/api/auth/logout").status_code == 403
    assert client.post("/api/auth/logout", headers=H).status_code == 200


def test_rate_limit(client):
    for _ in range(5):
        client.post("/api/auth/login", json={"password": "x", "totp": "123456"}, headers=H)
    r = client.post("/api/auth/login", json={"password": PASSWORD, "totp": pyotp.TOTP(TOTP_SECRET).now()}, headers=H)
    assert r.status_code == 429


def test_fails_closed_when_unconfigured(client, monkeypatch):
    from app.config import get_settings
    monkeypatch.setenv("CT_PASSWORD_HASH", "")
    get_settings.cache_clear()
    r = client.post("/api/auth/login", json={"password": PASSWORD, "totp": pyotp.TOTP(TOTP_SECRET).now()}, headers=H)
    assert r.status_code == 401


def test_security_headers(client):
    r = client.get("/api/health")
    assert r.headers["x-frame-options"] == "DENY"
    assert r.json()["order_execution"] == "disabled"
