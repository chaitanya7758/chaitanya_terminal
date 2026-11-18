"use client";
import { useCallback, useEffect, useState } from "react";
import { Panel } from "@/components/Panel";
import { api } from "@/lib/api";

interface KiteStatus { configured: boolean; connected: boolean; user: string | null; login_time: string | null; expires_at: string | null; checked_at: string }
const ist = (s: string | null) => s ? new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" }).format(new Date(s)) + " IST" : "—";

export default function Settings() {
  const [st, setSt] = useState<KiteStatus | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const load = useCallback(() => api<KiteStatus>("/api/kite/status").then(setSt, (e) => setErr(e.message)), []);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Connections</h1>
      <Panel title="Zerodha (read-only)">
        {err && <p className="text-sm text-down">Could not reach the server: {err}</p>}
        {!st && !err && <p className="text-sm text-muted">Checking…</p>}
        {st && !st.configured && <p className="text-sm text-warn">Zerodha API key/secret are not set on the server yet. See the setup guide.</p>}
        {st?.configured && (
          <>
            <div className="flex items-center gap-2 text-sm">
              <span className={`h-2 w-2 rounded-full ${st.connected ? "bg-up" : "bg-down"}`} />
              {st.connected ? <>Connected as <span className="num">{st.user}</span></> : "Not connected today"}
            </div>
            <dl className="mt-2 grid grid-cols-[110px_1fr] gap-y-1 text-xs text-muted">
              <dt>Logged in</dt><dd className="num">{ist(st.login_time)}</dd>
              <dt>Token expires</dt><dd className="num">{ist(st.expires_at)}</dd>
              <dt>Checked</dt><dd className="num">{ist(st.checked_at)}</dd>
            </dl>
            <div className="mt-3 flex gap-2">
              {!st.connected && <a href="/api/kite/login" className="rounded-md bg-accent px-3 py-2 text-sm font-semibold text-black">Log in with Zerodha</a>}
              {st.connected && <button onClick={() => api("/api/kite/disconnect", { method: "POST" }).then(load)} className="rounded-md border border-line px-3 py-2 text-sm">Disconnect</button>}
            </div>
            <p className="mt-3 text-[11px] text-muted">You sign in on Zerodha&apos;s own page; this app never sees your Zerodha password, PIN or TOTP. The connection lasts until about 6 AM the next day. The app never places, modifies or cancels orders.</p>
          </>
        )}
      </Panel>
    </div>
  );
}
