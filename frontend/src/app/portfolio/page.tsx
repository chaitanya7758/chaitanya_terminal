"use client";
import Link from "next/link";
import { Panel } from "@/components/Panel";
import { useApi, fmtIST } from "@/lib/useApi";

interface Pos { symbol: string; product: string; type: string | null; strike: string | null; expiry: string | null; quantity: number; average_price: string; last_price: string; realised: string; unrealised: string; pnl: string; status: string }
interface Portfolio {
  source: string; fetched_at: string; positions: Pos[]; open_count: number;
  totals: { pnl: string; realised: string; unrealised: string };
  margins: { available: string | null; utilised: string | null; utilisation_pct: string | null; span: string | null; exposure: string | null; option_premium: string | null };
  expiry_concentration: { expiry: string; abs_quantity: string }[];
  hedge_coverage: { underlying: string; expiry: string; side: string; short_qty: number; long_qty: number; coverage_pct: string }[];
  hedge_note: string;
  reconciliation: { ok: boolean; mismatches: { symbol: string; zerodha_unrealised: string; recomputed: string }[]; note: string };
}

const inr = (s: string | null | undefined) => (s == null ? "—" : `₹${Number(s).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
const tone = (s: string) => (Number(s) > 0 ? "text-up" : Number(s) < 0 ? "text-down" : "text-muted");

export default function PortfolioPage() {
  const { data, error, lastOk } = useApi<Portfolio>("/api/portfolio", 10000);
  const notConnected = error?.includes("not connected") || error?.includes("TokenException");
  const util = data?.margins.utilisation_pct ? Number(data.margins.utilisation_pct) : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline gap-2">
        <h1 className="text-lg font-semibold">Portfolio</h1>
        <span className="text-[11px] text-muted">Zerodha figures · refreshes every 10 s · last {fmtIST(lastOk)}</span>
      </div>

      {error && (
        <div role="status" className="rounded-md border border-warn/40 bg-warn/10 px-3 py-2 text-xs text-warn">
          {notConnected ? <>Zerodha is not connected, so no positions are shown. <Link className="underline" href="/settings">Connect</Link>.</> : <>Error: {error}</>}
          {data && " Showing the last successful refresh; it may be stale."}
        </div>
      )}

      {data && (
        <>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <Tile label="Total P&L today" value={inr(data.totals.pnl)} cls={tone(data.totals.pnl)} />
            <Tile label="Unrealised" value={inr(data.totals.unrealised)} cls={tone(data.totals.unrealised)} />
            <Tile label="Realised" value={inr(data.totals.realised)} cls={tone(data.totals.realised)} />
            <Tile label="Open positions" value={String(data.open_count)} />
            <Tile label="Available margin" value={inr(data.margins.available)} />
            <Tile label="Utilised margin" value={inr(data.margins.utilised)} />
            <Tile label="Margin utilisation" value={util === null ? "—" : `${util}%`} cls={util !== null && util >= 80 ? "text-down" : util !== null && util >= 60 ? "text-warn" : ""} />
            <Tile label="SPAN · exposure" value={`${inr(data.margins.span)} · ${inr(data.margins.exposure)}`} small />
          </div>

          {!data.reconciliation.ok && (
            <div role="alert" className="rounded-md border border-down/40 bg-down/10 px-3 py-2 text-xs text-down">
              Reconciliation mismatch on {data.reconciliation.mismatches.map((m) => `${m.symbol} (Zerodha ${m.zerodha_unrealised}, recomputed ${m.recomputed})`).join("; ")}. Zerodha&apos;s figures are shown; check in Kite.
            </div>
          )}

          <Panel title={`Positions (${data.positions.length})`}>
            {data.positions.length === 0 ? (
              <p className="text-sm text-muted">Zerodha reports no positions today.</p>
            ) : (
              <div className="-mx-3 overflow-x-auto px-3">
                <table className="num w-full min-w-[620px] text-xs">
                  <thead className="text-left text-[10px] uppercase text-muted">
                    <tr><th className="py-1">Instrument</th><th>Expiry</th><th className="text-right">Qty</th><th className="text-right">Avg</th><th className="text-right">LTP</th><th className="text-right">Unreal.</th><th className="text-right">Real.</th><th className="text-right">P&L</th></tr>
                  </thead>
                  <tbody>
                    {data.positions.map((p) => (
                      <tr key={p.symbol + p.product} className={`border-t border-line ${p.quantity ? "" : "text-muted"}`}>
                        <td className="py-1.5">{p.symbol}<span className="ml-1 text-[10px] text-muted">{p.product}</span></td>
                        <td>{p.expiry ?? "—"}</td>
                        <td className={`text-right ${p.quantity < 0 ? "text-down" : ""}`}>{p.quantity}</td>
                        <td className="text-right">{p.average_price}</td>
                        <td className="text-right">{p.last_price}</td>
                        <td className={`text-right ${tone(p.unrealised)}`}>{p.unrealised}</td>
                        <td className={`text-right ${tone(p.realised)}`}>{p.realised}</td>
                        <td className={`text-right font-semibold ${tone(p.pnl)}`}>{p.pnl}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <div className="grid gap-4 md:grid-cols-2">
            <Panel title="Hedge coverage">
              {data.hedge_coverage.length === 0 ? <p className="text-sm text-muted">No short options.</p> : (
                <ul className="space-y-1 text-xs">
                  {data.hedge_coverage.map((h) => (
                    <li key={h.underlying + h.expiry + h.side} className="flex justify-between gap-2">
                      <span>{h.underlying} {h.expiry} {h.side}: short {h.short_qty}, long {h.long_qty}</span>
                      <span className={`num font-semibold ${Number(h.coverage_pct) < 100 ? "text-warn" : "text-up"}`}>{h.coverage_pct}%</span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-2 text-[11px] text-muted">{data.hedge_note}</p>
            </Panel>
            <Panel title="Expiry concentration">
              {data.expiry_concentration.length === 0 ? <p className="text-sm text-muted">No open derivative positions.</p> : (
                <ul className="num space-y-1 text-xs">{data.expiry_concentration.map((e) => <li key={e.expiry}>{e.expiry}: {e.abs_quantity} qty (absolute)</li>)}</ul>
              )}
            </Panel>
          </div>
          <p className="text-[11px] text-muted">Source: {data.source}, fetched {fmtIST(data.fetched_at)}. {data.reconciliation.note} Portfolio Greeks arrive in Phase 2 and will be labelled Estimated.</p>
        </>
      )}
    </div>
  );
}

function Tile({ label, value, cls = "", small = false }: { label: string; value: string; cls?: string; small?: boolean }) {
  return (
    <div className="rounded-md border border-line bg-panel p-2.5">
      <div className="text-[10px] uppercase text-muted">{label}</div>
      <div className={`num mt-1 ${small ? "text-xs" : "text-base"} ${cls}`}>{value}</div>
    </div>
  );
}
