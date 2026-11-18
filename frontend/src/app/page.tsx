"use client";
import Link from "next/link";
import { DataStatus, type Status } from "@/components/DataStatus";
import { Panel } from "@/components/Panel";
import { useApi, fmtIST, fmtNum } from "@/lib/useApi";

interface Item { name: string; value?: number; change?: number | null; change_pct?: number | null; market_time?: string | null; status: Status; source: string; reason?: string }
interface Pulse { fetched_at: string; items: Item[] }

// Not provided by Zerodha. Shown honestly until a source is configured.
const OTHER: { name: string; source: string }[] = [
  { name: "GIFT NIFTY", source: "Manual entry (no licensed feed chosen)" },
  { name: "Brent crude", source: "Free provider (to be wired)" },
  { name: "USD/INR", source: "Free provider (to be wired)" },
  { name: "Dow Jones", source: "Free provider (to be wired)" },
  { name: "S&P 500", source: "Free provider (to be wired)" },
  { name: "Nasdaq", source: "Free provider (to be wired)" },
  { name: "FII/DII flows", source: "NSE provisional data (manual entry)" },
];
const ZERODHA = ["NIFTY 50", "SENSEX", "BANK NIFTY", "India VIX"];

function Card({ it }: { it: Item }) {
  const up = (it.change ?? 0) > 0, down = (it.change ?? 0) < 0;
  const has = it.value !== undefined && it.value !== null && it.status !== "Unavailable";
  return (
    <div className="rounded-md border border-line bg-panel-2 p-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold">{it.name}</span>
        <DataStatus status={it.status} />
      </div>
      <div className={`num mt-1.5 text-lg ${has ? "" : "text-muted"}`}>{has ? fmtNum(it.value) : "—"}</div>
      {has && it.change != null && (
        <div className={`num text-xs ${up ? "text-up" : down ? "text-down" : "text-muted"}`}>
          {up ? "+" : ""}{fmtNum(it.change)} ({up ? "+" : ""}{fmtNum(it.change_pct)}%)
        </div>
      )}
      {it.reason && <div className="mt-1 text-[10px] leading-tight text-muted">{it.reason}</div>}
      {it.market_time && <div className="mt-1 text-[10px] text-muted">Market time {fmtIST(it.market_time)}</div>}
      <div className="mt-0.5 truncate text-[10px] text-muted" title={it.source}>Source: {it.source}</div>
    </div>
  );
}

export default function Home() {
  const { data, error, lastOk } = useApi<Pulse>("/api/market/pulse", 5000);
  const notConnected = error?.includes("not connected") || error?.includes("Zerodha error");
  const zItems: Item[] = data?.items ?? ZERODHA.map((name) => ({ name, status: "Unavailable", source: "Zerodha Kite", reason: notConnected ? "Zerodha not connected" : error ? "Feed error" : "Loading" }));
  return (
    <div className="space-y-4">
      {error && (
        <div role="status" className="rounded-md border border-warn/40 bg-warn/10 px-3 py-2 text-xs text-warn">
          {notConnected ? <>Zerodha is not connected. <Link className="underline" href="/settings">Connect now</Link>.</> : <>Live feed error: {error}.</>}
          {data && " Values below are from the last successful refresh and may be stale."}
        </div>
      )}
      <Panel title="Live Market Pulse" right={<span className="text-[10px] text-muted">Last refresh {fmtIST(lastOk)}</span>}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {zItems.map((it) => <Card key={it.name} it={error && data ? { ...it, status: "Delayed" } : it} />)}
          {OTHER.map((o) => <Card key={o.name} it={{ name: o.name, status: "Unavailable", source: o.source, reason: "No source configured yet" }} />)}
        </div>
      </Panel>
    </div>
  );
}
