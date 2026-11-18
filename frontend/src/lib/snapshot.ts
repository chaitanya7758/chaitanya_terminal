/**
 * AI Analysis Centre: snapshot + prompt builder and response parser.
 * No AI API is called anywhere. The user copies the text and pastes it into Claude or ChatGPT.
 */

export const MODES = [
  { id: "morning", label: "Morning Market Briefing", task: "Give a pre-market view for today's session: key cues, likely opening behaviour, levels to watch and the main risks." },
  { id: "nifty-expiry", label: "NIFTY Expiry Analysis", task: "Analyse the current NIFTY expiry: positioning, levels, gamma and liquidity risk into expiry, and defined-risk structures worth evaluating." },
  { id: "sensex-expiry", label: "SENSEX Expiry Analysis", task: "Analyse the current SENSEX expiry: positioning, levels, gamma and liquidity risk into expiry, and defined-risk structures worth evaluating." },
  { id: "portfolio-risk", label: "Portfolio Risk Review", task: "Review the open positions for risk: worst-case loss, hedge effectiveness, short strikes near spot, margin and overnight gap risk." },
  { id: "trade-strategy", label: "Trade Strategy Review", task: "Review the proposed trade or strategy described in the user context: risk/reward, break-evens, adjustments, and defined-risk alternatives." },
  { id: "weekly-performance", label: "Weekly Performance Review", task: "Review the week's trading performance: what worked, what did not, rule breaches, and changes for next week." },
  { id: "post-trade", label: "Post-Trade Review", task: "Review the closed trade described in the user context: entry/exit quality, risk management, and lessons." },
] as const;
export type ModeId = (typeof MODES)[number]["id"];

export const COMMON_INSTRUCTIONS = [
  "Use only the supplied data for account-specific facts (positions, P&L, margins).",
  "Clearly distinguish facts from estimates and from your own opinion.",
  "Identify the biggest risks first.",
  "Analyse Fibonacci confluence with the other supplied levels.",
  "Consider expiry-day gamma risk and liquidity risk.",
  "Assess hedge effectiveness of any open positions.",
  "Do not assume any previously discussed positions are still open; only the positions listed here are current.",
  "Prefer defined-risk alternatives where relevant.",
  "State your uncertainty explicitly.",
  "Never invent missing data. Where a section says UNAVAILABLE, say what you would need instead of guessing.",
  "Never guarantee trading outcomes. This is decision support, not advice to execute.",
];

export const SUMMARY_FIELDS = [
  ["nifty_bias", "NIFTY bias"],
  ["sensex_bias", "SENSEX bias"],
  ["fib_support", "Fibonacci support"],
  ["fib_resistance", "Fibonacci resistance"],
  ["expected_range", "Expected range"],
  ["main_risks", "Main portfolio risks"],
  ["bullish_triggers", "Bullish triggers"],
  ["bearish_triggers", "Bearish triggers"],
  ["strategy_considerations", "Strategy considerations"],
] as const;
export type SummaryKey = (typeof SUMMARY_FIELDS)[number][0];

export interface SnapshotSection {
  key: string;
  title: string;
  /** Status of the data in this section, shown to the AI verbatim. */
  status: "Live" | "Delayed" | "Previous Close" | "Calculated" | "Manual" | "Estimated" | "Unavailable";
  source: string;
  body: string;
  sensitive?: boolean;
}

export interface Snapshot {
  id: string;
  createdAt: string; // ISO UTC
  createdAtIST: string;
  mode: ModeId;
  sections: SnapshotSection[];
}

export function formatIST(d: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata", year: "numeric", month: "short", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).format(d) + " IST";
}

/** CT-YYYYMMDD-HHMMSS-XXXX in IST, with 4 random base-36 chars. */
export function makeSnapshotId(d: Date, rand: () => number = Math.random): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
    }).formatToParts(d).map((p) => [p.type, p.value]),
  );
  const suffix = Array.from({ length: 4 }, () => Math.floor(rand() * 36).toString(36)).join("").toUpperCase();
  return `CT-${parts.year}${parts.month}${parts.day}-${parts.hour}${parts.minute}${parts.second}-${suffix}`;
}

export function buildPrompt(s: Snapshot, include: Record<string, boolean>, userContext: string): string {
  const mode = MODES.find((m) => m.id === s.mode)!;
  const sections = s.sections.filter((x) => include[x.key] !== false);
  const removed = s.sections.filter((x) => include[x.key] === false).map((x) => x.title);
  const out: string[] = [
    `CHAITANYA'S TERMINAL | Analysis request | ${mode.label}`,
    `Snapshot ID: ${s.id}`,
    `Snapshot time: ${s.createdAtIST}`,
    "",
    "ROLE: You are an experienced Indian index-options risk analyst. The trader mainly sells hedged NIFTY and SENSEX options (strangles, credit spreads, iron condors). Capital preservation comes first.",
    "",
    `TASK: ${mode.task}`,
    "",
    "RULES:",
    ...COMMON_INSTRUCTIONS.map((r, i) => `${i + 1}. ${r}`),
    "",
    "DATA (each section states its status and source):",
  ];
  for (const sec of sections) {
    out.push("", `## ${sec.title} [${sec.status}] (source: ${sec.source})`, sec.body.trim() || "(empty)");
  }
  if (removed.length) out.push("", `Sections removed by the user before sharing: ${removed.join(", ")}. Do not speculate about them.`);
  if (userContext.trim()) out.push("", "## Additional context from the trader [Manual]", userContext.trim());
  out.push(
    "",
    "OUTPUT FORMAT:",
    "Write your analysis, biggest risks first. Then end with exactly one fenced block in this format so it can be compared with another assistant's answer. Use \"not determinable\" where the data does not support an answer.",
    "```ct-summary",
    `snapshot_id: ${s.id}`,
    ...SUMMARY_FIELDS.map(([k]) => `${k}: <one line>`),
    "```",
  );
  return out.join("\n");
}

export type ParsedSummary = { snapshotId: string | null; fields: Partial<Record<SummaryKey, string>>; found: boolean };

/** Extract the ct-summary block from a pasted response. Missing fields stay missing. */
export function parseSummary(text: string): ParsedSummary {
  const m = text.match(/```\s*ct-summary\s*\n([\s\S]*?)```/i);
  if (!m) return { snapshotId: null, fields: {}, found: false };
  const fields: Partial<Record<SummaryKey, string>> = {};
  let snapshotId: string | null = null;
  const keys = new Set<string>(SUMMARY_FIELDS.map(([k]) => k));
  for (const line of m[1].split("\n")) {
    const kv = line.match(/^\s*([a-z_]+)\s*:\s*(.*)$/i);
    if (!kv) continue;
    const k = kv[1].toLowerCase();
    const v = kv[2].trim();
    if (k === "snapshot_id") snapshotId = v || null;
    else if (keys.has(k) && v && !/^<.*>$/.test(v)) fields[k as SummaryKey] = v;
  }
  return { snapshotId, fields, found: true };
}

export type Agreement = "same" | "different" | "one-missing" | "both-missing";

/**
 * Only a literal comparison after normalising case/whitespace/punctuation. Anything that is not
 * textually equal is shown as "different" for the user to judge; we never infer semantic agreement.
 * Bias fields are compared on their first word (bullish/bearish/neutral/mixed...).
 */
export function compareField(key: SummaryKey, a?: string, b?: string): Agreement {
  if (!a && !b) return "both-missing";
  if (!a || !b) return "one-missing";
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9.\s-]/g, "").replace(/\s+/g, " ").trim();
  if (key.endsWith("_bias")) {
    const w = (s: string) => norm(s).split(" ")[0];
    return w(a) === w(b) ? "same" : "different";
  }
  return norm(a) === norm(b) ? "same" : "different";
}

/** Strip obvious account identifiers (Zerodha client IDs look like 2-3 letters + 4-6 digits). */
export function redactIdentifiers(text: string): string {
  return text
    .replace(/\b[A-Z]{2,3}\d{4,6}\b/g, "[REDACTED-ID]")
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "[REDACTED-EMAIL]")
    .replace(/(?<!\d)(?:\+91[\s-]?)?[6-9]\d{9}(?!\d)/g, "[REDACTED-PHONE]");
}
