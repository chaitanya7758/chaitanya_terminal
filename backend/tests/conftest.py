import pyotp
import pytest
from argon2 import PasswordHasher
from cryptography.fernet import Fernet
from fastapi.testclient import TestClient

from app import db, security
from app.config import get_settings

PASSWORD = "correct horse battery staple"
TOTP_SECRET = "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP"  # test-only


@pytest.fixture
def settings_env(monkeypatch, tmp_path):
    monkeypatch.setenv("CT_DATABASE_URL", f"sqlite:///{tmp_path}/t.db")
    monkeypatch.setenv("CT_PASSWORD_HASH", PasswordHasher().hash(PASSWORD))
    monkeypatch.setenv("CT_TOTP_SECRET", TOTP_SECRET)
    monkeypatch.setenv("CT_SESSION_SECRET", "s" * 64)
    monkeypatch.setenv("CT_KITE_API_KEY", "testkey")
    monkeypatch.setenv("CT_KITE_API_SECRET", "testsecret")
    monkeypatch.setenv("CT_TOKEN_ENCRYPTION_KEY", Fernet.generate_key().decode())
    get_settings.cache_clear()
    db.reset_engine()
    security.reset_rate_limits()
    yield
    get_settings.cache_clear()
    db.reset_engine()


@pytest.fixture
def client(settings_env):
    from app.main import app
    return TestClient(app)


def login(c: TestClient):
    r = c.post("/api/auth/login", json={"password": PASSWORD, "totp": pyotp.TOTP(TOTP_SECRET).now()}, headers={"X-CT-Request": "1"})
    assert r.status_code == 200, r.text
    return c
