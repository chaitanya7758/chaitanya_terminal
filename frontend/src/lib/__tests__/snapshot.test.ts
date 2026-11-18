import { describe, expect, it } from "vitest";
import { buildPrompt, compareField, makeSnapshotId, parseSummary, redactIdentifiers, type Snapshot } from "../snapshot";

const snap: Snapshot = {
  id: "CT-20261118-233000-AB12", createdAt: "2026-11-18T18:00:00Z", createdAtIST: "18 Nov 2026, 23:30:00 IST", mode: "nifty-expiry",
  sections: [
    { key: "fib", title: "Fibonacci", status: "Calculated", source: "manual anchors", body: "61.8% 23783.24" },
    { key: "positions", title: "Positions", status: "Unavailable", source: "Zerodha", body: "Zerodha not connected", sensitive: true },
  ],
};

describe("snapshot", () => {
  it("id is in IST", () => {
    expect(makeSnapshotId(new Date("2026-11-18T18:00:00Z"), () => 0)).toBe("CT-20261118-233000-0000");
  });
  it("prompt carries id, rules, statuses and the summary block", () => {
    const p = buildPrompt(snap, {}, "");
    expect(p).toContain("Snapshot ID: CT-20261118-233000-AB12");
    expect(p).toContain("[Unavailable]");
    expect(p).toContain("Never invent missing data");
    expect(p).toContain("```ct-summary");
  });
  it("removed sections are excluded and named", () => {
    const p = buildPrompt(snap, { positions: false }, "my note");
    expect(p).not.toContain("Zerodha not connected");
    expect(p).toContain("Sections removed by the user before sharing: Positions");
    expect(p).toContain("my note");
  });
  it("parses a summary block and ignores template placeholders", () => {
    const r = parseSummary("text\n```ct-summary\nsnapshot_id: CT-1\nnifty_bias: Bearish below 23,780\nsensex_bias: <one line>\n```\n");
    expect(r.found).toBe(true);
    expect(r.snapshotId).toBe("CT-1");
    expect(r.fields.nifty_bias).toBe("Bearish below 23,780");
    expect(r.fields.sensex_bias).toBeUndefined();
  });
  it("missing block is reported, not invented", () => {
    expect(parseSummary("no block").found).toBe(false);
  });
  it("comparison is literal", () => {
    expect(compareField("nifty_bias", "Bearish, weak", "bearish below 23800")).toBe("same");
    expect(compareField("nifty_bias", "Bullish", "Neutral")).toBe("different");
    expect(compareField("fib_support", "23477", undefined)).toBe("one-missing");
    expect(compareField("fib_support", undefined, undefined)).toBe("both-missing");
  });
  it("redacts identifiers", () => {
    expect(redactIdentifiers("client AB1234 mail a@b.com ph 9876543210")).toBe("client [REDACTED-ID] mail [REDACTED-EMAIL] ph [REDACTED-PHONE]");
    expect(redactIdentifiers("NIFTY25NOV23500CE")).toBe("NIFTY25NOV23500CE");
  });
});
