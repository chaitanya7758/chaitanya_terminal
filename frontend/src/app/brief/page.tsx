"use client";
import { useState } from "react";
import { Panel } from "@/components/Panel";
import { DataStatus, type Status } from "@/components/DataStatus";
import { api } from "@/lib/api";
import { useApi, fmtIST } from "@/lib/useApi";

interface Point { n: number; topic: string; text: string | null; status: Status; source_name: string | null; source_url: string | null; as_of: string | null }
interface Brief { header: string; day: string; session: { trading_day: boolean; reason: string | null; next_session: string; holiday_check?: string }; points: Point[]; summary: string | null; text: string; note: string; generated_at: string }

const PROMPT = "Interpret this sourced market brief for an Indian index-options seller (NIFTY/SENSEX). Biggest risks first. Treat UNAVAILABLE items as unknown; do not fill them in. State uncertainty. No guarantees.\n\n";
const field = "w-full rounded-md border border-line bg-panel-2 px-2 py-1.5 text-sm text-text outline-none focus:border-accent";

export default function BriefPage() {
  const { data, error, reload } = useApi<Brief>("/api/brief");
  const [editing, setEditing] = useState<number | null>(null);
  const [form, setForm] = useState({ text: "", source_name: "", source_url: "", as_of: "" });
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const open = (n: number, p?: Point) => {
    setEditing(n); setErr(null);
    setForm({ text: p?.status === "Manual" ? p.text ?? "" : "", source_name: p?.status === "Manual" ? p.source_name ?? "" : "", source_url: p?.status === "Manual" ? p.source_url ?? "" : "", as_of: "" });
  };
  const save = async () => {
    if (!data || editing === null) return;
    try {
      await api("/api/brief/item", { method: "POST", body: JSON.stringify({ day: data.day, slot: editing, ...form }) });
      setEditing(null); reload();
    } catch (e) { setErr((e as Error).message); }
  };
  const copy = () => data && navigator.clipboard?.writeText(PROMPT + data.text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });

  const editor = (summary = false) => (
    <div className="mt-2 space-y-2 rounded-md border border-line p-2">
      <textarea rows={2} className={field} placeholder={summary ? "One sentence: bullish, bearish or mixed cues" : "Factual statement with numbers"} value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} />
      {!summary && (
        <div className="grid gap-2 sm:grid-cols-3">
          <input className={field} placeholder="Source (e.g. Reuters)" value={form.source_name} onChange={(e) => setForm({ ...form, source_name: e.target.value })} />
          <input className={field} placeholder="https:// link" value={form.source_url} onChange={(e) => setForm({ ...form, source_url: e.target.value })} />
          <input className={field} placeholder="As of (e.g. 07:45 IST)" value={form.as_of} onChange={(e) => setForm({ ...form, as_of: e.target.value })} />
        </div>
      )}
      {err && <p className="text-xs text-down">{err}</p>}
      <div className="flex gap-2">
        <button onClick={save} className="rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-black">Save</button>
        <button onClick={() => setEditing(null)} className="rounded-md border border-line px-3 py-1.5 text-xs">Cancel</button>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-down">Could not load the brief: {error}</p>}
      {data && (
        <Panel title={data.header} right={<span className="num text-[11px] text-muted">{data.day}</span>}>
          {!data.session.trading_day && (
            <p className="mb-2 rounded-md bg-warn/10 px-2 py-1.5 text-xs text-warn">Non-trading day ({data.session.reason}). Next session: {data.session.next_session}.</p>
          )}
          <ol className="space-y-2">
            {data.points.map((p) => (
              <li key={p.n} className="border-b border-line pb-2 last:border-0">
                <div className="flex items-start gap-2">
                  <span className="num w-5 shrink-0 text-sm font-semibold text-accent">{p.n}.</span>
                  <div className="flex-1">
                    {p.text ? <p className="text-sm">{p.text}</p> : <p className="text-sm text-muted">{p.topic}: unavailable</p>}
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[10px] text-muted">
                      <DataStatus status={p.status} />
                      {p.source_name && (p.source_url ? <a className="underline" href={p.source_url} target="_blank" rel="noopener noreferrer">{p.source_name}</a> : <span>{p.source_name}</span>)}
                      {p.as_of && <span>{p.as_of}</span>}
                      <button onClick={() => open(p.n, p)} className="ml-auto text-accent">{p.status === "Manual" ? "Edit" : "Add"}</button>
                    </div>
                    {editing === p.n && editor()}
                  </div>
                </div>
              </li>
            ))}
          </ol>
          <div className="mt-3 border-t border-line pt-2">
            <p className={`text-sm ${data.summary ? "font-semibold" : "text-muted"}`}>{data.summary ?? "Closing summary sentence not written yet."}</p>
            <button onClick={() => open(11)} className="mt-1 text-[11px] text-accent">{data.summary ? "Edit summary" : "Write summary"}</button>
            {editing === 11 && editor(true)}
          </div>
        </Panel>
      )}
      {data && (
        <div className="grid gap-2 sm:grid-cols-2">
          <a href="https://claude.ai/" target="_blank" rel="noopener noreferrer" onClick={copy} className="rounded-md border border-line bg-panel px-3 py-3 text-center text-sm font-semibold">Copy brief + open Claude</a>
          <a href="https://chatgpt.com/" target="_blank" rel="noopener noreferrer" onClick={copy} className="rounded-md border border-line bg-panel px-3 py-3 text-center text-sm font-semibold">Copy brief + open ChatGPT</a>
        </div>
      )}
      {copied && <p className="text-xs text-up">Copied. Paste it into a new chat. Nothing is sent automatically.</p>}
      {data && <p className="text-[11px] text-muted">{data.note} Assembled {fmtIST(data.generated_at)}. {data.session.holiday_check ?? ""} The automatic 8:00 AM snapshot comes with deployment.</p>}
    </div>
  );
}
