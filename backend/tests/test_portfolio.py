from decimal import Decimal

from app.engines.portfolio import parse_symbol, summarise

POS = {"net": [
    # short 23500 CE, 2 lots of 65; Zerodha unrealised = (80-100)*-130 = 2600
    {"tradingsymbol": "NIFTY30JAN23500CE", "exchange": "NFO", "instrument_token": 11, "product": "NRML", "quantity": -130,
     "multiplier": 1, "average_price": 100, "last_price": 80, "pnl": 2600, "realised": 0, "unrealised": 2600},
    # long 23700 CE hedge, 1 lot
    {"tradingsymbol": "NIFTY30JAN23700CE", "exchange": "NFO", "instrument_token": 12, "product": "NRML", "quantity": 65,
     "multiplier": 1, "average_price": 40, "last_price": 30, "pnl": -650, "realised": 0, "unrealised": -650},
    # closed intraday: realised only
    {"tradingsymbol": "NIFTY30JAN23000PE", "exchange": "NFO", "instrument_token": 13, "product": "MIS", "quantity": 0,
     "multiplier": 1, "average_price": 0, "last_price": 50, "pnl": 500, "realised": 500, "unrealised": 0},
    # deliberately inconsistent figure to exercise reconciliation
    {"tradingsymbol": "NIFTY30JAN23000PE", "exchange": "NFO", "instrument_token": 14, "product": "NRML", "quantity": -65,
     "multiplier": 1, "average_price": 50, "last_price": 60, "pnl": -600, "realised": 0, "unrealised": -600},
]}
MARGINS = {"equity": {"net": 300000, "utilised": {"debits": 200000, "span": 150000, "exposure": 40000, "option_premium": 0}}}


def test_summary():
    s = summarise(POS, MARGINS, {11: "2030-01-30", 12: "2030-01-30", 14: "2030-01-30"})
    assert s["totals"] == {"pnl": "1850.00", "realised": "500.00", "unrealised": "1350.00"}  # Zerodha's figures summed
    assert s["open_count"] == 3
    assert s["margins"]["utilisation_pct"] == "40.0"  # 200k / (300k + 200k)
    ce = next(h for h in s["hedge_coverage"] if h["side"] == "CE")
    assert ce["coverage_pct"] == "50" and ce["short_qty"] == 130 and ce["long_qty"] == 65
    pe = next(h for h in s["hedge_coverage"] if h["side"] == "PE")
    assert pe["coverage_pct"] == "0"
    assert s["expiry_concentration"] == [{"expiry": "2030-01-30", "abs_quantity": "260"}]


def test_reconciliation_flags_mismatch_not_overwrite():
    s = summarise(POS, MARGINS)
    assert not s["reconciliation"]["ok"]
    m = s["reconciliation"]["mismatches"]
    assert m == [{"symbol": "NIFTY30JAN23000PE", "zerodha_unrealised": "-600", "recomputed": "-650.00"}]
    row = next(r for r in s["positions"] if r["quantity"] == -65)
    assert row["unrealised"] == "-600"  # Zerodha's number is still what we display


def test_empty_portfolio():
    s = summarise({"net": []}, {})
    assert s["open_count"] == 0 and s["margins"]["utilisation_pct"] is None and s["reconciliation"]["ok"]


def test_parse_symbol():
    assert parse_symbol("NIFTY25NOV23500CE") == {"underlying": "NIFTY", "type": "CE", "strike": Decimal("23500")}
    assert parse_symbol("NIFTY25N1823500PE")["strike"] == Decimal("23500")
    assert parse_symbol("SENSEX25NOVFUT")["type"] == "FUT"
    assert parse_symbol("INFY")["type"] is None
