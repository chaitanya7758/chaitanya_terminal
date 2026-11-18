from datetime import date, datetime
from decimal import Decimal
from zoneinfo import ZoneInfo

from app.engines import contracts as c

IST = ZoneInfo("Asia/Kolkata")
HEADER = "instrument_token,exchange_token,tradingsymbol,name,last_price,expiry,strike,tick_size,lot_size,instrument_type,segment,exchange\n"


def row(tok, sym, name, exp, strike, lot, typ, seg, exch, tick="0.05"):
    return f'{tok},1,{sym},"{name}",0,{exp},{strike},{tick},{lot},{typ},{seg},{exch}\n'


# Synthetic file: dates are arbitrary test fixtures, not real contract data.
CSV = HEADER + "".join([
    row(1, "NIFTYA23000CE", "NIFTY", "2030-01-08", 23000, 65, "CE", "NFO-OPT", "NFO"),
    row(2, "NIFTYA23000PE", "NIFTY", "2030-01-08", 23000, 65, "PE", "NFO-OPT", "NFO"),
    row(3, "NIFTYA23050CE", "NIFTY", "2030-01-08", 23050, 65, "CE", "NFO-OPT", "NFO"),
    row(4, "NIFTYA23100CE", "NIFTY", "2030-01-08", 23100, 65, "CE", "NFO-OPT", "NFO"),
    row(5, "NIFTYA23200CE", "NIFTY", "2030-01-08", 23200, 65, "CE", "NFO-OPT", "NFO"),
    row(6, "NIFTYB23000CE", "NIFTY", "2030-01-29", 23000, 65, "CE", "NFO-OPT", "NFO"),
    row(7, "NIFTYOLD", "NIFTY", "2029-12-31", 23000, 75, "CE", "NFO-OPT", "NFO"),
    row(8, "NIFTYFUT", "NIFTY", "2030-01-29", 0, 65, "FUT", "NFO-FUT", "NFO"),
    row(9, "SENSEXA80000CE", "SENSEX", "2030-01-10", 80000, 20, "CE", "BFO-OPT", "BFO"),
    row(10, "BAD", "NIFTY", "not-a-date", 1, 1, "CE", "NFO-OPT", "NFO"),
])
INS = c.parse_instruments(CSV)


def test_parse_skips_malformed():
    assert len(INS) == 9


def test_expired_contracts_excluded_and_kinds_derived():
    now = datetime(2030, 1, 2, 10, 0, tzinfo=IST)
    exps = c.live_expiries(INS, "NIFTY", now)
    assert exps == [date(2030, 1, 8), date(2030, 1, 29)]
    assert c.classify_expiries(exps) == {date(2030, 1, 8): "weekly", date(2030, 1, 29): "monthly"}


def test_expiry_day_cutoff():
    assert c.is_live(date(2030, 1, 8), datetime(2030, 1, 8, 15, 29, tzinfo=IST))
    assert not c.is_live(date(2030, 1, 8), datetime(2030, 1, 8, 15, 30, tzinfo=IST))


def test_contract_spec():
    now = datetime(2030, 1, 2, 10, 0, tzinfo=IST)
    spec = c.contract_spec(INS, "NIFTY", now)
    assert spec.expiry == date(2030, 1, 8) and spec.lot_size == 65
    assert spec.strike_interval == Decimal(50)
    assert spec.future.tradingsymbol == "NIFTYFUT"
    s = spec.summary(now)
    assert s["expiry_weekday"] == "Tuesday" and s["source"] == "Zerodha instrument master"
    assert s["time_to_expiry"]["days"] == 6
    assert c.contract_spec(INS, "SENSEX", now).lot_size == 20


def test_no_live_contracts_returns_none():
    assert c.contract_spec(INS, "BANKNIFTY", datetime(2030, 1, 2, tzinfo=IST)) is None


def test_atm():
    ks = [Decimal(x) for x in (23000, 23050, 23100)]
    assert c.atm_strike(ks, Decimal("23074.9")) == Decimal(23050)
    assert c.atm_strike(ks, Decimal("23075")) == Decimal(23050)  # tie -> lower
    assert c.atm_strike([], Decimal(1)) is None
