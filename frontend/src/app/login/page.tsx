"use client";
import { useState } from "react";
import { api } from "@/lib/api";

export default function Login() {
  const [password, setPassword] = useState("");
  const [totp, setTotp] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      await api("/api/auth/login", { method: "POST", body: JSON.stringify({ password, totp }) });
      location.href = "/";
    } catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
  };
  const cls = "w-full rounded-md border border-line bg-panel-2 px-3 py-2.5 text-base outline-none focus:border-accent";
  return (
    <form onSubmit={submit} className="mx-auto mt-10 max-w-sm space-y-3 rounded-lg border border-line bg-panel p-5">
      <div>
        <div className="text-sm font-bold tracking-wide">CHAITANYA&apos;S TERMINAL</div>
        <div className="text-[11px] text-muted">Private access</div>
      </div>
      <label className="block text-xs text-muted">Password
        <input type="password" autoComplete="current-password" className={cls} value={password} onChange={(e) => setPassword(e.target.value)} required />
      </label>
      <label className="block text-xs text-muted">6-digit authenticator code
        <input inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} className={`${cls} num tracking-widest`} value={totp} onChange={(e) => setTotp(e.target.value)} required />
      </label>
      {err && <p role="alert" className="text-xs text-down">{err}</p>}
      <button disabled={busy} className="w-full rounded-md bg-accent py-2.5 text-sm font-semibold text-black disabled:opacity-60">{busy ? "Signing in…" : "Sign in"}</button>
      <p className="text-[11px] text-muted">This is not your Zerodha login. Zerodha is connected separately through Zerodha&apos;s own page.</p>
    </form>
  );
}
