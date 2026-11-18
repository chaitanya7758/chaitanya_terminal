"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Panel } from "@/components/Panel";
import { DataStatus } from "@/components/DataStatus";
import { computeFibonacci, type Direction, type Convention } from "@/lib/fibonacci";
import { MODES, buildPrompt, formatIST, makeSnapshotId, redactIdentifiers, type ModeId, type Snapshot, type SnapshotSection } from "@/lib/snapshot";
import { loadAll, saveRecord, type AnalysisRecord } from "@/lib/aiStore";

const NOT_CONNECTED = "UNAVAILABLE: Zerodha is not connected yet, so no live or account data is included.";

function fibSection(inst: "NIFTY" | "SENSEX"): SnapshotSection {
  try {
    const raw = localStorage.getItem(`fib:${inst}`);
    const s = raw ? JSON.parse(raw) : null;
    if (s?.high && s?.low) {
      const r = computeFibonacci(s.high, s.low, s.direction as Direction, s.spot || null, s.convention as Convention);
      const lines = [
        `Anchors: High ${r.high}, Low ${r.low} (${s.source}). Direction ${r.direction}. Convention ${r.convention}.`,
        ...(s.source?.includes("historical preset") ? ["NOTE: These anchors are a historical reference preset, not the current market swing."] : []),
        `Spot used: ${r.spot ?? "not supplied"} (entered by the trader, not a live quote)`,
        ...r.levels.map((l) => `${l.kind === "extension" ? "Ext" : "Ret"} ${l.label}: ${l.price}${l.distancePoints ? ` (${l.distancePoints} pts, ${l.distancePct}%)` : ""}`),
        `Nearest support: ${r.nearestSupport ? `${r.nearestSupport.label} ${r.nearestSupport.price}` : "n/a"}; nearest resistance: ${r.nearestResistance ? `${r.nearestResistance.label} ${r.nearestResistance.price}` : "n/a"}`,
      ];
      return { key: `fib-${inst}`, title: `${inst} Fibonacci levels`, status: "Calculated", source: `Fibonacci calculator, ${s.source}`, body: lines.join("\n") };
    }
  } catch {}
  return { key: `fib-${inst}`, title: `${inst} Fibonacci levels`, status: "Unavailable", source: "Fibonacci calculator", body: "UNAVAILABLE: no anchors entered in the calculator." };
}

function buildSections(): SnapshotSection[] {
  return [
    { key: "prices", title: "NIFTY and SENSEX prices, India VIX", status: "Unavailable", source: "Zerodha Kite", body: NOT_CONNECTED },
    { key: "expiries", title: "Current expiries and contract specs", status: "Unavailable", source: "Zerodha instrument file", body: NOT_CONNECTED },
    { key: "positions", title: "Zerodha positions, P&L and margins", status: "Unavailable", source: "Zerodha Kite", body: NOT_CONNECTED, sensitive: true },
    { key: "greeks", title: "Portfolio Greeks", status: "Unavailable", source: "Calculated from positions", body: NOT_CONNECTED, sensitive: true },
    { key: "chain", title: "Option-chain metrics, IV, expected move", status: "Unavailable", source: "Zerodha Kite", body: NOT_CONNECTED },
    fibSection("NIFTY"),
    fibSection("SENSEX"),
    { key: "technicals", title: "EMA / VWAP references", status: "Unavailable", source: "Zerodha historical candles", body: NOT_CONNECTED },
    { key: "news", title: "Important news and macro events", status: "Unavailable", source: "Not configured", body: "UNAVAILABLE: no news or calendar source configured yet." },
  ];
}

export default function AIPage() {
  const [mode, setMode] = useState<ModeId>("morning");
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [include, setInclude] = useState<Record<string, boolean>>({});
  const [context, setContext] = useState("");
  const [redact, setRedact] = useState(true);
  const [edited, setEdited] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [history, setHistory] = useState<AnalysisRecord[]>([]);

  useEffect(() => setHistory(loadAll()), []);

  const generate = () => {
    const now = new Date();
    setSnap({ id: makeSnapshotId(now), createdAt: now.toISOString(), createdAtIST: formatIST(now), mode, sections: buildSections() });
    setInclude({});
    setEdited(null);
  };

  const prompt = useMemo(() => {
    if (!snap) return "";
    const p = buildPrompt({ ...snap, mode }, include, context);
    return redact ? redactIdentifiers(p) : p;
  }, [snap, mode, include, context, redact]);
  const finalText = edited ?? prompt;

  const copyAndRecord = (target: string) => {
    if (!snap) return;
    navigator.clipboard?.writeText(finalText).then(() => setCopied(target), () => setCopied(null));
    saveRecord({ snapshot: { ...snap, mode }, prompt: finalText, responses: { claude: "", chatgpt: "" }, thesis: "", thesisSavedAt: null, outcome: "" });
    setHistory(loadAll());
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline gap-2">
        <h1 className="text-lg font-semibold">AI Analysis Centre</h1>
        <span className="text-xs text-muted">Nothing is sent automatically. You copy the report and paste it into Claude or ChatGPT yourself.</span>
      </div>

      <Panel title="1. Choose analysis and build snapshot">
        <div className="flex flex-wrap gap-2">
          {MODES.map((m) => (
            <button key={m.id} onClick={() => setMode(m.id)}
              className={`rounded-md border px-2.5 py-1.5 text-xs ${mode === m.id ? "border-accent text-text" : "border-line text-muted"}`}>{m.label}</button>
          ))}
        </div>
        <label className="mt-3 block text-xs text-muted">Your context (trade idea, positions you want reviewed, notes). Marked as Manual in the report.
          <textarea value={context} onChange={(e) => { setContext(e.target.value); setEdited(null); }} rows={3}
            className="mt-1 w-full rounded-md border border-line bg-panel-2 p-2 text-sm text-text outline-none focus:border-accent" />
        </label>
        <button onClick={generate} className="mt-3 rounded-md bg-accent px-3 py-2 text-sm font-semibold text-black">
          {snap ? "Rebuild snapshot" : "Build snapshot"}
        </button>
      </Panel>

      {snap && (
        <>
          <Panel title="2. Review what is shared" right={<span className="num text-[11px] text-muted">{snap.id}</span>}>
            <ul className="divide-y divide-line">
              {snap.sections.map((s) => (
                <li key={s.key} className="flex items-center gap-2 py-2 text-sm">
                  <input type="checkbox" checked={include[s.key] !== false} onChange={(e) => { setInclude((p) => ({ ...p, [s.key]: e.target.checked })); setEdited(null); }} aria-label={`Include ${s.title}`} />
                  <span className="flex-1">{s.title}{s.sensitive && <span className="ml-1 text-[10px] text-warn">sensitive</span>}</span>
                  <DataStatus status={s.status} />
                </li>
              ))}
            </ul>
            <label className="mt-2 flex items-center gap-2 text-xs text-muted">
              <input type="checkbox" checked={redact} onChange={(e) => { setRedact(e.target.checked); setEdited(null); }} /> Mask client IDs, emails and phone numbers
            </label>
            <p className="mt-1 text-[11px] text-muted">Created {snap.createdAtIST}</p>
          </Panel>

          <Panel title="3. Preview, copy and open" right={edited !== null && <button className="text-[11px] text-muted underline" onClick={() => setEdited(null)}>Reset edits</button>}>
            <textarea value={finalText} onChange={(e) => setEdited(e.target.value)} rows={14}
              className="num w-full rounded-md border border-line bg-panel-2 p-2 text-[11px] leading-snug text-text outline-none focus:border-accent" />
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <a href="https://claude.ai/" target="_blank" rel="noopener noreferrer" onClick={() => copyAndRecord("claude")}
                className="rounded-md border border-line bg-panel-2 px-3 py-3 text-center text-sm font-semibold">Copy + open Claude</a>
              <a href="https://chatgpt.com/" target="_blank" rel="noopener noreferrer" onClick={() => copyAndRecord("chatgpt")}
                className="rounded-md border border-line bg-panel-2 px-3 py-3 text-center text-sm font-semibold">Copy + open ChatGPT</a>
            </div>
            {copied && (
              <p className="mt-2 text-xs text-up">
                Copied. In the {copied === "claude" ? "Claude" : "ChatGPT"} tab, start a new chat and paste (long-press → Paste on iPhone, Ctrl/Cmd+V on laptop). Then bring the reply back to{" "}
                <Link className="underline" href={`/ai/compare?id=${snap.id}`}>Compare</Link>.
              </p>
            )}
          </Panel>
        </>
      )}

      <Panel title="Saved snapshots (this device)">
        {history.length === 0 ? <p className="text-sm text-muted">None yet.</p> : (
          <ul className="divide-y divide-line text-sm">
            {history.slice(0, 20).map((h) => (
              <li key={h.snapshot.id} className="flex items-center gap-2 py-2">
                <span className="num text-xs">{h.snapshot.id}</span>
                <span className="flex-1 truncate text-xs text-muted">{MODES.find((m) => m.id === h.snapshot.mode)?.label}</span>
                <Link className="text-xs text-accent" href={`/ai/compare?id=${h.snapshot.id}`}>Compare</Link>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-[11px] text-muted">Stored in this browser only until the server database is connected.</p>
      </Panel>
    </div>
  );
}
