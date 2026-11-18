import { DataStatus } from "@/components/DataStatus";
import { Panel } from "@/components/Panel";

// Stage 5 wires these to the backend feed. Until then every value is honestly Unavailable.
const PULSE: { name: string; source: string; reason: string }[] = [
  { name: "NIFTY 50", source: "Zerodha Kite (NSE)", reason: "Zerodha not connected" },
  { name: "SENSEX", source: "Zerodha Kite (BSE)", reason: "Zerodha not connected" },
  { name: "BANK NIFTY", source: "Zerodha Kite (NSE)", reason: "Zerodha not connected" },
  { name: "India VIX", source: "Zerodha Kite (NSE)", reason: "Zerodha not connected" },
  { name: "GIFT NIFTY", source: "Manual entry (no licensed feed chosen)", reason: "No source configured" },
  { name: "Brent crude", source: "External provider (to be chosen)", reason: "No source configured" },
  { name: "USD/INR", source: "External provider (to be chosen)", reason: "No source configured" },
  { name: "Dow Jones", source: "External provider (to be chosen)", reason: "No source configured" },
  { name: "S&P 500", source: "External provider (to be chosen)", reason: "No source configured" },
  { name: "Nasdaq", source: "External provider (to be chosen)", reason: "No source configured" },
  { name: "FII/DII flows", source: "NSE provisional data (manual entry)", reason: "No source configured" },
];

export default function Home() {
  return (
    <div className="space-y-4">
      <Panel title="Live Market Pulse" right={<span className="text-[10px] text-muted">Times in IST</span>}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {PULSE.map((p) => (
            <div key={p.name} className="rounded-md border border-line bg-panel-2 p-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold">{p.name}</span>
                <DataStatus status="Unavailable" />
              </div>
              <div className="num mt-1.5 text-lg text-muted">—</div>
              <div className="mt-1 text-[10px] leading-tight text-muted">{p.reason}</div>
              <div className="mt-0.5 truncate text-[10px] leading-tight text-muted" title={p.source}>Source: {p.source}</div>
            </div>
          ))}
        </div>
      </Panel>
      <p className="text-xs text-muted">
        No market values are shown until a real data source is connected. Values will carry source, market timestamp, last refresh and status.
      </p>
    </div>
  );
}
