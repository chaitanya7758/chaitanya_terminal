from datetime import date, datetime, timezone
from zoneinfo import ZoneInfo

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select

from app import security as sec
from app.db import BriefItem, get_sessionmaker
from app.engines import brief as B

router = APIRouter(prefix="/api/brief", tags=["brief"])
IST = ZoneInfo("Asia/Kolkata")
FRANKFURTER = "https://api.frankfurter.app/latest?from=USD&to=INR"


def today_ist() -> date:
    return datetime.now(IST).date()


_fx_cache: dict = {"at": None, "value": None}
FX_TTL_S = 1800


def fetch_usdinr() -> dict | None:
    """ECB reference rate via Frankfurter (free, no key). A daily reference rate, never a live quote.
    Cached for 30 min (including failures) so a slow or blocked source never stalls the brief."""
    now = datetime.now(timezone.utc)
    if _fx_cache["at"] and (now - _fx_cache["at"]).total_seconds() < FX_TTL_S:
        return _fx_cache["value"]
    _fx_cache["at"], _fx_cache["value"] = now, _fetch_usdinr()
    return _fx_cache["value"]


def _fetch_usdinr() -> dict | None:
    try:
        r = httpx.get(FRANKFURTER, timeout=5)
        r.raise_for_status()
        j = r.json()
        rate = j["rates"]["INR"]
        return {"text": f"USD/INR ECB reference rate {rate:.4f} (rate date {j['date']}).", "status": "Previous Close",
                "source_name": "European Central Bank via Frankfurter", "source_url": "https://www.frankfurter.app/", "as_of": j["date"]}
    except Exception:  # noqa: BLE001 - an unavailable source is shown as Unavailable
        return None


class ItemIn(BaseModel):
    day: date
    slot: int = Field(ge=1, le=11)
    text: str = Field(min_length=3, max_length=600)
    source_name: str = Field(default="", max_length=200)
    source_url: str = Field(default="", max_length=1000)
    as_of: str = Field(default="", max_length=64)

    @field_validator("source_url")
    @classmethod
    def https_only(cls, v: str) -> str:
        if v and not v.startswith("https://"):
            raise ValueError("Source link must start with https://")
        return v


def _manual(day: date) -> dict[int, dict]:
    with get_sessionmaker()() as s:
        rows = s.scalars(select(BriefItem).where(BriefItem.day == day.isoformat()).order_by(BriefItem.id)).all()
    out = {}
    for r in rows:  # later rows overwrite earlier ones; history stays in the table
        out[r.slot] = {"text": r.text, "status": "Manual", "source_name": r.source_name, "source_url": r.source_url, "as_of": r.as_of}
    return out


@router.get("")
def get_brief(day: date | None = Query(None), _: str = Depends(sec.require_user)):
    d = day or today_ist()
    auto = {}
    if d == today_ist() and (fx := fetch_usdinr()):
        auto[10] = fx
    b = B.assemble(d, _manual(d), auto)
    return {**b, "text": B.to_text(b), "generated_at": datetime.now(timezone.utc).isoformat()}


@router.post("/item")
def add_item(item: ItemIn, _: str = Depends(sec.require_user)):
    if item.slot <= 10 and not (item.source_name and item.source_url):
        raise HTTPException(422, "Each brief point needs a source name and an https link.")
    with get_sessionmaker()() as s:
        s.add(BriefItem(day=item.day.isoformat(), slot=item.slot, text=item.text.strip(), source_name=item.source_name.strip(),
                        source_url=item.source_url.strip(), as_of=item.as_of.strip(), created_at=datetime.now(timezone.utc)))
        s.commit()
    return {"ok": True}
