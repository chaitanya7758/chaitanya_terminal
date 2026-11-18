import json
from decimal import Decimal
from pathlib import Path

import pytest

from app.engines.fibonacci import (
    FibonacciInputError,
    NIFTY_HISTORICAL_PRESET,
    compute,
    nearby_strikes,
    project_three_point,
)

VECTORS = json.loads(
    (Path(__file__).resolve().parents[2] / "shared/test-vectors/fibonacci.json").read_text()
)


@pytest.mark.parametrize("case", VECTORS["cases"], ids=lambda c: c["name"])
def test_vectors(case):
    res = compute(case["high"], case["low"], case["direction"], case["spot"], case["convention"])
    got_r = {lv.label: str(lv.price) for lv in res.levels if lv.kind == "retracement"}
    got_e = {lv.label: str(lv.price) for lv in res.levels if lv.kind == "extension"}
    assert got_r == case["retracements"]
    assert got_e == case["extensions"]
    assert str(res.nearest_support.price) == case["nearest_support"]
    assert str(res.nearest_resistance.price) == case["nearest_resistance"]


def test_projection_vectors():
    p = VECTORS["projection"]
    got = {lv.label: str(lv.price) for lv in project_three_point(p["a"], p["b"], p["c"])}
    assert got == p["levels"]


def test_preset_range():
    p = NIFTY_HISTORICAL_PRESET
    assert p["high"] - p["low"] == p["range"] == Decimal("2594.40")


def test_distances():
    res = compute("24774.30", "22179.90", "up", spot="23500")
    fifty = next(lv for lv in res.levels if lv.label == "50%")
    assert fifty.distance_points == Decimal("-22.90")
    assert fifty.distance_pct == Decimal("-0.10")


def test_no_spot_means_no_distances():
    res = compute(200, 100, "up")
    assert all(lv.distance_points is None for lv in res.levels)
    assert res.nearest_support is None and res.nearest_resistance is None


def test_spot_above_all_levels_has_no_resistance():
    res = compute(200, 100, "up", spot=10_000)
    assert res.nearest_resistance is None
    assert res.nearest_support.label == "261.8%"


@pytest.mark.parametrize(
    "args",
    [(100, 200, "up"), (100, 100, "up"), (-5, -10, "up"), ("abc", 1, "up"), ("nan", 1, "up"), (200, 100, "sideways")],
)
def test_invalid_inputs(args):
    with pytest.raises((FibonacciInputError, ValueError)):
        compute(*args)


def test_invalid_spot():
    with pytest.raises(FibonacciInputError):
        compute(200, 100, "up", spot=0)


def test_projection_rejects_c_outside_swing():
    with pytest.raises(FibonacciInputError):
        project_three_point(100, 200, 250)


def test_downward_projection():
    lv = {l.label: l.price for l in project_three_point(200, 100, 150)}
    assert lv["100%"] == Decimal("50.00")
    assert lv["161.8%"] == Decimal("-11.80")  # mathematically valid; UI flags non-positive targets


def test_nearby_strikes():
    assert nearby_strikes("23783.24", 50) == (Decimal("23750.00"), Decimal("23800.00"))
    assert nearby_strikes("80000", 100) == (Decimal("80000.00"), Decimal("80000.00"))
