"""Portfolio summary from Zerodha's own figures.

Zerodha's reported values (pnl, realised, unrealised, margins) are the source of truth and are shown
as-is. We independently recompute unrealised P&L as a reconciliation check and flag any mismatch
instead of silently replacing Zerodha's numbers.
"""

from __future__ import annotations

import re
from collections import defaultdict
from decimal import Decimal

RECON_TOLERANCE = Decimal("1.00")  # ₹

# Kite option/future tradingsymbol pattern, e.g. NIFTY25NOV23500CE, NIFTY2511823500PE, SENSEX25NOVFUT
_SYM = re.compile(r"^(?P<und>[A-Z&]+?)(?P<exp>\d{2}[A-Z]{3}|\d{2}[1-9OND]\d{2})(?P<strike>\d+(?:\.\d+)?)?(?P<typ>CE|PE|FUT)$")


def D(x) -> Decimal:
    return Decimal(str(x)) if x is not None else Decimal(0)


def parse_symbol(sym: str) -> dict:
    m = _SYM.match(sym or "")
    if not m:
        return {"underlying": None, "type": None, "strike": None}
    return {"underlying": m["und"], "type": m["typ"], "strike": D(m["strike"]) if m["strike"] else None}


def summarise(positions: dict, margins: dict, expiry_by_token: dict[int, str] | None = None) -> dict:
    net = positions.get("net") or []
    expiry_by_token = expiry_by_token or {}
    rows, mismatches = [], []
    tot = {"pnl": Decimal(0), "realised": Decimal(0), "unrealised": Decimal(0)}
    by_expiry: dict[str, Decimal] = defaultdict(Decimal)
    hedge: dict[tuple, dict] = defaultdict(lambda: {"short": 0, "long": 0})

    for p in net:
        qty = int(p.get("quantity") or 0)
        mult = D(p.get("multiplier") or 1)
        avg, ltp = D(p.get("average_price")), D(p.get("last_price"))
        sym = p.get("tradingsymbol", "")
        info = parse_symbol(sym)
        expiry = expiry_by_token.get(p.get("instrument_token"))
        z_unreal = D(p.get("unrealised"))
        z_real = D(p.get("realised"))
        z_pnl = D(p.get("pnl"))
        ours = ((ltp - avg) * qty * mult).quantize(Decimal("0.01")) if qty else Decimal("0.00")
        diff = (ours - z_unreal).copy_abs()
        if qty and diff > RECON_TOLERANCE:
            mismatches.append({"symbol": sym, "zerodha_unrealised": str(z_unreal), "recomputed": str(ours)})
        tot["pnl"] += z_pnl
        tot["realised"] += z_real
        tot["unrealised"] += z_unreal
        if qty and expiry:
            by_expiry[expiry] += abs(qty)
        if qty and info["type"] in ("CE", "PE"):
            side = "short" if qty < 0 else "long"
            hedge[(info["underlying"], expiry or "unknown", info["type"])][side] += abs(qty)
        rows.append({
            "symbol": sym, "exchange": p.get("exchange"), "product": p.get("product"),
            "underlying": info["underlying"], "type": info["type"],
            "strike": None if info["strike"] is None else str(info["strike"]), "expiry": expiry,
            "quantity": qty, "average_price": str(avg), "last_price": str(ltp),
            "realised": str(z_real), "unrealised": str(z_unreal), "pnl": str(z_pnl),
            "status": "open" if qty else "closed today",
        })

    hedge_rows = []
    for (und, exp, typ), v in sorted(hedge.items()):
        if v["short"]:
            cov = min(Decimal(1), Decimal(v["long"]) / Decimal(v["short"]))
            hedge_rows.append({"underlying": und, "expiry": exp, "side": typ, "short_qty": v["short"], "long_qty": v["long"],
                               "coverage_pct": str((cov * 100).quantize(Decimal("1")))})

    eq = (margins or {}).get("equity") or {}
    avail = eq.get("net")
    used = (eq.get("utilised") or {}).get("debits")
    util_pct = None
    if avail is not None and used is not None and (D(avail) + D(used)) > 0:
        util_pct = str((D(used) / (D(avail) + D(used)) * 100).quantize(Decimal("0.1")))

    return {
        "positions": rows,
        "open_count": sum(1 for r in rows if r["quantity"]),
        "totals": {k: str(v.quantize(Decimal("0.01"))) for k, v in tot.items()},
        "margins": {
            "available": None if avail is None else str(D(avail)),
            "utilised": None if used is None else str(D(used)),
            "utilisation_pct": util_pct,
            "span": _opt(eq, "span"), "exposure": _opt(eq, "exposure"), "option_premium": _opt(eq, "option_premium"),
        },
        "expiry_concentration": [{"expiry": e, "abs_quantity": str(q)} for e, q in sorted(by_expiry.items())],
        "hedge_coverage": hedge_rows,
        "hedge_note": "Quantity-based: long option quantity of the same type and expiry as a share of short quantity. It does not check strikes or distance, so 100% is not a guarantee of defined risk.",
        "reconciliation": {"ok": not mismatches, "mismatches": mismatches,
                           "note": "Totals are Zerodha's reported figures. Unrealised P&L is recomputed as (LTP − avg) × qty × multiplier and any difference above ₹1 is flagged."},
    }


def _opt(eq: dict, k: str):
    v = (eq.get("utilised") or {}).get(k)
    return None if v is None else str(D(v))
