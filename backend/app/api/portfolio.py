from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from app.api.kite import client
from app.api.market import _err, instruments
from app.engines.portfolio import summarise
from app.integrations import kite

router = APIRouter(prefix="/api/portfolio", tags=["portfolio"])


@router.get("")
def portfolio(c: kite.KiteClient = Depends(client)):
    fetched = datetime.now(timezone.utc).isoformat()
    try:
        positions = c.positions()
        margins = c.margins()
    except kite.KiteError as e:
        raise _err(e)
    tokens = {p.get("instrument_token") for p in positions.get("net") or []}
    expiry = {}
    if tokens:
        for exch in {p.get("exchange") for p in positions.get("net") or []} & {"NFO", "BFO", "MCX", "CDS"}:
            try:
                for i in instruments(c, exch):
                    if i.instrument_token in tokens and i.expiry:
                        expiry[i.instrument_token] = i.expiry.isoformat()
            except kite.KiteError:
                pass  # expiry column stays empty rather than guessed
    return {"source": "Zerodha Kite Connect", "fetched_at": fetched, **summarise(positions, margins, expiry)}
