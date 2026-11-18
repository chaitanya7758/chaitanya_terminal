"use client";
import Link from "next/link";
import { useState } from "react";
import { DataStatus, type Status } from "@/components/DataStatus";
import { Panel } from "@/components/Panel";
import { useInstrument } from "@/lib/instrument";
import { useApi, fmtIST, fmtNum } from "@/lib/useApi";

interface Quote { name: string; value?: number; change?: number | null; change_pct?: number | null; market_time?: string | null; status: Status }
interface Leg { ltp: string | null; oi: number | null; volume: number | null; bid: string | null; ask: string | null; spread_pct: string | null; oi_change: number | null; positioning: string | null }
interface Contract { expiry: string; expiry_weekday: string; expiry_kind: string; lot_size: number | null; strike_interval: string | null; future: string | null; time_to_expiry: { days: number; hours: number; minutes: number }; warnings: string[] }
interface Chain {
  fetched_at: string; spot: Quote; future: Quote | null; contract: Contract; atm_strike: string; pcr: string | null; pcr_scope: string;
  max_pain: string | null; max_pain_note: string; oi_change_note: string;
  oi_concentrations: { ce: { strike: string; oi: number }[]; pe: { strike: string; oi: number }[] };
  rows: { strike: string; ce: Leg; pe: Leg }[];
}

const oiFmt = (n: number | null) => (n === null ? "—" : n >= 1e5 ? `${(n / 1e5).toFixed(1)}L` : n.toLocaleString("en-IN"));

export default function ExpiryPage() {
  const { instrument } = useInstrument();
  const [width, setWidth] = useState(10);
  const { data, error, lastOk } = useApi<Chain>(`/api/market/chain/${instrument}?width=${width}`, 15000);
  const notConnected = error?.includes("not connected") || error?.includes("TokenException");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline gap-2">
        <h1 className="text-lg font-semibold">{instrument} expiry dashboard</h1>
        <span className="text-[11px] text-muted">Refreshes every 15 s · last {fmtIST(lastOk)}</span>
      </div>

      {error && (
        <div role="status" className="rounded-md border border-warn/40 bg-warn/10 px-3 py-2 text-xs text-warn">
          {notConnected ? <>Zerodha is not connected, so no contract or chain data is shown. <Link className="underline" href="/settings">Connect</Link>.</> : <>Error: {error}</>}
          {data && " Showing the last successful refresh; it may be stale."}
        </div>
      )}

      {data && (
        <>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <Stat label="Spot" value={fmtNum(data.spot.value)} status={error ? "Delayed" : data.spot.status}
              sub={data.spot.change != null ? `${data.spot.change > 0 ? "+" : ""}${fmtNum(data.spot.change)} (${fmtNum(data.spot.change_pct)}%)` : undefined} />
            <Stat label={`Future ${data.contract.future ?? ""}`} value={fmtNum(data.future?.value)} status={data.future ? (error ? "Delayed" : data.future.status) : "Unavailable"} />
            <Stat label={`Expiry · ${data.contract.expiry_kind}`} value={`${data.contract.expiry_weekday.slice(0, 3)} ${data.contract.expiry}`}
              sub={`${data.contract.time_to_expiry.days}d ${data.contract.time_to_expiry.hours}h ${data.contract.time_to_expiry.minutes}m left`} status="Live" statusLabel="From Zerodha file" />
            <Stat label="Lot · strike step" value={`${data.contract.lot_size ?? "mixed"} · ${data.contract.strike_interval ?? "—"}`} status="Live" statusLabel="From Zerodha file" />
            <Stat label="ATM strike" value={data.atm_strike} status="Calculated" />
            <Stat label={`PCR (OI, ${data.pcr_scope})`} value={data.pcr ?? "—"} status={data.pcr ? "Calculated" : "Unavailable"} />
            <Stat label="Max Pain" value={data.max_pain ?? "—"} status={data.max_pain ? "Calculated" : "Unavailable"} sub="Not a settlement forecast" />
            <Stat label="ATM IV · Greeks" value="—" status="Unavailable" sub="Phase 2 (Black-76 estimates)" />
          </div>
          {data.contract.warnings.map((w) => <p key={w} className="text-xs text-warn">{w}</p>)}

          <Panel title="Highest open interest">
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div><div className="mb-1 text-muted">Calls (resistance zones)</div>{data.oi_concentrations.ce.map((x) => <div key={x.strike} className="num">{x.strike} · {oiFmt(x.oi)}</div>)}</div>
              <div><div className="mb-1 text-muted">Puts (support zones)</div>{data.oi_concentrations.pe.map((x) => <div key={x.strike} className="num">{x.strike} · {oiFmt(x.oi)}</div>)}</div>
            </div>
            <p className="mt-2 text-[11px] text-muted">OI concentrations show where positions sit. They do not reliably predict where the index settles.</p>
          </Panel>

          <Panel title="Option chain" right={
            <select value={width} onChange={(e) => setWidth(Number(e.target.value))} className="rounded border border-line bg-panel-2 px-1.5 py-0.5 text-xs" aria-label="Strike range">
              {[5, 10, 15, 20].map((w) => <option key={w} value={w}>ATM ±{w}</option>)}
            </select>
          }>
            <div className="-mx-3 overflow-x-auto px-3">
              <table className="num w-full min-w-[640px] text-xs">
                <thead className="text-[10px] uppercase text-muted">
                  <tr><th className="text-left">CE OI</th><th className="text-right">Spr%</th><th className="text-right">CE LTP</th><th className="px-2 text-center">Strike</th><th className="text-left">PE LTP</th><th className="text-left">Spr%</th><th className="text-right">PE OI</th></tr>
                </thead>
                <tbody>
                  {data.rows.map((r) => {
                    const atm = r.strike === data.atm_strike;
                    const itmCall = Number(r.strike) < (data.spot.value ?? 0);
                    return (
                      <tr key={r.strike} className={`border-t border-line ${atm ? "bg-accent/10" : ""}`}>
                        <td className={`py-1.5 ${itmCall ? "bg-panel-2" : ""}`}>{oiFmt(r.ce.oi)}</td>
                        <td className={`text-right text-muted ${itmCall ? "bg-panel-2" : ""}`}>{r.ce.spread_pct ?? "—"}</td>
                        <td className={`text-right ${itmCall ? "bg-panel-2" : ""}`}>{r.ce.ltp ?? "—"}</td>
                        <td className={`px-2 text-center font-semibold ${atm ? "text-accent" : ""}`}>{r.strike}</td>
                        <td className={!itmCall ? "bg-panel-2" : ""}>{r.pe.ltp ?? "—"}</td>
                        <td className={`text-muted ${!itmCall ? "bg-panel-2" : ""}`}>{r.pe.spread_pct ?? "—"}</td>
                        <td className={`text-right ${!itmCall ? "bg-panel-2" : ""}`}>{oiFmt(r.pe.oi)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-[11px] text-muted">{data.oi_change_note} {data.max_pain_note}</p>
          </Panel>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, status, sub, statusLabel }: { label: string; value: string; status: Status; sub?: string; statusLabel?: string }) {
  return (
    <div className="rounded-md border border-line bg-panel p-2.5">
      <div className="flex items-center justify-between gap-1">
        <span className="truncate text-[10px] uppercase text-muted">{label}</span>
        {statusLabel ? <span className="text-[9px] text-muted">{statusLabel}</span> : <DataStatus status={status} />}
      </div>
      <div className="num mt-1 text-base">{value}</div>
      {sub && <div className="num text-[10px] text-muted">{sub}</div>}
    </div>
  );
}
