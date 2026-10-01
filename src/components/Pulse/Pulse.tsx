"use client";

// Pulse: the twin keeps an eye on Frank's data while this tab is open and whispers when something
// needs attention (load spikes, deadline risk from the TypeScript simulation, streaks at risk).
// Monitoring runs on sample data; real continuous monitoring needs the connectors (roadmap).

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useState } from "react";
import { dataService } from "@/app/dataService";
import { FACTS_CHANGED } from "@/components/shell/events";
import * as speech from "@/lib/voice/speak";
import { pulseWhispers } from "@/lib/twin/pulseWhispers";
import { simulate } from "@/lib/twin/scenarios";
import type { Habit, Task } from "@/lib/types";
import type { TwinState, Whisper } from "@/lib/types";
import "./Pulse.css";

const SCAN_MS = 30000;

/** Calm, informational whispers for the week ahead (the engine only raises risky ones). */
function calmWhispers(tasks: Task[], habits: Habit[], raised: Whisper[]): Whisper[] {
  const now = Date.now();
  const out: Whisper[] = [];
  const seen = new Set(raised.map((w) => String(w.data.taskId ?? "")));
  const data = { tasks, goals: [], habits, checkins: [], decisions: [], now: new Date(now).toISOString() };
  const upcoming = tasks
    .filter((t) => !t.done && t.dueAt && new Date(t.dueAt).getTime() > now && new Date(t.dueAt).getTime() < now + 7 * 86400000 && !seen.has(t.id))
    .sort((a, b) => (a.dueAt ?? "").localeCompare(b.dueAt ?? ""))
    .slice(0, 3);
  for (const t of upcoming) {
    const r = simulate({ id: `calm-${t.id}`, label: t.title, summary: t.title, priority: "deadline", tasks: [{ taskId: t.id, title: t.title, hours: t.estHours, dueAt: t.dueAt, goalId: t.goalId }] }, data);
    if (r.needsInfo) continue;
    const days = Math.max(0, Math.ceil((new Date(t.dueAt!).getTime() - now) / 86400000));
    out.push({ id: `calm-${t.id}`, severity: "info", kind: "deadline", text: `${t.title} is due in ${days} day${days === 1 ? "" : "s"}. On track with your usual pace.`, data: { taskId: t.id, onTimeProb: r.onTimeProb } });
  }
  const today = new Date(now).toISOString().slice(0, 10);
  for (const h of habits.filter((h) => h.log[today]).slice(0, 2)) {
    out.push({ id: `calm-habit-${h.id}`, severity: "info", kind: "habit", text: `${h.title} is done for today. Nice, the streak lives on.`, data: { habitId: h.id } });
  }
  return out;
}
const SEV = { act: "Act now", watch: "Watch", info: "Good to know" } as const;
const ICON: Record<Whisper["kind"], string> = { load: "◔", deadline: "⏳", streak: "🔥", habit: "✓" };

function whatIf(w: Whisper, titles: Record<string, string>): string {
  if (w.kind === "deadline") return `What if I start ${titles[String(w.data.taskId)] ?? "the next deadline"} tonight?`;
  if (w.kind === "load") return "What if I move one task to next week?";
  return "What if I skip my habit tonight to study?";
}

export default function Pulse() {
  const [whispers, setWhispers] = useState<Whisper[] | null>(null);
  const [notes, setNotes] = useState<string[]>([]);
  const [needs, setNeeds] = useState<string[]>([]);
  const [twin, setTwin] = useState<TwinState | null>(null);
  const [scanning, setScanning] = useState(false);
  const [last, setLast] = useState("");
  const [hidden, setHidden] = useState<string[]>([]);
  const [count, setCount] = useState(0);
  const [titles, setTitles] = useState<Record<string, string>>({});

  const scan = useCallback(async () => {
    setScanning(true);
    const [t, tasks, habits, ins, need] = await Promise.all([
      dataService.getTwinState(),
      dataService.tasks.list(),
      dataService.habits.list(),
      dataService.insights().catch(() => [] as string[]),
      dataService.predictedNeeds().catch(() => [] as string[]),
    ]);
    // A short pause so the scan is visible; the work itself is instant TypeScript.
    await new Promise((r) => setTimeout(r, 900));
    const order = { act: 0, watch: 1, info: 2 };
    const raised = pulseWhispers(t, tasks, habits);
    setWhispers([...raised, ...calmWhispers(tasks, habits, raised)].sort((a, b) => order[a.severity] - order[b.severity]));
    setTwin(t);
    setTitles(Object.fromEntries(tasks.map((x) => [x.id, x.title])));
    setNotes(ins);
    setNeeds(need);
    setLast(new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    setCount((c) => c + 1);
    setScanning(false);
  }, []);

  useEffect(() => {
    scan();
    const id = window.setInterval(scan, SCAN_MS);
    const again = () => scan();
    window.addEventListener(FACTS_CHANGED, again);
    return () => {
      window.clearInterval(id);
      window.removeEventListener(FACTS_CHANGED, again);
    };
  }, [scan]);

  const visible = (whispers ?? []).filter((w) => !hidden.includes(w.id));

  return (
    <main className="page pulse">
      <header className="pu-head">
        <div>
          <p className="pu-eyebrow">Pulse · monitoring sample data while this tab is open</p>
          <h1>Your twin is watching the week</h1>
          <p className="pu-lede">
            Every 30 seconds it re-checks load, deadlines and streaks with the same simulation as Ask, and whispers only when something needs you.
          </p>
        </div>
        <div className={`pu-radar${scanning ? " on" : ""}`} aria-hidden="true">
          <svg viewBox="-60 -60 120 120">
            {[20, 38, 56].map((r) => (
              <circle key={r} r={r} className="pu-ring" />
            ))}
            <g className="pu-sweep">
              <path d="M0 0 L56 0 A56 56 0 0 0 39.6 -39.6 Z" />
            </g>
            {visible.slice(0, 6).map((w, i) => {
              const a = (i / 6) * Math.PI * 2 + 0.6;
              const r = w.severity === "act" ? 18 : w.severity === "watch" ? 34 : 48;
              return <circle key={w.id} cx={Math.cos(a) * r} cy={Math.sin(a) * r} r="3.4" className={`pu-blip ${w.severity}`} />;
            })}
          </svg>
        </div>
      </header>

      <div className="pu-bar">
        <span className={`pu-live${scanning ? " scanning" : ""}`}>{scanning ? "Scanning…" : `Last scan ${last || "…"}`}</span>
        <span>
          scans this session <b className="num">{count}</b>
        </span>
        {twin && (
          <span>
            load <b className="num">{Math.round(twin.loadPct)}%</b> · fidelity <b className="num">{Math.round(twin.fidelity * 100)}%</b>
          </span>
        )}
        <button type="button" className="btn-ghost btn-small" onClick={scan} disabled={scanning}>
          Scan now
        </button>
      </div>

      <div className="pu-grid">
        <section aria-label="Whispers" className="pu-feed">
          <h2>Whispers</h2>
          {whispers === null ? (
            <p className="pu-empty">Listening to the week…</p>
          ) : visible.length === 0 ? (
            <p className="pu-empty">All calm. Nothing needs you right now.</p>
          ) : (
            <ul>
              <AnimatePresence initial={false}>
                {visible.map((w, i) => (
                  <motion.li
                    key={w.id}
                    layout
                    className={`glass pu-card ${w.severity}`}
                    initial={{ opacity: 0, x: -24 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 40 }}
                    transition={{ delay: i * 0.06, type: "spring", stiffness: 260, damping: 24 }}
                  >
                    <span className="pu-icon" aria-hidden="true">
                      {ICON[w.kind]}
                    </span>
                    <div className="pu-body">
                      <span className="pu-sev">{SEV[w.severity]}</span>
                      <p>{w.text}</p>
                      {typeof w.data.onTimeProb === "number" && (
                        <div className="pu-prob" aria-label={`${Math.round((w.data.onTimeProb as number) * 100)} percent chance of finishing on time`}>
                          <i style={{ transform: `scaleX(${w.data.onTimeProb as number})` }} />
                          <span>{Math.round((w.data.onTimeProb as number) * 100)}% on time</span>
                        </div>
                      )}
                      <div className="pu-actions">
                        <Link className="btn-ghost btn-small" href={`/ask?q=${encodeURIComponent(whatIf(w, titles))}`}>
                          Turn into a what-if
                        </Link>
                        <button type="button" className="btn-ghost btn-small" onClick={() => { speech.setEnabled(true); speech.speak(w.text); }}>
                          Say it
                        </button>
                        <button type="button" className="pu-x" onClick={() => setHidden((h) => [...h, w.id])} aria-label="Dismiss">
                          ✕
                        </button>
                      </div>
                    </div>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          )}
        </section>

        <aside className="pu-side">
          <section className="glass pu-panel" style={{ ["--glass-accent" as string]: "var(--violet)" }}>
            <h2>What the twin noticed</h2>
            <ul>
              {notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </section>
          <section className="glass pu-panel" style={{ ["--glass-accent" as string]: "var(--teal)" }}>
            <h2>Tomorrow you will probably need</h2>
            {needs.length ? (
              <ul>
                {needs.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            ) : (
              <p className="pu-empty">Nothing special predicted for tomorrow.</p>
            )}
          </section>
          <p className="pu-honest">
            Runs only while Paroh is open, on sample data. Real always-on monitoring needs the Gmail, Calendar and chat connectors (roadmap).
          </p>
        </aside>
      </div>
    </main>
  );
}
