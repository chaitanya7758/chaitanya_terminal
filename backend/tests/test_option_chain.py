from decimal import Decimal as D

from app.engines.option_chain import Leg, Row, max_pain, oi_concentrations, pcr, positioning, spread_pct

ROWS = [
    Row(D(100), Leg(oi=10), Leg(oi=50)),
    Row(D(110), Leg(oi=30), Leg(oi=30)),
    Row(D(120), Leg(oi=60), Leg(oi=5)),
]


def test_pcr():
    assert pcr(ROWS) == D("0.85")  # 85 / 100
    assert pcr([Row(D(1), Leg(oi=None), Leg(oi=1))]) is None


def test_max_pain_hand_calc():
    # K=100: CE 0 ; PE 30*10 + 5*20 = 400 -> 400
    # K=110: CE 10*10 = 100 ; PE 5*10 = 50 -> 150
    # K=120: CE 10*20 + 30*10 = 500 ; PE 0 -> 500
    assert max_pain(ROWS) == D(110)
    assert max_pain([]) is None


def test_concentrations():
    oc = oi_concentrations(ROWS, 1)
    assert oc == {"ce": [{"strike": "120", "oi": 60}], "pe": [{"strike": "100", "oi": 50}]}


def test_positioning():
    assert positioning(Leg(ltp=D(90), prev_close=D(100), oi=200, prev_oi=100)) == "writing"
    assert positioning(Leg(ltp=D(110), prev_close=D(100), oi=50, prev_oi=100)) == "short covering"
    assert positioning(Leg(ltp=D(90), prev_close=D(100), oi=50, prev_oi=100)) == "unwinding"
    assert positioning(Leg(ltp=D(90), oi=50)) is None  # no previous snapshot -> unavailable


def test_spread():
    assert spread_pct(Leg(bid=D("9.5"), ask=D("10.5"))) == D("10.00")
    assert spread_pct(Leg(bid=D(0), ask=D(1))) is None
