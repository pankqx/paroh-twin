"use client";

// Rhythm: habits, mood/energy check-ins and task estimates, the data the twin uses to tailor its
// questions and plans. Everything reads and writes through DataService. Mood and energy are a 1-5
// planning check-in only.

import { useCallback, useEffect, useState } from "react";
import { motion } from "motion/react";
import { dataService } from "@/app/dataService";
import { notifyFactsChanged } from "@/components/shell/events";
import Ring from "@/components/Ring/Ring";
import { estimationBias } from "@/lib/twin";
import type { Category, CheckIn, ConsentSettings, Habit, Level, Task } from "@/lib/types";
import "./Rhythm.css";

const DAY = 86400000;
const key = (t: number) => new Date(t).toISOString().slice(0, 10);
const nowIso = () => new Date().toISOString();
const short = (k: string) => new Date(`${k}T12:00:00`).toLocaleDateString("en-IN", { weekday: "narrow" });

function streak(h: Habit, today: number) {
  let n = 0;
  // A streak may still be alive if today is not ticked yet: start from yesterday in that case.
  let t = h.log[key(today)] ? today : today - DAY;
  while (h.log[key(t)]) {
    n++;
    t -= DAY;
  }
  return n;
}

export default function Rhythm() {
  const [today] = useState(() => Date.now());
  const [habits, setHabits] = useState<Habit[]>([]);
  const [checkins, setCheckins] = useState<CheckIn[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [consent, setConsent] = useState<ConsentSettings | null>(null);
  const [newHabit, setNewHabit] = useState("");

  const load = useCallback(async () => {
    const [h, c, t, k] = await Promise.all([
      dataService.habits.list(),
      dataService.checkins.list(),
      dataService.tasks.list(),
      dataService.getConsent(),
    ]);
    setHabits(h);
    setCheckins(c);
    setTasks(t);
    setConsent(k);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const days21 = Array.from({ length: 21 }, (_, i) => key(today - (20 - i) * DAY));
  const days14 = days21.slice(-14);
  const todayKey = key(today);

  async function toggle(h: Habit, k: string) {
    const next = { ...h, log: { ...h.log, [k]: !h.log[k] }, updatedAt: nowIso() };
    setHabits((list) => list.map((x) => (x.id === h.id ? next : x)));
    await dataService.habits.upsert(next);
    notifyFactsChanged();
  }

  async function addHabit() {
    const title = newHabit.trim();
    if (!title) return;
    const h: Habit = { id: `habit-${Date.now()}`, title, category: "personal", log: {}, createdAt: nowIso(), updatedAt: nowIso() };
    setNewHabit("");
    setHabits((list) => [...list, h]);
    await dataService.habits.upsert(h);
  }

  const todayCheck = checkins.find((c) => c.date === todayKey);
  async function checkIn(field: "mood" | "energy", v: Level) {
    const base: CheckIn = todayCheck ?? { id: `checkin-${todayKey}`, date: todayKey, mood: 3, energy: 3, createdAt: nowIso(), updatedAt: nowIso() };
    const next = { ...base, [field]: v, updatedAt: nowIso() };
    setCheckins((list) => [...list.filter((c) => c.date !== todayKey), next]);
    await dataService.checkins.upsert(next);
    notifyFactsChanged();
  }

  async function finish(t: Task, actual: number) {
    const next = { ...t, done: true, actualHours: actual, completedAt: nowIso(), updatedAt: nowIso() };
    setTasks((list) => list.map((x) => (x.id === t.id ? next : x)));
    await dataService.tasks.upsert(next);
    notifyFactsChanged();
  }

  if (!consent) return <main className="page rhythm" aria-busy="true" />;

  // Mood and energy ribbon (last 14 days)
  const byDay = new Map(checkins.map((c) => [c.date, c]));
  const W = 700, H = 150, pad = 18;
  const x = (i: number) => pad + (i * (W - pad * 2)) / 13;
  const y = (v: number) => H - pad - ((v - 1) / 4) * (H - pad * 2);
  const series = (f: "mood" | "energy") =>
    days14
      .map((d, i) => (byDay.get(d) ? `${x(i)},${y(byDay.get(d)![f])}` : null))
      .filter(Boolean)
      .join(" ");
  const logged = days14.filter((d) => byDay.has(d));
  const avg = (f: "mood" | "energy") => (logged.length ? logged.reduce((s, d) => s + byDay.get(d)![f], 0) / logged.length : 0);

  const bias = estimationBias(tasks);
  const done = tasks.filter((t) => t.done && t.actualHours).sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? "")).slice(0, 8);
  const open = tasks.filter((t) => !t.done).sort((a, b) => (a.dueAt ?? "z").localeCompare(b.dueAt ?? "z")).slice(0, 6);
  const maxH = Math.max(1, ...done.map((t) => Math.max(t.estHours, t.actualHours ?? 0)));
  const overall = done.length ? done.reduce((s, t) => s + (t.actualHours ?? 0), 0) / done.reduce((s, t) => s + t.estHours, 0) : 1;

  return (
    <main className="page rhythm">
      <header className="rh-head">
        <p className="rh-eyebrow">Rhythm · sample data</p>
        <h1>How you actually work</h1>
        <p>Habits, a quick energy check-in and how long tasks really take. The twin uses these numbers to tailor its questions, plans and what-if odds.</p>
      </header>

      {/* Habit chains */}
      <section className="glass rh-panel" style={{ ["--glass-accent" as string]: "var(--green)" }}>
        <header className="rh-panel-head">
          <h2>Habit chains</h2>
          <span>last 21 days · tap today to tick</span>
        </header>
        {!consent.tasks ? (
          <p className="rh-off">Tasks and habits are switched off in Sources, so the twin does not see them.</p>
        ) : (
          <>
            <ul className="rh-habits">
              {habits.map((h, hi) => {
                const pct = days14.filter((d) => h.log[d]).length / 14;
                const s = streak(h, today);
                return (
                  <li key={h.id}>
                    <div className="rh-habit-name">
                      <b>{h.title}</b>
                      <span>{s > 0 ? `${s}-day streak` : "start a streak today"}</span>
                    </div>
                    <div className="rh-chain" role="group" aria-label={`${h.title}, last 21 days`}>
                      {days21.map((d, i) => {
                        const on = !!h.log[d];
                        const isToday = d === todayKey;
                        return (
                          <motion.button
                            key={d}
                            type="button"
                            className={`rh-link${on ? " on" : ""}${isToday ? " today" : ""}`}
                            onClick={() => toggle(h, d)}
                            aria-pressed={on}
                            aria-label={`${d}${on ? " done" : " not done"}`}
                            initial={{ opacity: 0, scale: 0.4 }}
                            animate={{ opacity: 1, scale: 1 }}
                            whileTap={{ scale: 0.8 }}
                            transition={{ delay: hi * 0.06 + i * 0.015, type: "spring", stiffness: 300, damping: 18 }}
                          />
                        );
                      })}
                    </div>
                    <Ring value={pct} colour="var(--green)" size={54} label={`${Math.round(pct * 100)} percent in 14 days`} />
                    <span className="rh-pct num">{Math.round(pct * 100)}%</span>
                  </li>
                );
              })}
            </ul>
            <form
              className="rh-add"
              onSubmit={(e) => {
                e.preventDefault();
                addHabit();
              }}
            >
              <input value={newHabit} onChange={(e) => setNewHabit(e.target.value)} placeholder="Add a habit, e.g. 20 min walk" aria-label="New habit" />
              <button type="submit" className="btn-ghost btn-small" disabled={!newHabit.trim()}>
                Add
              </button>
            </form>
          </>
        )}
      </section>

      <div className="rh-grid">
        {/* Energy and mood ribbon */}
        <section className="glass rh-panel" style={{ ["--glass-accent" as string]: "var(--teal)" }}>
          <header className="rh-panel-head">
            <h2>Energy and mood</h2>
            <span>1-5 check-in for planning, not a health measure</span>
          </header>
          {!consent.mood ? (
            <p className="rh-off">Mood and energy are switched off in Sources.</p>
          ) : (
            <>
              <svg className="rh-ribbon" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Average energy ${avg("energy").toFixed(1)}, mood ${avg("mood").toFixed(1)} over 14 days`}>
                {[1, 2, 3, 4, 5].map((v) => (
                  <line key={v} x1={pad} x2={W - pad} y1={y(v)} y2={y(v)} className="rh-grid-line" />
                ))}
                <motion.polyline points={series("energy")} className="rh-line energy" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.2 }} />
                <motion.polyline points={series("mood")} className="rh-line mood" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.2, delay: 0.2 }} />
                {days14.map((d, i) => {
                  const c = byDay.get(d);
                  return c ? (
                    <g key={d}>
                      <circle cx={x(i)} cy={y(c.energy)} r="4.5" className="rh-dot energy" />
                      <circle cx={x(i)} cy={y(c.mood)} r="4.5" className="rh-dot mood" />
                    </g>
                  ) : null;
                })}
                {days14.map((d, i) => (
                  <text key={d} x={x(i)} y={H - 2} className="rh-day">
                    {short(d)}
                  </text>
                ))}
              </svg>
              <p className="rh-legend">
                <span className="energy">energy avg {avg("energy").toFixed(1)}</span>
                <span className="mood">mood avg {avg("mood").toFixed(1)}</span>
              </p>
              <div className="rh-check">
                {(["energy", "mood"] as const).map((f) => (
                  <div key={f} className="rh-check-row">
                    <span>Today&rsquo;s {f}</span>
                    <div role="radiogroup" aria-label={`Today's ${f}`}>
                      {([1, 2, 3, 4, 5] as Level[]).map((v) => (
                        <button
                          key={v}
                          type="button"
                          role="radio"
                          aria-checked={todayCheck?.[f] === v}
                          className={`rh-level ${f}${todayCheck?.[f] === v ? " on" : ""}`}
                          onClick={() => checkIn(f, v)}
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>

        {/* Estimates vs actual */}
        <section className="glass rh-panel" style={{ ["--glass-accent" as string]: "var(--amber)" }}>
          <header className="rh-panel-head">
            <h2>Estimate vs actual</h2>
            <span>tasks take {overall.toFixed(2)}x your estimate</span>
          </header>
          {!consent.tasks ? (
            <p className="rh-off">Tasks are switched off in Sources.</p>
          ) : (
            <>
              <ul className="rh-bars">
                {done.map((t, i) => (
                  <li key={t.id}>
                    <span className="rh-bar-name">{t.title}</span>
                    <div className="rh-bar-track">
                      <motion.i className="est" initial={{ scaleX: 0 }} animate={{ scaleX: t.estHours / maxH }} transition={{ delay: i * 0.05, duration: 0.6 }} />
                      <motion.i className="act" initial={{ scaleX: 0 }} animate={{ scaleX: (t.actualHours ?? 0) / maxH }} transition={{ delay: 0.15 + i * 0.05, duration: 0.6 }} />
                    </div>
                    <span className="rh-bar-num num">
                      {t.estHours}h → {t.actualHours}h
                    </span>
                  </li>
                ))}
              </ul>
              <p className="rh-bias">
                {(Object.entries(bias) as [Category, number][])
                  .filter(([, v]) => v !== 1)
                  .map(([c, v]) => (
                    <span key={c}>
                      {c} <b>{v.toFixed(2)}x</b>
                    </span>
                  ))}
                <em>The what-if simulation multiplies your estimates by these.</em>
              </p>
              <h3 className="rh-sub">Open tasks</h3>
              <ul className="rh-open">
                {open.map((t) => (
                  <OpenTask key={t.id} task={t} onDone={finish} />
                ))}
              </ul>
            </>
          )}
        </section>
      </div>
    </main>
  );
}

function OpenTask({ task, onDone }: { task: Task; onDone: (t: Task, h: number) => void }) {
  const [h, setH] = useState(String(task.estHours));
  return (
    <li>
      <span className="rh-open-name">
        {task.title}
        {task.dueAt && <em>due {task.dueAt.slice(5, 10)}</em>}
      </span>
      <span className="rh-open-est num">est {task.estHours}h</span>
      <input type="number" min="0" step="0.5" value={h} onChange={(e) => setH(e.target.value)} aria-label={`Actual hours for ${task.title}`} />
      <button type="button" className="btn-ghost btn-small" onClick={() => onDone(task, Math.max(0, Number(h) || 0))}>
        Done
      </button>
    </li>
  );
}
