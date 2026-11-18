"""Option-chain analytics computed only from supplied quotes. Missing inputs give None, never a guess."""

from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal


@dataclass
class Leg:
    ltp: Decimal | None = None
    oi: int | None = None
    volume: int | None = None
    bid: Decimal | None = None
    ask: Decimal | None = None
    prev_oi: int | None = None  # from our own previous-day snapshot; None on day one
    prev_close: Decimal | None = None


@dataclass
class Row:
    strike: Decimal
    ce: Leg = field(default_factory=Leg)
    pe: Leg = field(default_factory=Leg)


def pcr(rows: list[Row]) -> Decimal | None:
    ce = sum(r.ce.oi or 0 for r in rows)
    pe = sum(r.pe.oi or 0 for r in rows)
    if ce == 0 or any(r.ce.oi is None or r.pe.oi is None for r in rows):
        return None
    return (Decimal(pe) / Decimal(ce)).quantize(Decimal("0.01"))


def max_pain(rows: list[Row]) -> Decimal | None:
    """Strike at which total intrinsic value owed to option holders is lowest. Not a settlement forecast."""
    if not rows or any(r.ce.oi is None or r.pe.oi is None for r in rows):
        return None
    best = None
    for k in sorted(r.strike for r in rows):
        pain = sum(r.ce.oi * max(Decimal(0), k - r.strike) + r.pe.oi * max(Decimal(0), r.strike - k) for r in rows)
        if best is None or pain < best[1]:
            best = (k, pain)
    return best[0]


def oi_concentrations(rows: list[Row], n: int = 3) -> dict:
    ce = sorted((r for r in rows if r.ce.oi), key=lambda r: -r.ce.oi)[:n]
    pe = sorted((r for r in rows if r.pe.oi), key=lambda r: -r.pe.oi)[:n]
    return {"ce": [{"strike": str(r.strike), "oi": r.ce.oi} for r in ce],
            "pe": [{"strike": str(r.strike), "oi": r.pe.oi} for r in pe]}


def positioning(leg: Leg) -> str | None:
    """Conventional OI/price build-up reading. A heuristic interpretation, labelled as such in the UI."""
    if leg.oi is None or leg.prev_oi is None or leg.ltp is None or leg.prev_close is None:
        return None
    d_oi, d_px = leg.oi - leg.prev_oi, leg.ltp - leg.prev_close
    if d_oi > 0 and d_px < 0: return "writing"
    if d_oi > 0 and d_px > 0: return "long build-up"
    if d_oi < 0 and d_px > 0: return "short covering"
    if d_oi < 0 and d_px < 0: return "unwinding"
    return "flat"


def spread_pct(leg: Leg) -> Decimal | None:
    if leg.bid is None or leg.ask is None or leg.bid <= 0 or leg.ask < leg.bid:
        return None
    mid = (leg.bid + leg.ask) / 2
    return ((leg.ask - leg.bid) / mid * 100).quantize(Decimal("0.01"))
