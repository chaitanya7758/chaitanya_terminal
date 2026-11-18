from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import pytest
from fastapi.testclient import TestClient

from app.api import kite as kite_api
from app.api import market
from app.engines.market_status import classify
from app.integrations.kite import KiteError
from tests.conftest import login
from tests.test_contracts import CSV

IST = ZoneInfo("Asia/Kolkata")


def test_classify():
    open_now = datetime(2030, 1, 2, 11, 0, tzinfo=IST)  # Wednesday
    assert classify(open_now - timedelta(seconds=30), open_now) == "Live"
    assert classify(open_now - timedelta(minutes=10), open_now) == "Delayed"
    closed = datetime(2030, 1, 2, 18, 0, tzinfo=IST)
    assert classify(closed - timedelta(hours=2), closed) == "Previous Close"
    sat = datetime(2030, 1, 5, 11, 0, tzinfo=IST)
    assert classify(sat - timedelta(seconds=5), sat) == "Previous Close"
    assert classify(None, open_now) == "Unavailable"


class FakeKite:
    def __init__(self, fail=False):
        self.fail = fail

    def instruments_csv(self, exchange):
        return CSV

    def quote(self, keys):
        if self.fail:
            raise KiteError(403, "TokenException", "expired")
        out = {}
        for k in keys:
            if k == "NSE:NIFTY 50":
                out[k] = {"last_price": 23040.0, "ohlc": {"close": 23000.0}, "timestamp": "2030-01-02 11:00:00"}
            elif k.startswith("NFO:NIFTYA"):
                strike = int(k[10:15])
                ce = k.endswith("CE")
                out[k] = {"last_price": 50.0, "oi": (strike - 22900) * (1 if ce else 0) + (0 if ce else 100), "volume": 10,
                          "ohlc": {"close": 55.0}, "depth": {"buy": [{"price": 49.5}], "sell": [{"price": 50.5}]}}
        return out


@pytest.fixture
def fake(client, monkeypatch):
    from app.main import app
    fk = FakeKite()
    app.dependency_overrides[kite_api.client] = lambda: fk
    monkeypatch.setattr(market, "_instrument_cache", {})
    monkeypatch.setattr(market, "_now", lambda: datetime(2030, 1, 2, 11, 0, 30, tzinfo=IST))
    yield fk
    app.dependency_overrides.clear()


def test_requires_zerodha_connection(client):
    login(client)
    assert client.get("/api/market/pulse").status_code == 409


def test_contracts(client, fake):
    login(client)
    r = client.get("/api/market/contracts/nifty").json()
    assert r["expiry"] == "2030-01-08" and r["lot_size"] == 65 and r["strike_interval"] == "50"
    assert [e["kind"] for e in r["upcoming_expiries"]] == ["weekly", "monthly"]


def test_chain(client, fake):
    login(client)
    r = client.get("/api/market/chain/NIFTY?width=2").json()
    assert r["atm_strike"] == "23050"
    assert r["spot"]["status"] == "Live" and r["spot"]["change"] == 40.0
    assert r["rows"][0]["ce"]["spread_pct"] == "2.00"
    assert r["rows"][0]["ce"]["oi_change"] is None  # no previous snapshot yet: not invented
    assert "Not a forecast" in r["max_pain_note"]


def test_token_expiry_maps_to_409(client, fake):
    fake.fail = True
    login(client)
    assert client.get("/api/market/pulse").status_code == 409
