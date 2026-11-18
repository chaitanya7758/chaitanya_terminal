# Formulas

All prices use exact decimal arithmetic and are rounded half-up to 2 dp. Both the Python and the
TypeScript engines are tested against hand-calculated vectors in `shared/test-vectors/fibonacci.json`.

## Fibonacci retracements (ratios 0, 23.6, 38.2, 50, 61.8, 78.6, 100%)
Range = High − Low.

**Spec convention (default, as written in the product spec)**
- Upward swing (low formed first): Level = Low + Range × ratio
- Downward swing (high formed first): Level = High − Range × ratio

**Pullback convention (optional toggle)**: ratio measured back from the swing end.
- Upward swing: Level = High − Range × ratio
- Downward swing: Level = Low + Range × ratio

Note: under the spec convention an upward swing's "61.8%" is at Low + 0.618 × Range, which is the
level most charting tools label "38.2% retracement". The toggle lets you use either.

## Extensions (127.2, 161.8, 200, 261.8%)
- Upward swing: Level = Low + Range × ratio (above the high)
- Downward swing: Level = High − Range × ratio (below the low)

## Three-point projection (61.8, 100, 127.2, 161.8, 200, 261.8%)
Level = C + (B − A) × ratio, where A→B is the swing and C the retracement point between them.

## Distances
Points = Level − Spot. Percent = (Level − Spot) / Spot × 100.
Nearest support = highest level below spot; nearest resistance = lowest level above spot.

## Nearby strikes
Floor and ceiling of Level / strike interval. Default intervals are editable; live intervals will
come from Zerodha's instrument file.

## NIFTY historical preset
High 24,774.30, Low 22,179.90, Range 2,594.40. Example (upward, spec): 61.8% = 22,179.90 + 2,594.40 × 0.618 = 23,783.24.
