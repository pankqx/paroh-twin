// "What changed": after a fact is approved, record how the twin's numbers moved so the Twin page
// can show the student exactly how their data changed the dashboard. Kept in localStorage.

import type { Fact, TwinState } from "@/lib/types";

const KEY = "paroh-last-changes";

export interface Snapshot {
  twin: TwinState;
  tasks: number;
  goals: number;
  habits: number;
  facts: number;
}

export interface Change {
  at: string;
  fact: string;
  kind: Fact["kind"];
  lines: string[];
}

const pct = (v: number) => `${Math.round(v * 100)}%`;
const DOMAIN: Record<string, string> = { tasks: "Tasks", habits: "Habits", routines: "Routines", mood: "Energy", goals: "Goals", planner: "Planner" };

export function describeChange(fact: Fact, before: Snapshot, after: Snapshot): Change {
  const lines: string[] = [];
  lines.push(`Stars: ${before.facts} → ${after.facts} approved facts`);
  if (after.tasks > before.tasks) lines.push(`New task in the planner (due this week unless you gave a date)`);
  if (after.goals > before.goals) lines.push(`New goal added`);
  if (after.habits > before.habits) lines.push(`New habit to track in Rhythm`);
  if (Math.round(after.twin.loadPct) !== Math.round(before.twin.loadPct)) lines.push(`Weekly load ${Math.round(before.twin.loadPct)}% → ${Math.round(after.twin.loadPct)}%`);
  for (const [d, label] of Object.entries(DOMAIN)) {
    const a = before.twin.confidenceByDomain[d] ?? 0;
    const b = after.twin.confidenceByDomain[d] ?? 0;
    if (Math.round(b * 100) !== Math.round(a * 100)) lines.push(`How well she knows your ${label.toLowerCase()}: ${pct(a)} → ${pct(b)}`);
  }
  return { at: new Date().toISOString(), fact: fact.text, kind: fact.kind, lines };
}

export function recordChange(c: Change) {
  try {
    const list: Change[] = JSON.parse(window.localStorage.getItem(KEY) ?? "[]");
    window.localStorage.setItem(KEY, JSON.stringify([c, ...list].slice(0, 5)));
  } catch {
    /* storage unavailable */
  }
}

export function readChanges(): Change[] {
  try {
    return JSON.parse(window.localStorage.getItem(KEY) ?? "[]") as Change[];
  } catch {
    return [];
  }
}

export function clearChanges() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
