"""Fibonacci retracement / extension engine.

Pure functions, no I/O. All arithmetic uses Decimal so that published levels are
exact to the paisa (2 dp) and reproducible across the Python and TypeScript
implementations (both are checked against shared/test-vectors/fibonacci.json).

Conventions (see docs/FORMULAS.md):

Retracements, "spec" convention (default, as written in the product spec):
    Upward swing   (low formed first, then high):  level = Low  + (High - Low) * r
    Downward swing (high formed first, then low):  level = High - (High - Low) * r

Retracements, "pullback" convention (common charting convention, optional):
    Measures the pullback depth from the swing END.
    Upward swing:   level = High - (High - Low) * r
    Downward swing: level = Low  + (High - Low) * r
    In this convention 61.8% is a deep retracement towards the swing start.

Two-point extensions project beyond the swing end in the swing's direction:
    Upward swing:   level = Low  + (High - Low) * e      (e = 1.272, 1.618, 2.0, 2.618)
    Downward swing: level = High - (High - Low) * e

Three-point projection (A -> B swing, C = retracement point):
    level = C + (B - A) * e      (signed, so it works for both directions)
"""

from __future__ import annotations

from dataclasses import dataclass, field
from decimal import ROUND_HALF_UP, Decimal
from enum import Enum
from typing import Literal

RETRACEMENT_RATIOS: tuple[Decimal, ...] = tuple(
    Decimal(x) for x in ("0", "0.236", "0.382", "0.5", "0.618", "0.786", "1")
)
EXTENSION_RATIOS: tuple[Decimal, ...] = tuple(
    Decimal(x) for x in ("1.272", "1.618", "2", "2.618")
)
PROJECTION_RATIOS: tuple[Decimal, ...] = tuple(
    Decimal(x) for x in ("0.618", "1", "1.272", "1.618", "2", "2.618")
)

TWO_DP = Decimal("0.01")


class SwingDirection(str, Enum):
    UP = "up"  # low first, then high
    DOWN = "down"  # high first, then low


Convention = Literal["spec", "pullback"]


class FibonacciInputError(ValueError):
    pass


def _q(x: Decimal) -> Decimal:
    return x.quantize(TWO_DP, rounding=ROUND_HALF_UP)


def _pct_label(r: Decimal) -> str:
    s = format((r * 100).normalize(), "f")
    return f"{s}%"


def _d(x: float | int | str | Decimal, name: str) -> Decimal:
    try:
        d = Decimal(str(x))
    except Exception as exc:  # noqa: BLE001
        raise FibonacciInputError(f"{name} is not a number") from exc
    if not d.is_finite():
        raise FibonacciInputError(f"{name} must be finite")
    return d


@dataclass(frozen=True)
class Level:
    kind: Literal["retracement", "extension", "projection"]
    ratio: Decimal
    label: str
    price: Decimal
    distance_points: Decimal | None = None
    distance_pct: Decimal | None = None

    def to_dict(self) -> dict:
        return {
            "kind": self.kind,
            "ratio": str(self.ratio),
            "label": self.label,
            "price": str(self.price),
            "distance_points": None if self.distance_points is None else str(self.distance_points),
            "distance_pct": None if self.distance_pct is None else str(self.distance_pct),
        }


@dataclass(frozen=True)
class FibonacciResult:
    high: Decimal
    low: Decimal
    range: Decimal
    direction: SwingDirection
    convention: Convention
    spot: Decimal | None
    levels: list[Level] = field(default_factory=list)
    nearest_support: Level | None = None
    nearest_resistance: Level | None = None
    formula_notes: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "high": str(self.high),
            "low": str(self.low),
            "range": str(self.range),
            "direction": self.direction.value,
            "convention": self.convention,
            "spot": None if self.spot is None else str(self.spot),
            "levels": [lv.to_dict() for lv in self.levels],
            "nearest_support": self.nearest_support.to_dict() if self.nearest_support else None,
            "nearest_resistance": self.nearest_resistance.to_dict() if self.nearest_resistance else None,
            "formula_notes": self.formula_notes,
        }


def _with_distance(level: Level, spot: Decimal | None) -> Level:
    if spot is None:
        return level
    pts = _q(level.price - spot)
    pct = _q((level.price - spot) / spot * 100)
    return Level(level.kind, level.ratio, level.label, level.price, pts, pct)


def compute(
    high: float | str | Decimal,
    low: float | str | Decimal,
    direction: SwingDirection | str,
    spot: float | str | Decimal | None = None,
    convention: Convention = "spec",
) -> FibonacciResult:
    """Compute retracement and two-point extension levels for one swing."""
    h = _d(high, "high")
    lo = _d(low, "low")
    if h <= 0 or lo <= 0:
        raise FibonacciInputError("high and low must be positive")
    if h <= lo:
        raise FibonacciInputError("high must be greater than low")
    s = None
    if spot is not None:
        s = _d(spot, "spot")
        if s <= 0:
            raise FibonacciInputError("spot must be positive")
    dirn = SwingDirection(direction)
    if convention not in ("spec", "pullback"):
        raise FibonacciInputError("convention must be 'spec' or 'pullback'")
    rng = h - lo

    # Base point the ratios are measured from, and sign of travel.
    up = dirn is SwingDirection.UP
    if convention == "spec":
        r_base, r_sign = (lo, 1) if up else (h, -1)
    else:  # pullback depth from the swing end
        r_base, r_sign = (h, -1) if up else (lo, 1)
    e_base, e_sign = (lo, 1) if up else (h, -1)

    levels: list[Level] = []
    for r in RETRACEMENT_RATIOS:
        levels.append(
            _with_distance(
                Level("retracement", r, _pct_label(r), _q(r_base + r_sign * rng * r)), s
            )
        )
    for e in EXTENSION_RATIOS:
        levels.append(
            _with_distance(
                Level("extension", e, _pct_label(e), _q(e_base + e_sign * rng * e)), s
            )
        )

    support = resistance = None
    if s is not None:
        below = [lv for lv in levels if lv.price < s]
        above = [lv for lv in levels if lv.price > s]
        support = max(below, key=lambda lv: lv.price) if below else None
        resistance = min(above, key=lambda lv: lv.price) if above else None

    notes = [
        f"Swing direction: {'UP (low then high)' if up else 'DOWN (high then low)'}",
        f"Range = High - Low = {_q(h)} - {_q(lo)} = {_q(rng)}",
    ]
    if convention == "spec":
        notes.append(
            "Retracement = Low + Range x ratio" if up else "Retracement = High - Range x ratio"
        )
    else:
        notes.append(
            "Retracement (pullback) = High - Range x ratio"
            if up
            else "Retracement (pullback) = Low + Range x ratio"
        )
    notes.append("Extension = Low + Range x ratio" if up else "Extension = High - Range x ratio")

    return FibonacciResult(
        high=_q(h),
        low=_q(lo),
        range=_q(rng),
        direction=dirn,
        convention=convention,
        spot=None if s is None else _q(s),
        levels=levels,
        nearest_support=support,
        nearest_resistance=resistance,
        formula_notes=notes,
    )


def project_three_point(
    a: float | str | Decimal,
    b: float | str | Decimal,
    c: float | str | Decimal,
    spot: float | str | Decimal | None = None,
) -> list[Level]:
    """Three-point (A-B-C) projection: level = C + (B - A) * ratio."""
    pa, pb, pc = _d(a, "A"), _d(b, "B"), _d(c, "C")
    if min(pa, pb, pc) <= 0:
        raise FibonacciInputError("A, B and C must be positive")
    if pa == pb:
        raise FibonacciInputError("A and B must differ")
    # C must retrace part of A->B, i.e. lie strictly between A and B inclusive of A.
    lo, hi = min(pa, pb), max(pa, pb)
    if not (lo <= pc <= hi) or pc == pb:
        raise FibonacciInputError("C must lie between A and B (a retracement of the A-B move)")
    s = None if spot is None else _d(spot, "spot")
    move = pb - pa
    return [
        _with_distance(Level("projection", r, _pct_label(r), _q(pc + move * r)), s)
        for r in PROJECTION_RATIOS
    ]


def nearby_strikes(price: Decimal | float | str, interval: Decimal | float | str) -> tuple[Decimal, Decimal]:
    """Strikes immediately at/below and at/above a price for a given strike interval."""
    p = _d(price, "price")
    i = _d(interval, "interval")
    if i <= 0:
        raise FibonacciInputError("interval must be positive")
    below = (p / i).to_integral_value(rounding="ROUND_FLOOR") * i
    above = (p / i).to_integral_value(rounding="ROUND_CEILING") * i
    return _q(below), _q(above)


# Historical reference preset from the product spec (NOT an assumed current swing).
NIFTY_HISTORICAL_PRESET = {
    "name": "NIFTY historical preset (spec v4.0)",
    "high": Decimal("24774.30"),
    "low": Decimal("22179.90"),
    "range": Decimal("2594.40"),
    "note": "Historical reference only. Not an assumed current swing.",
}
