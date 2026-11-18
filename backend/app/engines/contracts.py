"""Contract specifications derived from Zerodha's instrument master (no hard-coded expiry weekdays).

Zerodha publishes the full instrument list daily (GET /instruments/{exchange}, CSV). Every expiry
date, strike, lot size and tick size shown in the app comes from that file. Nothing here assumes
which weekday an index expires on; the only constants are the underlying names used in the file.
"""

from __future__ import annotations

import csv
import io
from dataclasses import dataclass
from datetime import date, datetime, time
from decimal import Decimal
from zoneinfo import ZoneInfo

IST = ZoneInfo("Asia/Kolkata")

# Underlying names as they appear in the instrument file, and their spot quote keys.
UNDERLYINGS = {
    "NIFTY": {"exchange": "NFO", "name": "NIFTY", "spot": "NSE:NIFTY 50"},
    "SENSEX": {"exchange": "BFO", "name": "SENSEX", "spot": "BSE:SENSEX"},
    "BANKNIFTY": {"exchange": "NFO", "name": "BANKNIFTY", "spot": "NSE:NIFTY BANK"},
}

# Options stop trading at this time on expiry day. Kept configurable; the exchange's official
# settlement price/time is what matters for P&L and is taken from exchange data, not from here.
EXPIRY_CUTOFF = time(15, 30)


@dataclass(frozen=True)
class Instrument:
    instrument_token: int
    tradingsymbol: str
    name: str
    exchange: str
    segment: str
    instrument_type: str  # CE, PE, FUT, EQ...
    expiry: date | None
    strike: Decimal
    lot_size: int
    tick_size: Decimal

    @property
    def key(self) -> str:
        return f"{self.exchange}:{self.tradingsymbol}"


def parse_instruments(csv_text: str) -> list[Instrument]:
    out: list[Instrument] = []
    for row in csv.DictReader(io.StringIO(csv_text)):
        try:
            exp = date.fromisoformat(row["expiry"]) if row.get("expiry") else None
            out.append(Instrument(
                instrument_token=int(row["instrument_token"]),
                tradingsymbol=row["tradingsymbol"],
                name=row.get("name", "").strip('"'),
                exchange=row["exchange"],
                segment=row.get("segment", ""),
                instrument_type=row["instrument_type"],
                expiry=exp,
                strike=Decimal(row.get("strike") or "0"),
                lot_size=int(float(row.get("lot_size") or 0)),
                tick_size=Decimal(row.get("tick_size") or "0"),
            ))
        except (KeyError, ValueError, ArithmeticError):
            continue  # skip malformed rows rather than guess
    return out


def is_live(expiry: date, now: datetime) -> bool:
    """A contract is live until the cutoff time on its expiry date (IST)."""
    local = now.astimezone(IST)
    return expiry > local.date() or (expiry == local.date() and local.time() < EXPIRY_CUTOFF)


def options_for(instruments: list[Instrument], underlying: str) -> list[Instrument]:
    u = UNDERLYINGS[underlying]
    return [i for i in instruments if i.exchange == u["exchange"] and i.name == u["name"] and i.instrument_type in ("CE", "PE") and i.expiry]


def futures_for(instruments: list[Instrument], underlying: str) -> list[Instrument]:
    u = UNDERLYINGS[underlying]
    return [i for i in instruments if i.exchange == u["exchange"] and i.name == u["name"] and i.instrument_type == "FUT" and i.expiry]


def live_expiries(instruments: list[Instrument], underlying: str, now: datetime) -> list[date]:
    return sorted({i.expiry for i in options_for(instruments, underlying) if is_live(i.expiry, now)})


def classify_expiries(expiries: list[date]) -> dict[date, str]:
    """'monthly' = last listed expiry in its calendar month, else 'weekly'. Derived, not assumed."""
    last_in_month: dict[tuple[int, int], date] = {}
    for e in expiries:
        k = (e.year, e.month)
        last_in_month[k] = max(last_in_month.get(k, e), e)
    return {e: "monthly" if last_in_month[(e.year, e.month)] == e else "weekly" for e in expiries}


def strike_interval(strikes: list[Decimal]) -> Decimal | None:
    """Most common gap between consecutive listed strikes (exchanges list wider gaps far OTM)."""
    s = sorted(set(strikes))
    gaps = [b - a for a, b in zip(s, s[1:]) if b > a]
    if not gaps:
        return None
    counts: dict[Decimal, int] = {}
    for g in gaps:
        counts[g] = counts.get(g, 0) + 1
    return max(counts.items(), key=lambda kv: (kv[1], -kv[0]))[0]


def atm_strike(strikes: list[Decimal], spot: Decimal) -> Decimal | None:
    """Listed strike closest to spot; ties go to the lower strike."""
    if not strikes:
        return None
    return min(sorted(set(strikes)), key=lambda k: (abs(k - spot), k))


def time_to_expiry(expiry: date, now: datetime) -> dict:
    end = datetime.combine(expiry, EXPIRY_CUTOFF, IST)
    secs = max(0, int((end - now.astimezone(IST)).total_seconds()))
    return {"expires_at": end.isoformat(), "seconds": secs, "days": secs // 86400,
            "hours": (secs % 86400) // 3600, "minutes": (secs % 3600) // 60}


@dataclass
class ContractSpec:
    underlying: str
    expiry: date
    expiry_kind: str
    lot_size: int | None
    lot_sizes: list[int]
    tick_size: Decimal
    strike_interval: Decimal | None
    strikes: list[Decimal]
    future: Instrument | None
    options: list[Instrument]

    def summary(self, now: datetime) -> dict:
        return {
            "underlying": self.underlying,
            "expiry": self.expiry.isoformat(),
            "expiry_weekday": self.expiry.strftime("%A"),
            "expiry_kind": self.expiry_kind,
            "lot_size": self.lot_size,
            "warnings": [] if self.lot_size is not None else [f"Mixed lot sizes in file: {self.lot_sizes}; verify with the exchange circular"],
            "tick_size": str(self.tick_size),
            "strike_interval": None if self.strike_interval is None else str(self.strike_interval),
            "strike_count": len(self.strikes),
            "future": self.future.key if self.future else None,
            "future_expiry": self.future.expiry.isoformat() if self.future else None,
            "time_to_expiry": time_to_expiry(self.expiry, now),
            "source": "Zerodha instrument master",
        }


def contract_spec(instruments: list[Instrument], underlying: str, now: datetime, expiry: date | None = None) -> ContractSpec | None:
    exps = live_expiries(instruments, underlying, now)
    if not exps:
        return None
    exp = expiry if expiry in exps else exps[0]
    opts = [i for i in options_for(instruments, underlying) if i.expiry == exp]
    lots = {i.lot_size for i in opts}
    ticks = {i.tick_size for i in opts}
    strikes = sorted({i.strike for i in opts})
    futs = sorted((f for f in futures_for(instruments, underlying) if is_live(f.expiry, now)), key=lambda f: f.expiry)
    # "Relevant future": the nearest live future (index futures are monthly).
    return ContractSpec(
        underlying=underlying, expiry=exp, expiry_kind=classify_expiries(exps)[exp],
        lot_size=next(iter(lots)) if len(lots) == 1 else None, lot_sizes=sorted(lots),
        tick_size=ticks.pop() if len(ticks) == 1 else max(ticks),
        strike_interval=strike_interval(strikes), strikes=strikes,
        future=futs[0] if futs else None, options=opts,
    )
