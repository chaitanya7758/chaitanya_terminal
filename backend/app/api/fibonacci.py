from decimal import Decimal
from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.engines import fibonacci as fib

router = APIRouter(prefix="/api/fibonacci", tags=["fibonacci"])


class FibRequest(BaseModel):
    high: Decimal = Field(gt=0)
    low: Decimal = Field(gt=0)
    direction: Literal["up", "down"]
    spot: Decimal | None = Field(default=None, gt=0)
    convention: Literal["spec", "pullback"] = "spec"
    strike_interval: Decimal | None = Field(default=None, gt=0)


class ProjectionRequest(BaseModel):
    a: Decimal = Field(gt=0)
    b: Decimal = Field(gt=0)
    c: Decimal = Field(gt=0)
    spot: Decimal | None = Field(default=None, gt=0)


@router.post("/levels")
def levels(req: FibRequest):
    try:
        res = fib.compute(req.high, req.low, req.direction, req.spot, req.convention)
    except fib.FibonacciInputError as e:
        raise HTTPException(422, str(e)) from e
    out = res.to_dict()
    if req.strike_interval:
        for lv in out["levels"]:
            lo, hi = fib.nearby_strikes(lv["price"], req.strike_interval)
            lv["nearby_strikes"] = [str(lo), str(hi)]
    out["source"] = "Calculated from user-supplied anchors"
    return out


@router.post("/projection")
def projection(req: ProjectionRequest):
    try:
        lv = fib.project_three_point(req.a, req.b, req.c, req.spot)
    except fib.FibonacciInputError as e:
        raise HTTPException(422, str(e)) from e
    return {"levels": [x.to_dict() for x in lv], "formula": "C + (B - A) x ratio"}


@router.get("/presets")
def presets():
    p = fib.NIFTY_HISTORICAL_PRESET
    return [{**p, "high": str(p["high"]), "low": str(p["low"]), "range": str(p["range"]), "instrument": "NIFTY"}]
