import { describe, expect, it } from "vitest";
import vectors from "../../../../shared/test-vectors/fibonacci.json";
import { computeFibonacci, projectThreePoint, FibInputError, fibToText } from "../fibonacci";

describe("fibonacci vectors (shared with backend)", () => {
  for (const c of vectors.cases) {
    it(c.name, () => {
      const r = computeFibonacci(c.high, c.low, c.direction as "up" | "down", c.spot, c.convention as "spec" | "pullback");
      const ret = Object.fromEntries(r.levels.filter((l) => l.kind === "retracement").map((l) => [l.label, l.price]));
      const ext = Object.fromEntries(r.levels.filter((l) => l.kind === "extension").map((l) => [l.label, l.price]));
      expect(ret).toEqual(c.retracements);
      expect(ext).toEqual(c.extensions);
      expect(r.nearestSupport?.price).toBe(c.nearest_support);
      expect(r.nearestResistance?.price).toBe(c.nearest_resistance);
    });
  }
  it("three-point projection", () => {
    const p = vectors.projection;
    const got = Object.fromEntries(projectThreePoint(p.a, p.b, p.c).map((l) => [l.label, l.price]));
    expect(got).toEqual(p.levels);
  });
});

describe("fibonacci details", () => {
  it("distances match backend", () => {
    const r = computeFibonacci("24774.30", "22179.90", "up", "23500");
    const f = r.levels.find((l) => l.label === "50%")!;
    expect(f.distancePoints).toBe("-22.90");
    expect(f.distancePct).toBe("-0.10");
  });
  it("rejects bad input", () => {
    expect(() => computeFibonacci(100, 200, "up")).toThrow(FibInputError);
    expect(() => computeFibonacci("abc", 1, "up")).toThrow(FibInputError);
    expect(() => computeFibonacci(200, 100, "up", 0)).toThrow(FibInputError);
    expect(() => projectThreePoint(100, 200, 250)).toThrow(FibInputError);
  });
  it("accepts comma-formatted numbers", () => {
    expect(computeFibonacci("24,774.30", "22,179.90", "up").range).toBe("2594.40");
  });
  it("downward projection can go negative and is formatted", () => {
    const lv = Object.fromEntries(projectThreePoint(200, 100, 150).map((l) => [l.label, l.price]));
    expect(lv["100%"]).toBe("50.00");
    expect(lv["161.8%"]).toBe("-11.80");
  });
  it("text export states it is calculated", () => {
    const t = fibToText(computeFibonacci(200, 100, "up", 150), "NIFTY", "manual");
    expect(t).toContain("Not a prediction");
  });
});
