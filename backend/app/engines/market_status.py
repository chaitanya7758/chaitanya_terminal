"""Classify a quote's freshness. Never label data Live unless it is recent and the market is open."""

from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

IST = ZoneInfo("Asia/Kolkata")
OPEN, CLOSE = time(9, 15), time(15, 30)
LIVE_MAX_AGE = timedelta(seconds=90)


def session_open(now: datetime) -> bool:
    """Weekday 09:15–15:30 IST. Exchange holidays are not known here; staleness catches them."""
    local = now.astimezone(IST)
    return local.weekday() < 5 and OPEN <= local.time() < CLOSE


def classify(quote_ts: datetime | None, now: datetime) -> str:
    if quote_ts is None:
        return "Unavailable"
    ts = quote_ts if quote_ts.tzinfo else quote_ts.replace(tzinfo=IST)  # Kite timestamps are IST
    if session_open(now):
        return "Live" if now - ts <= LIVE_MAX_AGE else "Delayed"
    # Market closed: the last value is the close of the most recent session.
    return "Previous Close"
