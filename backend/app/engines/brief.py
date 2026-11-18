"""10-point brief assembled from structured data and sourced manual entries. No generated commentary."""

from datetime import date, datetime, timedelta

HEADER = "CHAITANYA'S TERMINAL | 10-Point Market Brief"

SLOTS = {
    1: "US market close",
    2: "Fed decision / US macro",
    3: "FII/DII net flows",
    4: "GIFT NIFTY",
    5: "Indian earnings due",
    6: "Major geopolitical development",
    7: "Geopolitical response / second fact",
    8: "Brent crude",
    9: "Indian corporate / listing / sector news",
    10: "USD/INR",
}
SUMMARY_SLOT = 11


def session_info(day: date) -> dict:
    """Weekend detection only; exchange holidays need the official holiday list (not yet loaded)."""
    if day.weekday() >= 5:
        nxt = day + timedelta(days=7 - day.weekday())
        return {"trading_day": False, "reason": f"{day.strftime('%A')}: markets closed", "next_session": nxt.isoformat()}
    return {"trading_day": True, "reason": None, "next_session": day.isoformat(),
            "holiday_check": "Exchange holiday calendar not yet loaded; confirm on NSE/BSE."}


def assemble(day: date, manual: dict[int, dict], auto: dict[int, dict]) -> dict:
    points = []
    for n, title in SLOTS.items():
        item = manual.get(n) or auto.get(n)
        if item:
            points.append({"n": n, "topic": title, **item})
        else:
            points.append({"n": n, "topic": title, "text": None, "status": "Unavailable",
                           "source_name": None, "source_url": None, "as_of": None})
    summary = manual.get(SUMMARY_SLOT)
    return {"header": HEADER, "day": day.isoformat(), "session": session_info(day), "points": points,
            "summary": summary["text"] if summary else None,
            "note": "Assembled from Zerodha/free-source data and your sourced entries. Nothing is generated or inferred."}


def to_text(b: dict) -> str:
    lines = [b["header"], f"Date: {b['day']}" + ("" if b["session"]["trading_day"] else f" ({b['session']['reason']}; next session {b['session']['next_session']})"), ""]
    for p in b["points"]:
        if p["text"]:
            src = f" [{p['status']}; {p['source_name']}{', ' + p['as_of'] if p.get('as_of') else ''}]"
            lines.append(f"{p['n']}. {p['text']}{src}")
        else:
            lines.append(f"{p['n']}. {p['topic']}: UNAVAILABLE")
    lines += ["", b["summary"] or "Summary: not written yet."]
    return "\n".join(lines)
