/**
 * Client-side Fibonacci engine (mirror of backend/app/engines/fibonacci.py).
 * Exact arithmetic: prices are parsed into integer paisa, ratios into thousandths,
 * products computed in BigInt and rounded half-up to 2 dp. Both implementations are
 * verified against shared/test-vectors/fibonacci.json.
 */

export type Direction = "up" | "down";
export type Convention = "spec" | "pullback";
export type LevelKind = "retracement" | "extension" | "projection";

export interface Level {
  kind: LevelKind;
  ratio: string;
  label: string;
  price: string;
  distancePoints: string | null;
  distancePct: string | null;
}

export interface FibResult {
  high: string;
  low: string;
  range: string;
  direction: Direction;
  convention: Convention;
  spot: string | null;
  levels: Level[];
  nearestSupport: Level | null;
  nearestResistance: Level | null;
  notes: string[];
}

export const RETRACEMENTS = ["0", "0.236", "0.382", "0.5", "0.618", "0.786", "1"];
export const EXTENSIONS = ["1.272", "1.618", "2", "2.618"];
export const PROJECTIONS = ["0.618", "1", "1.272", "1.618", "2", "2.618"];

export const NIFTY_HISTORICAL_PRESET = {
  name: "NIFTY historical preset (spec v4.0)",
  high: "24774.30",
  low: "22179.90",
  range: "2594.40",
  note: "Historical reference only. Not an assumed current swing.",
};

export class FibInputError extends Error {}

/** Parse a decimal string/number into a scaled BigInt (value × 10^scale). Rounds half-up beyond scale. */
function toScaled(v: string | number, scale: number, name: string): bigint {
  const s = String(v).trim().replace(/,/g, "");
  if (!/^-?\d+(\.\d+)?$/.test(s)) throw new FibInputError(`${name} is not a number`);
  const neg = s.startsWith("-");
  const [int, frac = ""] = s.replace("-", "").split(".");
  const padded = (frac + "0".repeat(scale + 1)).slice(0, scale + 1);
  let n = BigInt(int + padded.slice(0, scale));
  if (Number(padded[scale]) >= 5) n += 1n;
  return neg ? -n : n;
}

/** Round a value with `scale` decimals to 2 decimals (half-up, away from zero) and format. */
function fmt(n: bigint, scale: number): string {
  const div = 10n ** BigInt(scale - 2);
  const neg = n < 0n;
  let a = neg ? -n : n;
  a = (a + div / 2n) / div;
  const str = a.toString().padStart(3, "0");
  const out = `${str.slice(0, -2)}.${str.slice(-2)}`;
  return neg && a !== 0n ? `-${out}` : out;
}

function label(ratio: string): string {
  const r = toScaled(ratio, 3, "ratio") * 100n; // ×1000 scale → percent ×1000
  const whole = r / 1000n;
  const frac = (r % 1000n).toString().padStart(3, "0").replace(/0+$/, "");
  return `${whole}${frac ? "." + frac : ""}%`;
}

// Internal working scale: prices in paisa (×100) times ratio thousandths (×1000) = ×10^5.
const W = 5;

function makeLevel(kind: LevelKind, ratio: string, price5: bigint, spot2: bigint | null): Level {
  const price = fmt(price5, W);
  let distancePoints: string | null = null;
  let distancePct: string | null = null;
  if (spot2 !== null) {
    const p2 = toScaled(price, 2, "price");
    const d2 = p2 - spot2;
    distancePoints = fmt(d2 * 1000n, W);
    // pct = d/spot*100, computed at ×10^6 scale for rounding headroom
    distancePct = fmt((d2 * 100n * 10n ** 6n) / spot2, 6);
  }
  return { kind, ratio, label: label(ratio), price, distancePoints, distancePct };
}

export function computeFibonacci(
  high: string | number,
  low: string | number,
  direction: Direction,
  spot?: string | number | null,
  convention: Convention = "spec",
): FibResult {
  const h = toScaled(high, 2, "High");
  const l = toScaled(low, 2, "Low");
  if (h <= 0n || l <= 0n) throw new FibInputError("High and Low must be positive");
  if (h <= l) throw new FibInputError("High must be greater than Low");
  if (direction !== "up" && direction !== "down") throw new FibInputError("Direction must be up or down");
  const s = spot === undefined || spot === null || spot === "" ? null : toScaled(spot, 2, "Spot");
  if (s !== null && s <= 0n) throw new FibInputError("Spot must be positive");
  const range = h - l;
  const up = direction === "up";

  const [rBase, rSign] =
    convention === "spec" ? (up ? [l, 1n] : [h, -1n]) : up ? [h, -1n] : [l, 1n];
  const [eBase, eSign] = up ? [l, 1n] : [h, -1n];

  const levels: Level[] = [];
  for (const r of RETRACEMENTS) {
    levels.push(makeLevel("retracement", r, rBase * 1000n + rSign * range * toScaled(r, 3, "r"), s));
  }
  for (const e of EXTENSIONS) {
    levels.push(makeLevel("extension", e, eBase * 1000n + eSign * range * toScaled(e, 3, "e"), s));
  }

  let nearestSupport: Level | null = null;
  let nearestResistance: Level | null = null;
  if (s !== null) {
    for (const lv of levels) {
      const p = toScaled(lv.price, 2, "p");
      if (p < s && (!nearestSupport || p > toScaled(nearestSupport.price, 2, "p"))) nearestSupport = lv;
      if (p > s && (!nearestResistance || p < toScaled(nearestResistance.price, 2, "p"))) nearestResistance = lv;
    }
  }

  const notes = [
    `Swing direction: ${up ? "UP (low then high)" : "DOWN (high then low)"}`,
    `Range = High − Low = ${fmt(h, 2)} − ${fmt(l, 2)} = ${fmt(range, 2)}`,
    convention === "spec"
      ? up ? "Retracement = Low + Range × ratio" : "Retracement = High − Range × ratio"
      : up ? "Retracement (pullback) = High − Range × ratio" : "Retracement (pullback) = Low + Range × ratio",
    up ? "Extension = Low + Range × ratio" : "Extension = High − Range × ratio",
  ];

  return {
    high: fmt(h, 2), low: fmt(l, 2), range: fmt(range, 2), direction, convention,
    spot: s === null ? null : fmt(s, 2), levels, nearestSupport, nearestResistance, notes,
  };
}

export function projectThreePoint(
  a: string | number, b: string | number, c: string | number, spot?: string | number | null,
): Level[] {
  const A = toScaled(a, 2, "A"), B = toScaled(b, 2, "B"), C = toScaled(c, 2, "C");
  if (A <= 0n || B <= 0n || C <= 0n) throw new FibInputError("A, B and C must be positive");
  if (A === B) throw new FibInputError("A and B must differ");
  const lo = A < B ? A : B, hi = A < B ? B : A;
  if (C < lo || C > hi || C === B) throw new FibInputError("C must lie between A and B");
  const s = spot === undefined || spot === null || spot === "" ? null : toScaled(spot, 2, "Spot");
  return PROJECTIONS.map((r) => makeLevel("projection", r, C * 1000n + (B - A) * toScaled(r, 3, "r"), s));
}

export function nearbyStrikes(price: string, interval: number): [number, number] {
  const p = Number(price);
  return [Math.floor(p / interval) * interval, Math.ceil(p / interval) * interval];
}

/** Plain-text export for copy/paste (clipboard, Claude, ChatGPT). */
export function fibToText(res: FibResult, instrument: string, anchorsSource: string): string {
  const lines = [
    `CHAITANYA'S TERMINAL | Fibonacci levels | ${instrument}`,
    `Anchors: High ${res.high}, Low ${res.low} (${anchorsSource})`,
    ...res.notes,
    `Spot: ${res.spot ?? "not supplied"}`,
    "",
    "Level | Price | Dist (pts) | Dist (%)",
    ...res.levels.map(
      (l) => `${l.kind === "extension" ? "Ext " : "Ret "}${l.label} | ${l.price} | ${l.distancePoints ?? "-"} | ${l.distancePct ?? "-"}`,
    ),
    "",
    `Nearest support: ${res.nearestSupport ? `${res.nearestSupport.label} @ ${res.nearestSupport.price}` : "none below spot"}`,
    `Nearest resistance: ${res.nearestResistance ? `${res.nearestResistance.label} @ ${res.nearestResistance.price}` : "none above spot"}`,
    "Calculated from the anchors above. Not a prediction.",
  ];
  return lines.join("\n");
}
