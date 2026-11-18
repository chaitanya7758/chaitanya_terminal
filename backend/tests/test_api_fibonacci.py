from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_levels_endpoint():
    r = client.post("/api/fibonacci/levels", json={"high": "24774.30", "low": "22179.90", "direction": "up", "spot": "23500", "strike_interval": 50})
    assert r.status_code == 200
    body = r.json()
    l618 = next(l for l in body["levels"] if l["label"] == "61.8%")
    assert l618["price"] == "23783.24" and l618["nearby_strikes"] == ["23750.00", "23800.00"]


def test_levels_rejects_inverted():
    r = client.post("/api/fibonacci/levels", json={"high": 100, "low": 200, "direction": "up"})
    assert r.status_code == 422


def test_presets():
    assert client.get("/api/fibonacci/presets").json()[0]["range"] == "2594.40"
