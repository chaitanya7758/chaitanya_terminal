"use client";
import { useEffect, useMemo, useState } from "react";
import { Panel } from "@/components/Panel";
import { DataStatus } from "@/components/DataStatus";
import { useInstrument } from "@/lib/instrument";
import {
  computeFibonacci, projectThreePoint, fibToText, nearbyStrikes, NIFTY_HISTORICAL_PRESET,
  type Convention, type Direction, type FibResult, type Level,
} from "@/lib/fibonacci";
import { LevelLadder } from "@/components/LevelLadder";

interface Inputs { high: string; low: string; spot: string; direction: Direction; convention: Convention; interval: string; locked: boolean; source: string }

// Editable defaults only. Live strike intervals come from Zerodha's instrument file (stage 4).
const DEFAULT_INTERVAL = { NIFTY: "50", SENSEX: "100" } as const;
const empty = (i: "NIFTY" | "SENSEX"): Inputs => ({ high: "", low: "", spot: "", direction: "up", convention: "spec", interval: DEFAULT_INTERVAL[i], locked: false, source: "Manual anchors" });

const inputCls = "num w-full rounded-md border border-line bg-panel-2 px-2.5 py-2 text-sm outline-none focus:border-accent disabled:opacity-60";

export default function FibonacciPage() {
  const { instrument } = useInstrument();
  const [inp, setInp] = useState<Inputs>(empty(instrument));
  const [abc, setAbc] = useState({ a: "", b: "", c: "" });
  const [copied, setCopied] = useState(false);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  // Per-instrument persistence (lock state included).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(`fib:${instrument}`);
      setInp(raw ? { ...empty(instrument), ...JSON.parse(raw) } : empty(instrument));
    } catch { setInp(empty(instrument)); }
    setLoadedFor(instrument);
  }, [instrument]);
  useEffect(() => {
    if (loadedFor !== instrument) return; // don't write one instrument's anchors under another's key
    try { localStorage.setItem(`fib:${instrument}`, JSON.stringify(inp)); } catch {}
  }, [inp, instrument, loadedFor]);

  const set = <K extends keyof Inputs>(k: K, v: Inputs[K]) => setInp((p) => ({ ...p, [k]: v, ...(k === "high" || k === "low" ? { source: "Manual anchors" } : {}) }));

  const { result, error } = useMemo((): { result: FibResult | null; error: string | null } => {
    if (!inp.high || !inp.low) return { result: null, error: null };
    try { return { result: computeFibonacci(inp.high, inp.low, inp.direction, inp.spot || null, inp.convention), error: null }; }
    catch (e) { return { result: null, error: (e as Error).message }; }
  }, [inp]);

  const projection = useMemo((): { levels: Level[] | null; error: string | null } => {
    if (!abc.a || !abc.b || !abc.c) return { levels: null, error: null };
    try { return { levels: projectThreePoint(abc.a, abc.b, abc.c, inp.spot || null), error: null }; }
    catch (e) { return { levels: null, error: (e as Error).message }; }
  }, [abc, inp.spot]);

  const interval = Number(inp.interval) > 0 ? Number(inp.interval) : null;

  const copy = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(fibToText(result, instrument, inp.source));
      setCopied(true); setTimeout(() => setCopied(false), 1500);
    } catch { setCopied(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline gap-2">
        <h1 className="text-lg font-semibold">{instrument} Fibonacci calculator</h1>
        <DataStatus status="Calculated" />
        <span className="text-xs text-muted">From the anchors you enter. Chart candles and automatic swings arrive once Zerodha is connected.</span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        <Panel title="Swing anchors" right={
          <label className="flex items-center gap-1.5 text-xs text-muted">
            <input type="checkbox" checked={inp.locked} onChange={(e) => set("locked", e.target.checked)} /> Lock
          </label>
        }>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs text-muted">Swing high
              <input inputMode="decimal" className={inputCls} value={inp.high} disabled={inp.locked} onChange={(e) => set("high", e.target.value)} placeholder="e.g. 24774.30" />
            </label>
            <label className="text-xs text-muted">Swing low
              <input inputMode="decimal" className={inputCls} value={inp.low} disabled={inp.locked} onChange={(e) => set("low", e.target.value)} placeholder="e.g. 22179.90" />
            </label>
            <label className="text-xs text-muted">Current spot (you enter)
              <input inputMode="decimal" className={inputCls} value={inp.spot} onChange={(e) => set("spot", e.target.value)} placeholder="optional" />
            </label>
            <label className="text-xs text-muted">Strike interval
              <input inputMode="decimal" className={inputCls} value={inp.interval} onChange={(e) => set("interval", e.target.value)} />
            </label>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
            <fieldset disabled={inp.locked}>
              <legend className="mb-1 text-muted">Swing direction</legend>
              <Seg value={inp.direction} onChange={(v) => set("direction", v as Direction)} options={[["up", "Up (low → high)"], ["down", "Down (high → low)"]]} />
            </fieldset>
            <fieldset>
              <legend className="mb-1 text-muted">Convention</legend>
              <Seg value={inp.convention} onChange={(v) => set("convention", v as Convention)} options={[["spec", "Spec"], ["pullback", "Pullback"]]} />
            </fieldset>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {instrument === "NIFTY" && (
              <button disabled={inp.locked} className="rounded-md border border-line px-2.5 py-1.5 text-xs disabled:opacity-50"
                onClick={() => setInp((p) => ({ ...p, high: NIFTY_HISTORICAL_PRESET.high, low: NIFTY_HISTORICAL_PRESET.low, source: NIFTY_HISTORICAL_PRESET.name }))}>
                Load NIFTY historical preset
              </button>
            )}
            <button disabled={inp.locked} className="rounded-md border border-line px-2.5 py-1.5 text-xs disabled:opacity-50" onClick={() => setInp(empty(instrument))}>Clear</button>
          </div>
          {inp.source === NIFTY_HISTORICAL_PRESET.name && (
            <p className="mt-2 text-[11px] text-warn">{NIFTY_HISTORICAL_PRESET.note} High 24,774.30 / Low 22,179.90 / Range 2,594.40.</p>
          )}
          <p className="mt-3 text-[11px] leading-snug text-muted">
            <b>Spec</b>: up swing level = Low + Range × ratio; down swing = High − Range × ratio. <b>Pullback</b>: ratios measured back from the swing end, so 61.8% is a deep pullback.
          </p>
          {error && <p role="alert" className="mt-2 text-xs text-down">{error}</p>}
        </Panel>

        <Panel title="Levels" right={result && <button onClick={copy} className="rounded border border-line px-2 py-1 text-[11px]">{copied ? "Copied" : "Copy"}</button>}>
          {!result ? (
            <p className="text-sm text-muted">Enter a swing high and low to calculate levels.</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-[1fr_180px]">
              <div className="overflow-x-auto">
                <SummaryRow r={result} interval={interval} />
                <table className="num mt-2 w-full text-xs">
                  <thead className="text-left text-[10px] uppercase text-muted">
                    <tr><th className="py-1">Level</th><th>Price</th><th className="text-right">Δ pts</th><th className="text-right">Δ %</th>{interval && <th className="text-right">Strikes</th>}</tr>
                  </thead>
                  <tbody>
                    {[...result.levels].sort((a, b) => Number(b.price) - Number(a.price)).map((l) => (
                      <LevelRow key={l.kind + l.label} l={l} interval={interval}
                        highlight={l === result.nearestSupport ? "S" : l === result.nearestResistance ? "R" : null} />
                    ))}
                  </tbody>
                </table>
                <ul className="mt-3 space-y-0.5 text-[11px] text-muted">{result.notes.map((n) => <li key={n}>{n}</li>)}</ul>
              </div>
              <LevelLadder levels={result.levels} spot={result.spot} />
            </div>
          )}
        </Panel>
      </div>

      <Panel title="Three-point projection (A → B, retrace to C)">
        <div className="grid grid-cols-3 gap-3 sm:max-w-md">
          {(["a", "b", "c"] as const).map((k) => (
            <label key={k} className="text-xs text-muted">{k.toUpperCase()}
              <input inputMode="decimal" className={inputCls} value={abc[k]} onChange={(e) => setAbc((p) => ({ ...p, [k]: e.target.value }))} />
            </label>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-muted">Level = C + (B − A) × ratio.</p>
        {projection.error && <p role="alert" className="mt-2 text-xs text-down">{projection.error}</p>}
        {projection.levels && (
          <table className="num mt-2 w-full max-w-md text-xs">
            <tbody>{projection.levels.map((l) => <LevelRow key={l.label} l={l} interval={interval} highlight={null} />)}</tbody>
          </table>
        )}
      </Panel>
    </div>
  );
}

function Seg({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <div className="flex flex-col gap-1">
      {options.map(([v, l]) => (
        <button key={v} type="button" onClick={() => onChange(v)}
          className={`rounded-md border px-2 py-1.5 text-left ${value === v ? "border-accent text-text" : "border-line text-muted"}`}>{l}</button>
      ))}
    </div>
  );
}

function SummaryRow({ r, interval }: { r: FibResult; interval: number | null }) {
  const cell = (t: string, l: Level | null, cls: string) => (
    <div className="rounded-md bg-panel-2 p-2">
      <div className="text-[10px] uppercase text-muted">{t}</div>
      {l ? (
        <>
          <div className={`num text-sm font-semibold ${cls}`}>{l.price}</div>
          <div className="num text-[10px] text-muted">{l.kind === "extension" ? "Ext" : "Ret"} {l.label} · {l.distancePoints} pts ({l.distancePct}%)</div>
          {interval && <div className="num text-[10px] text-muted">Strikes {nearbyStrikes(l.price, interval).join(" / ")}</div>}
        </>
      ) : <div className="text-xs text-muted">{r.spot ? "None on this side" : "Enter spot"}</div>}
    </div>
  );
  return (
    <div className="grid grid-cols-3 gap-2">
      {cell("Nearest support", r.nearestSupport, "text-up")}
      <div className="rounded-md bg-panel-2 p-2">
        <div className="text-[10px] uppercase text-muted">Spot / Range</div>
        <div className="num text-sm font-semibold">{r.spot ?? "—"}</div>
        <div className="num text-[10px] text-muted">Range {r.range}</div>
      </div>
      {cell("Nearest resistance", r.nearestResistance, "text-down")}
    </div>
  );
}

function LevelRow({ l, interval, highlight }: { l: Level; interval: number | null; highlight: "S" | "R" | null }) {
  const neg = l.distancePoints?.startsWith("-");
  return (
    <tr className={`border-t border-line ${highlight ? "bg-panel-2" : ""}`}>
      <td className="py-1.5">
        <span className="text-muted">{l.kind === "retracement" ? "Ret" : l.kind === "extension" ? "Ext" : "Proj"}</span> {l.label}
        {highlight && <span className={`ml-1 text-[10px] font-bold ${highlight === "S" ? "text-up" : "text-down"}`}>{highlight}</span>}
      </td>
      <td className={Number(l.price) <= 0 ? "text-down" : ""}>{l.price}{Number(l.price) <= 0 && " (invalid)"}</td>
      <td className={`text-right ${l.distancePoints ? (neg ? "text-down" : "text-up") : "text-muted"}`}>{l.distancePoints ?? "—"}</td>
      <td className="text-right text-muted">{l.distancePct ?? "—"}</td>
      {interval && <td className="text-right text-muted">{nearbyStrikes(l.price, interval).join("/")}</td>}
    </tr>
  );
}
