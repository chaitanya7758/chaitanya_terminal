"use client";
import type { Snapshot } from "./snapshot";

/** Per-device storage until the backend database is connected (stage 3+). */
export interface AnalysisRecord {
  snapshot: Snapshot;
  prompt: string;
  responses: { claude: string; chatgpt: string };
  thesis: string;
  thesisSavedAt: string | null;
  outcome: string;
}

const KEY = "ct:analyses";

export function loadAll(): AnalysisRecord[] {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
}
export function saveRecord(r: AnalysisRecord) {
  const all = loadAll().filter((x) => x.snapshot.id !== r.snapshot.id);
  all.unshift(r);
  try { localStorage.setItem(KEY, JSON.stringify(all.slice(0, 200))); } catch {}
}
export function getRecord(id: string): AnalysisRecord | undefined {
  return loadAll().find((x) => x.snapshot.id === id);
}
