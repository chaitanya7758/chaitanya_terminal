"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "./api";

/** Polls an API path. Keeps the last good data but always exposes the error and when it last succeeded. */
export function useApi<T>(path: string | null, intervalMs = 0) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastOk, setLastOk] = useState<Date | null>(null);
  const load = useCallback(async () => {
    if (!path) return;
    try { setData(await api<T>(path)); setError(null); setLastOk(new Date()); }
    catch (e) { setError((e as Error).message); }
  }, [path]);
  useEffect(() => {
    setData(null); setError(null); setLastOk(null);
    load();
    if (!intervalMs) return;
    const t = setInterval(() => { if (document.visibilityState === "visible") load(); }, intervalMs);
    return () => clearInterval(t);
  }, [load, intervalMs]);
  return { data, error, lastOk, reload: load };
}

export const fmtIST = (d: Date | string | null) =>
  d ? new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(new Date(d)) + " IST" : "—";
export const fmtNum = (n: number | null | undefined, dp = 2) =>
  n === null || n === undefined ? "—" : n.toLocaleString("en-IN", { minimumFractionDigits: dp, maximumFractionDigits: dp });
