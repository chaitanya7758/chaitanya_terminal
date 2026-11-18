from datetime import date

from app.api import brief as brief_api
from app.engines import brief as B
from tests.conftest import login

H = {"X-CT-Request": "1"}


def test_weekend_detection():
    s = B.session_info(date(2030, 1, 5))  # Saturday
    assert not s["trading_day"] and s["next_session"] == "2030-01-07"


def test_missing_points_are_unavailable():
    b = B.assemble(date(2030, 1, 2), {}, {})
    assert len(b["points"]) == 10 and all(p["status"] == "Unavailable" for p in b["points"])
    t = B.to_text(b)
    assert t.startswith("CHAITANYA'S TERMINAL | 10-Point Market Brief") and "4. GIFT NIFTY: UNAVAILABLE" in t


def test_api_requires_source_and_shows_manual(client, monkeypatch):
    monkeypatch.setattr(brief_api, "fetch_usdinr", lambda: None)
    monkeypatch.setattr(brief_api, "today_ist", lambda: date(2030, 1, 2))
    login(client)
    r = client.post("/api/brief/item", json={"day": "2030-01-02", "slot": 4, "text": "GIFT NIFTY up 40"}, headers=H)
    assert r.status_code == 422
    r = client.post("/api/brief/item", json={"day": "2030-01-02", "slot": 4, "text": "GIFT NIFTY up 40", "source_name": "NSE IX",
                                              "source_url": "http://x"}, headers=H)
    assert r.status_code == 422  # https only
    r = client.post("/api/brief/item", json={"day": "2030-01-02", "slot": 4, "text": "GIFT NIFTY up 40", "source_name": "NSE IX",
                                              "source_url": "https://www.nseix.com/", "as_of": "07:45 IST"}, headers=H)
    assert r.status_code == 200
    b = client.get("/api/brief").json()
    p4 = b["points"][3]
    assert p4["status"] == "Manual" and p4["source_name"] == "NSE IX"
    assert b["points"][0]["status"] == "Unavailable"
    assert "[Manual; NSE IX, 07:45 IST]" in b["text"]
