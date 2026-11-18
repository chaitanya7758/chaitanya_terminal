"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Panel } from "@/components/Panel";
import { SUMMARY_FIELDS, compareField, parseSummary, type ParsedSummary } from "@/lib/snapshot";
import { getRecord, loadAll, saveRecord, type AnalysisRecord } from "@/lib/aiStore";

const AGREE_LABEL = { same: "Same", different: "Differs, judge yourself", "one-missing": "Only one answered", "both-missing": "Neither answered" } as const;
const AGREE_CLS = { same: "text-up", different: "text-warn", "one-missing": "text-muted", "both-missing": "text-muted" } as const;

function Compare() {
  const params = useSearchParams();
  const [rec, setRec] = useState<AnalysisRecord | null>(null);
  const [ids, setIds] = useState<string[]>([]);

  useEffect(() => {
    setIds(loadAll().map((r) => r.snapshot.id));
    const id = params.get("id");
    setRec((id && getRecord(id)) || loadAll()[0] || null);
  }, [params]);

  const update = (patch: Partial<AnalysisRecord>) => {
    if (!rec) return;
    const next = { ...rec, ...patch };
    setRec(next);
    saveRecord(next);
  };

  const parsed = useMemo(() => ({
    claude: parseSummary(rec?.responses.claude ?? ""),
    chatgpt: parseSummary(rec?.responses.chatgpt ?? ""),
  }), [rec]);

  if (!rec) return <Panel title="Claude vs ChatGPT"><p className="text-sm text-muted">No snapshot yet. Build one in the AI Analysis Centre first.</p></Panel>;

  const idWarn = (p: ParsedSummary, name: string) =>
    p.found && p.snapshotId && p.snapshotId !== rec.snapshot.id
      ? <p className="text-[11px] text-down">{name}&apos;s reply references snapshot {p.snapshotId}, not {rec.snapshot.id}.</p>
      : !p.found && (name === "Claude" ? rec.responses.claude : rec.responses.chatgpt)
        ? <p className="text-[11px] text-warn">No ct-summary block found in {name}&apos;s reply, so it can&apos;t be compared field by field.</p>
        : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-lg font-semibold">Claude vs ChatGPT</h1>
        <select value={rec.snapshot.id} onChange={(e) => setRec(getRecord(e.target.value) ?? rec)}
          className="num rounded-md border border-line bg-panel-2 px-2 py-1 text-xs">
          {ids.map((i) => <option key={i}>{i}</option>)}
        </select>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {(["claude", "chatgpt"] as const).map((k) => (
          <Panel key={k} title={k === "claude" ? "Claude's reply" : "ChatGPT's reply"}>
            <textarea value={rec.responses[k]} rows={10} placeholder="Paste the full reply here"
              onChange={(e) => update({ responses: { ...rec.responses, [k]: e.target.value } })}
              className="w-full rounded-md border border-line bg-panel-2 p-2 text-xs text-text outline-none focus:border-accent" />
            {idWarn(parsed[k], k === "claude" ? "Claude" : "ChatGPT")}
          </Panel>
        ))}
      </div>

      <Panel title="Field-by-field comparison">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-xs">
            <thead className="text-left text-[10px] uppercase text-muted">
              <tr><th className="py-1">Field</th><th>Claude</th><th>ChatGPT</th><th>Match</th></tr>
            </thead>
            <tbody>
              {SUMMARY_FIELDS.map(([k, label]) => {
                const a = parsed.claude.fields[k], b = parsed.chatgpt.fields[k];
                const agr = compareField(k, a, b);
                return (
                  <tr key={k} className="border-t border-line align-top">
                    <td className="py-1.5 pr-2 font-semibold">{label}</td>
                    <td className="pr-2">{a ?? <span className="text-muted">not provided</span>}</td>
                    <td className="pr-2">{b ?? <span className="text-muted">not provided</span>}</td>
                    <td className={AGREE_CLS[agr]}>{AGREE_LABEL[agr]}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[11px] text-muted">&quot;Same&quot; means the text matches (bias fields: the first word). Everything else is shown as-is for you to judge; no agreement is inferred.</p>
      </Panel>

      <Panel title="Your trading thesis">
        {rec.thesisSavedAt ? (
          <>
            <p className="whitespace-pre-wrap text-sm">{rec.thesis}</p>
            <p className="mt-1 text-[11px] text-muted">Saved {rec.thesisSavedAt}. Locked so it can be compared honestly with the outcome later.</p>
          </>
        ) : (
          <>
            <textarea rows={4} value={rec.thesis} onChange={(e) => update({ thesis: e.target.value })}
              className="w-full rounded-md border border-line bg-panel-2 p-2 text-sm text-text outline-none focus:border-accent" />
            <button disabled={!rec.thesis.trim()} onClick={() => update({ thesisSavedAt: new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" }).format(new Date()) + " IST" })}
              className="mt-2 rounded-md bg-accent px-3 py-2 text-sm font-semibold text-black disabled:opacity-50">Save and lock thesis</button>
          </>
        )}
        <label className="mt-3 block text-xs text-muted">Verified outcome (fill in after the session, from actual closing data)
          <textarea rows={2} value={rec.outcome} onChange={(e) => update({ outcome: e.target.value })}
            className="mt-1 w-full rounded-md border border-line bg-panel-2 p-2 text-sm text-text outline-none focus:border-accent" />
        </label>
      </Panel>
    </div>
  );
}

export default function Page() {
  return <Suspense fallback={null}><Compare /></Suspense>;
}
