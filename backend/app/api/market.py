from datetime import date, datetime, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query

from app.api.kite import client
from app.engines import contracts as C
from app.engines import option_chain as OC
from app.engines.market_status import IST, classify
from app.integrations import kite

router = APIRouter(prefix="/api/market", tags=["market"])

PULSE_KEYS = {"NIFTY 50": "NSE:NIFTY 50", "SENSEX": "BSE:SENSEX", "BANK NIFTY": "NSE:NIFTY BANK", "India VIX": "NSE:INDIA VIX"}

_instrument_cache: dict[tuple[str, date], list[C.Instrument]] = {}


def _now() -> datetime:
    return datetime.now(timezone.utc)


def instruments(c: kite.KiteClient, exchange: str) -> list[C.Instrument]:
    today = _now().astimezone(IST).date()
    key = (exchange, today)
    if key not in _instrument_cache:
        _instrument_cache.clear() if len(_instrument_cache) > 8 else None
        _instrument_cache[key] = C.parse_instruments(c.instruments_csv(exchange))
    return _instrument_cache[key]


def _ts(q: dict) -> datetime | None:
    raw = q.get("timestamp") or q.get("last_trade_time")
    if not raw:
        return None
    try:
        return datetime.fromisoformat(str(raw)).replace(tzinfo=IST)
    except ValueError:
        return None


def _value(name: str, q: dict | None, now: datetime) -> dict:
    if not q:
        return {"name": name, "status": "Unavailable", "reason": "No quote returned", "source": "Zerodha Kite"}
    ts = _ts(q)
    last = q.get("last_price")
    prev = (q.get("ohlc") or {}).get("close")
    chg = None if last is None or not prev else round(last - prev, 2)
    pct = None if chg is None else round(chg / prev * 100, 2)
    return {"name": name, "value": last, "change": chg, "change_pct": pct, "prev_close": prev,
            "market_time": ts.isoformat() if ts else None, "status": classify(ts, now), "source": "Zerodha Kite"}


def _err(e: kite.KiteError):
    return HTTPException(409 if e.error_type == "TokenException" else 502, f"Zerodha error: {e.error_type}: {e.message}")


@router.get("/pulse")
def pulse(c: kite.KiteClient = Depends(client)):
    now = _now()
    try:
        data = c.quote(list(PULSE_KEYS.values()))
    except kite.KiteError as e:
        raise _err(e)
    return {"fetched_at": now.isoformat(), "items": [_value(n, data.get(k), now) for n, k in PULSE_KEYS.items()]}


@router.get("/contracts/{underlying}")
def contracts(underlying: str, c: kite.KiteClient = Depends(client)):
    u = underlying.upper()
    if u not in C.UNDERLYINGS:
        raise HTTPException(404, "Unknown underlying")
    now = _now()
    try:
        ins = instruments(c, C.UNDERLYINGS[u]["exchange"])
    except kite.KiteError as e:
        raise _err(e)
    spec = C.contract_spec(ins, u, now)
    if not spec:
        raise HTTPException(404, f"No live {u} option contracts found in Zerodha's instrument file")
    exps = C.live_expiries(ins, u, now)
    kinds = C.classify_expiries(exps)
    return {**spec.summary(now), "upcoming_expiries": [{"date": e.isoformat(), "weekday": e.strftime("%A"), "kind": kinds[e]} for e in exps[:8]]}


@router.get("/chain/{underlying}")
def chain(underlying: str, expiry: date | None = None, width: int = Query(10, ge=2, le=40), c: kite.KiteClient = Depends(client)):
    u = underlying.upper()
    if u not in C.UNDERLYINGS:
        raise HTTPException(404, "Unknown underlying")
    now = _now()
    try:
        spec = C.contract_spec(instruments(c, C.UNDERLYINGS[u]["exchange"]), u, now, expiry)
        if not spec:
            raise HTTPException(404, f"No live {u} option contracts")
        keys = [C.UNDERLYINGS[u]["spot"]] + ([spec.future.key] if spec.future else [])
        base = c.quote(keys)
        spot_q = base.get(C.UNDERLYINGS[u]["spot"])
        if not spot_q or spot_q.get("last_price") is None:
            raise HTTPException(502, "Spot quote unavailable")
        spot = Decimal(str(spot_q["last_price"]))
        atm = C.atm_strike(spec.strikes, spot)
        i = spec.strikes.index(atm)
        window = spec.strikes[max(0, i - width): i + width + 1]
        legs = {(o.strike, o.instrument_type): o for o in spec.options if o.strike in window}
        q = c.quote([o.key for o in legs.values()])  # ≤ 2*(2*40+1) = 162 instruments, within the 500 limit
    except kite.KiteError as e:
        raise _err(e)

    def leg(k, t):
        o = legs.get((k, t))
        d = q.get(o.key) if o else None
        if not d:
            return OC.Leg()
        depth = d.get("depth") or {}
        bid = (depth.get("buy") or [{}])[0].get("price")
        ask = (depth.get("sell") or [{}])[0].get("price")
        prev = (d.get("ohlc") or {}).get("close")
        return OC.Leg(ltp=Decimal(str(d["last_price"])) if d.get("last_price") is not None else None,
                      oi=d.get("oi"), volume=d.get("volume"),
                      bid=Decimal(str(bid)) if bid else None, ask=Decimal(str(ask)) if ask else None,
                      prev_close=Decimal(str(prev)) if prev else None)

    rows = [OC.Row(k, leg(k, "CE"), leg(k, "PE")) for k in window]
    fut_q = base.get(spec.future.key) if spec.future else None

    def ser(l: OC.Leg):
        return {"ltp": None if l.ltp is None else str(l.ltp), "oi": l.oi, "volume": l.volume,
                "bid": None if l.bid is None else str(l.bid), "ask": None if l.ask is None else str(l.ask),
                "spread_pct": None if (s := OC.spread_pct(l)) is None else str(s),
                "oi_change": None, "positioning": OC.positioning(l)}

    return {
        "underlying": u, "fetched_at": now.isoformat(), "source": "Zerodha Kite",
        "spot": _value(u, spot_q, now),
        "future": _value(spec.future.tradingsymbol, fut_q, now) if spec.future else None,
        "contract": spec.summary(now), "atm_strike": str(atm),
        "pcr": None if (p := OC.pcr(rows)) is None else str(p),
        "pcr_scope": f"ATM ±{width} strikes",
        "max_pain": None if (m := OC.max_pain(rows)) is None else str(m),
        "max_pain_note": "Computed over the displayed strikes only. Not a forecast of settlement.",
        "oi_concentrations": OC.oi_concentrations(rows),
        "oi_change_note": "Change in OI needs the previous-day snapshot stored by this app; unavailable until the first snapshot exists.",
        "rows": [{"strike": str(r.strike), "ce": ser(r.ce), "pe": ser(r.pe)} for r in rows],
    }
