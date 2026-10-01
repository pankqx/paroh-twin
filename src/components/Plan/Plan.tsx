"use client";

// Plan: the month as a calendar and the year as a wheel, both drawn from Frank's own tasks, goals,
// habits and check-ins (DataService only). Overloaded days are called out early; tasks can be added
// straight onto a day.

import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { dataService } from "@/app/dataService";
import { notifyFactsChanged } from "@/components/shell/events";
import type { Category, CheckIn, Goal, Habit, Task } from "@/lib/types";
import "./Plan.css";

const FREE_HOURS = 4; // free study hours a day, same as the twin's load model
const CAT: Record<Category, string> = { study: "var(--teal)", health: "var(--green)", personal: "var(--violet)", career: "var(--amber)", other: "var(--rose)" };
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const pad = (n: number) => String(n).padStart(2, "0");
const dkey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const ikey = (iso?: string) => (iso ? dkey(new Date(iso)) : "");

interface Day {
  due: Task[];
  done: Task[];
  dueHours: number;
  doneHours: number;
  habitsDone: number;
  goals: Goal[];
  check?: CheckIn;
}

export default function Plan() {
  const [today] = useState(() => new Date());
  const [view, setView] = useState<"month" | "year">("month");
  const [cursor, setCursor] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [picked, setPicked] = useState<string>(() => dkey(new Date()));
  const [tasks, setTasks] = useState<Task[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [checkins, setCheckins] = useState<CheckIn[]>([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const [t, g, h, c] = await Promise.all([dataService.tasks.list(), dataService.goals.list(), dataService.habits.list(), dataService.checkins.list()]);
    setTasks(t);
    setGoals(g);
    setHabits(h);
    setCheckins(c);
    setLoaded(true);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const days = useMemo(() => {
    const map = new Map<string, Day>();
    const get = (k: string) => {
      let d = map.get(k);
      if (!d) map.set(k, (d = { due: [], done: [], dueHours: 0, doneHours: 0, habitsDone: 0, goals: [] }));
      return d;
    };
    for (const t of tasks) {
      if (!t.done && t.dueAt) {
        const d = get(ikey(t.dueAt));
        d.due.push(t);
        d.dueHours += t.estHours;
      }
      if (t.done && t.completedAt) {
        const d = get(ikey(t.completedAt));
        d.done.push(t);
        d.doneHours += t.actualHours ?? t.estHours;
      }
    }
    for (const h of habits) for (const [k, v] of Object.entries(h.log)) if (v) get(k).habitsDone++;
    for (const g of goals) if (g.targetDate) get(ikey(g.targetDate)).goals.push(g);
    for (const c of checkins) get(c.date).check = c;
    return map;
  }, [tasks, goals, habits, checkins]);

  if (!loaded) return <main className="page plan" aria-busy="true" />;

  return (
    <main className="page plan">
      <header className="pl-head">
        <div>
          <p className="pl-eyebrow">Plan · sample data</p>
          <h1>{view === "month" ? `${cursor.toLocaleDateString("en-IN", { month: "long" })} ${cursor.getFullYear()}` : `${cursor.getFullYear()} at a glance`}</h1>
          <p className="pl-lede">
            Built from Frank&rsquo;s tasks, goals, habits and check-ins. Days with more than {FREE_HOURS} hours due are flagged before they arrive.
          </p>
        </div>
        <div className="pl-tabs" role="tablist" aria-label="Planner view">
          {(["month", "year"] as const).map((v) => (
            <button key={v} role="tab" aria-selected={view === v} className={view === v ? "on" : ""} onClick={() => setView(v)}>
              {view === v && <motion.span layoutId="pl-tab" className="pl-tab-bg" transition={{ type: "spring", stiffness: 380, damping: 30 }} />}
              <span>{v === "month" ? "Month" : "Year"}</span>
            </button>
          ))}
        </div>
      </header>

      <AnimatePresence mode="wait">
        {view === "month" ? (
          <motion.div key="month" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.3 }}>
            <Month
              cursor={cursor}
              setCursor={setCursor}
              today={today}
              days={days}
              habitCount={habits.length}
              picked={picked}
              setPicked={setPicked}
              onAdd={async (t) => {
                setTasks((list) => [...list, t]);
                await dataService.tasks.upsert(t);
                notifyFactsChanged();
              }}
            />
          </motion.div>
        ) : (
          <motion.div key="year" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }}>
            <Year
              year={cursor.getFullYear()}
              setYear={(y) => setCursor(new Date(y, cursor.getMonth(), 1))}
              today={today}
              days={days}
              goals={goals}
              tasks={tasks}
              onMonth={(m) => {
                setCursor(new Date(cursor.getFullYear(), m, 1));
                setView("month");
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}

/* ---------------- Month ---------------- */

function Month({
  cursor,
  setCursor,
  today,
  days,
  habitCount,
  picked,
  setPicked,
  onAdd,
}: {
  cursor: Date;
  setCursor: (d: Date) => void;
  today: Date;
  days: Map<string, Day>;
  habitCount: number;
  picked: string;
  setPicked: (k: string) => void;
  onAdd: (t: Task) => void;
}) {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const lead = (first.getDay() + 6) % 7; // Monday first
  const inMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
  const cells = Array.from({ length: Math.ceil((lead + inMonth) / 7) * 7 }, (_, i) => new Date(cursor.getFullYear(), cursor.getMonth(), i - lead + 1));
  const todayKey = dkey(today);
  const monthDue = cells.filter((d) => d.getMonth() === cursor.getMonth()).reduce((s, d) => s + (days.get(dkey(d))?.dueHours ?? 0), 0);
  const heavy = cells.filter((d) => d.getMonth() === cursor.getMonth() && (days.get(dkey(d))?.dueHours ?? 0) > FREE_HOURS).length;
  const sel = days.get(picked);
  const selDate = new Date(`${picked}T12:00:00`);

  const [title, setTitle] = useState("");
  const [hours, setHours] = useState("1");
  const [cat, setCat] = useState<Category>("study");

  return (
    <div className="pl-month">
      <section className="glass pl-cal">
        <div className="pl-cal-bar">
          <button className="btn-ghost btn-small" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))} aria-label="Previous month">
            ←
          </button>
          <button className="btn-ghost btn-small" onClick={() => { setCursor(new Date(today.getFullYear(), today.getMonth(), 1)); setPicked(todayKey); }}>
            Today
          </button>
          <button className="btn-ghost btn-small" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))} aria-label="Next month">
            →
          </button>
          <span className="pl-sum">
            <b className="num">{monthDue.toFixed(1)}h</b> due this month · <b className="num">{heavy}</b> heavy {heavy === 1 ? "day" : "days"}
          </span>
        </div>
        <div className="pl-week">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <span key={d}>{d}</span>
          ))}
        </div>
        <div className="pl-grid">
          {cells.map((d, i) => {
            const k = dkey(d);
            const info = days.get(k);
            const out = d.getMonth() !== cursor.getMonth();
            const load = (info?.dueHours ?? 0) / FREE_HOURS;
            const isHeavy = (info?.dueHours ?? 0) > FREE_HOURS;
            const habitPct = habitCount ? (info?.habitsDone ?? 0) / habitCount : 0;
            return (
              <motion.button
                key={k}
                type="button"
                className={`pl-day${out ? " out" : ""}${k === todayKey ? " today" : ""}${k === picked ? " picked" : ""}${isHeavy ? " heavy" : ""}`}
                onClick={() => setPicked(k)}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: out ? 0.35 : 1, y: 0 }}
                transition={{ delay: i * 0.008 }}
                aria-label={`${d.toDateString()}: ${info?.due.length ?? 0} due, ${info?.done.length ?? 0} done`}
              >
                <span className="pl-num">{d.getDate()}</span>
                {habitPct > 0 && (
                  <svg className="pl-ring" viewBox="0 0 20 20" aria-hidden="true">
                    <circle cx="10" cy="10" r="7" className="bg" />
                    <circle cx="10" cy="10" r="7" className="fg" strokeDasharray={`${habitPct * 44} 44`} />
                  </svg>
                )}
                <span className="pl-dots">
                  {info?.due.slice(0, 4).map((t) => (
                    <i key={t.id} style={{ background: CAT[t.category] }} />
                  ))}
                  {info?.goals.map((g) => (
                    <em key={g.id} title={g.title}>★</em>
                  ))}
                </span>
                {info?.done.length ? <span className="pl-done">✓{info.done.length}</span> : null}
                {load > 0 && <span className="pl-load" style={{ transform: `scaleX(${Math.min(1, load)})` }} />}
                {isHeavy && <span className="pl-heavy">heavy</span>}
              </motion.button>
            );
          })}
        </div>
        <p className="pl-legend">
          {(Object.keys(CAT) as Category[]).map((c) => (
            <span key={c}>
              <i style={{ background: CAT[c] }} /> {c}
            </span>
          ))}
          <span>★ goal target</span>
          <span>○ habits done</span>
          <span>bar = hours due vs {FREE_HOURS} free</span>
        </p>
      </section>

      <aside className="glass pl-side" aria-live="polite">
        <h2>{selDate.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}</h2>
        {sel?.dueHours ? (
          <p className={`pl-badge${sel.dueHours > FREE_HOURS ? " heavy" : ""}`}>
            {sel.dueHours.toFixed(1)}h due · {sel.dueHours > FREE_HOURS ? "over your free time, move something earlier" : "fits your free time"}
          </p>
        ) : null}
        <Section title="Due" empty="Nothing due.">
          {sel?.due.map((t) => (
            <li key={t.id}>
              <i style={{ background: CAT[t.category] }} />
              {t.title} <span>{t.estHours}h</span>
            </li>
          ))}
        </Section>
        <Section title="Finished" empty="No finished work logged.">
          {sel?.done.map((t) => (
            <li key={t.id}>
              <i style={{ background: CAT[t.category] }} />
              {t.title} <span>{t.actualHours ?? t.estHours}h</span>
            </li>
          ))}
        </Section>
        {sel?.goals.length ? (
          <Section title="Goal targets" empty="">
            {sel.goals.map((g) => (
              <li key={g.id}>
                ★ {g.title} <span>{Math.round(g.progress * 100)}%</span>
              </li>
            ))}
          </Section>
        ) : null}
        {(sel?.habitsDone || sel?.check) && (
          <p className="pl-meta">
            {sel?.habitsDone ? `${sel.habitsDone}/${habitCount} habits done. ` : ""}
            {sel?.check ? `Energy ${sel.check.energy}/5, mood ${sel.check.mood}/5.` : ""}
          </p>
        )}
        <form
          className="pl-add"
          onSubmit={(e) => {
            e.preventDefault();
            const t = title.trim();
            const h = Number(hours);
            if (!t || !(h > 0)) return;
            const now = new Date().toISOString();
            const due = new Date(`${picked}T18:00:00`).toISOString();
            onAdd({ id: `task-plan-${Date.now()}`, title: t, category: cat, estHours: h, dueAt: due, done: false, createdAt: now, updatedAt: now });
            setTitle("");
          }}
        >
          <h3>Add a task on this day</h3>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Finish lab report" aria-label="Task title" />
          <div className="pl-add-row">
            <input type="number" min="0.5" step="0.5" value={hours} onChange={(e) => setHours(e.target.value)} aria-label="Estimated hours" />
            <select value={cat} onChange={(e) => setCat(e.target.value as Category)} aria-label="Category">
              {(Object.keys(CAT) as Category[]).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <button type="submit" className="btn-primary btn-small" disabled={!title.trim()}>
              Add
            </button>
          </div>
          <p className="pl-note">The twin includes it in load, Pulse and what-if odds straight away.</p>
        </form>
      </aside>
    </div>
  );
}

function Section({ title, empty, children }: { title: string; empty: string; children?: React.ReactNode }) {
  const list = Array.isArray(children) ? children.filter(Boolean) : children ? [children] : [];
  return (
    <div className="pl-sec">
      <h3>{title}</h3>
      {list.length ? <ul>{children}</ul> : empty ? <p className="pl-empty">{empty}</p> : null}
    </div>
  );
}

/* ---------------- Year wheel ---------------- */

function Year({ year, setYear, today, days, goals, tasks, onMonth }: { year: number; setYear: (y: number) => void; today: Date; days: Map<string, Day>; goals: Goal[]; tasks: Task[]; onMonth: (m: number) => void }) {
  const [hover, setHover] = useState<string>("");
  const R = 300;
  const start = new Date(year, 0, 1).getTime();
  const total = (new Date(year + 1, 0, 1).getTime() - start) / 86400000;
  const ang = (t: number) => ((t - start) / 86400000 / total) * Math.PI * 2 - Math.PI / 2;
  const pt = (a: number, r: number) => [Math.cos(a) * r, Math.sin(a) * r] as const;
  const arc = (a0: number, a1: number, r: number) => {
    const [x0, y0] = pt(a0, r);
    const [x1, y1] = pt(a1, r);
    return `M ${x0} ${y0} A ${r} ${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${x1} ${y1}`;
  };
  const wedge = (a0: number, a1: number, r0: number, r1: number) => {
    const [ox0, oy0] = pt(a0, r1), [ox1, oy1] = pt(a1, r1), [ix1, iy1] = pt(a1, r0), [ix0, iy0] = pt(a0, r0);
    return `M ${ox0} ${oy0} A ${r1} ${r1} 0 0 1 ${ox1} ${oy1} L ${ix1} ${iy1} A ${r0} ${r0} 0 0 0 ${ix0} ${iy0} Z`;
  };
  const dayList = Array.from({ length: total }, (_, i) => new Date(year, 0, 1 + i));
  const maxH = Math.max(1, ...dayList.map((d) => days.get(dkey(d))?.doneHours ?? 0));
  const deadlines = tasks.filter((t) => !t.done && t.dueAt && new Date(t.dueAt).getFullYear() === year);
  const tAng = ang(today.getTime());
  const yearEnd = new Date(year + 1, 0, 1).getTime();
  // Every goal whose span (created → target) overlaps this year, including multi-year ambitions.
  const yearGoals = goals.filter((g) => g.targetDate && new Date(g.targetDate).getTime() >= start && new Date(g.createdAt).getTime() < yearEnd);
  const allGoals = goals.filter((g) => g.targetDate).sort((a, b) => a.targetDate!.localeCompare(b.targetDate!));

  return (
    <div className="pl-year">
      <section className="glass pl-wheel-wrap">
        <svg className="pl-wheel" viewBox="-380 -380 760 760" role="img" aria-label={`Year ${year}: months, finished work, goals and deadlines`}>
          {/* month sectors */}
          {MONTHS.map((m, i) => {
            const a0 = ang(new Date(year, i, 1).getTime());
            const a1 = ang(new Date(year, i + 1, 1).getTime());
            const mid = (a0 + a1) / 2;
            const [lx, ly] = pt(mid, R + 52);
            const [sx, sy] = pt(a0, 120);
            const [ex, ey] = pt(a0, R + 30);
            const isNow = today.getFullYear() === year && today.getMonth() === i;
            return (
              <g key={m} className={`pl-sector${isNow ? " now" : ""}`} onClick={() => onMonth(i)} role="button" aria-label={`Open ${m}`}>
                <path d={wedge(a0, a1, 120, R + 30)} className="pl-sector-bg" />
                <line x1={sx} y1={sy} x2={ex} y2={ey} className="pl-tick" />
                <text x={lx} y={ly} className="pl-month-label">{m}</text>
              </g>
            );
          })}
          {/* finished work per day: radial bars */}
          {dayList.map((d) => {
            const h = days.get(dkey(d))?.doneHours ?? 0;
            if (!h) return null;
            const a = ang(d.getTime() + 43200000);
            const [x0, y0] = pt(a, R - 10);
            const [x1, y1] = pt(a, R - 10 + (h / maxH) * 36);
            return <line key={dkey(d)} x1={x0} y1={y0} x2={x1} y2={y1} className="pl-work" />;
          })}
          {/* goals as arcs from start to target, with progress */}
          {yearGoals.map((g, i) => {
            const s = Math.max(start, new Date(g.createdAt).getTime());
            const e = new Date(g.targetDate!).getTime();
            if (e < start) return null;
            const a0 = ang(s), a1 = ang(Math.min(e, start + total * 86400000 - 1));
            const r = 230 - (i % 5) * 26;
            const am = a0 + (a1 - a0) * g.progress;
            return (
              <g key={g.id} onMouseEnter={() => setHover(`${g.title}: ${Math.round(g.progress * 100)}% done, target ${new Date(g.targetDate!).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`)} onMouseLeave={() => setHover("")}>
                <path d={arc(a0, a1, r)} className="pl-goal-track" style={{ stroke: CAT[g.category] }} />
                <motion.path d={arc(a0, Math.max(a0 + 0.001, am), r)} className="pl-goal" style={{ stroke: CAT[g.category] }} initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.2, delay: 0.2 + i * 0.15 }} />
                {e < yearEnd ? (
                  <circle cx={pt(a1, r)[0]} cy={pt(a1, r)[1]} r="6" className="pl-goal-end" style={{ fill: CAT[g.category] }} />
                ) : (
                  <text x={pt(a1, r + 18)[0]} y={pt(a1, r + 18)[1]} className="pl-goal-cont" style={{ fill: CAT[g.category] }}>→ {new Date(g.targetDate!).getFullYear()}</text>
                )}
              </g>
            );
          })}
          {/* deadline pins */}
          {deadlines.map((t) => {
            const a = ang(new Date(t.dueAt!).getTime());
            const [x0, y0] = pt(a, R + 4);
            const [x1, y1] = pt(a, R + 24);
            return (
              <g key={t.id} className="pl-pin" onMouseEnter={() => setHover(`${t.title}: due ${new Date(t.dueAt!).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}, ${t.estHours}h`)} onMouseLeave={() => setHover("")}>
                <line x1={x0} y1={y0} x2={x1} y2={y1} />
                <circle cx={x1} cy={y1} r="4.5" />
              </g>
            );
          })}
          {/* today */}
          {today.getFullYear() === year && (
            <g className="pl-today">
              <line x1="0" y1="0" x2={pt(tAng, R + 30)[0]} y2={pt(tAng, R + 30)[1]} />
              <circle cx={pt(tAng, R + 30)[0]} cy={pt(tAng, R + 30)[1]} r="7" />
            </g>
          )}
          <text x="0" y="-8" className="pl-centre-year">{year}</text>
          <text x="0" y="22" className="pl-centre-sub">{hover ? "" : "tap a month to open it"}</text>
        </svg>
        <p className="pl-hover" aria-live="polite">{hover || "Hover a goal arc or a deadline pin."}</p>
      </section>
      <aside className="glass pl-side">
        <div className="pl-yearnav">
          <button className="btn-ghost btn-small" onClick={() => setYear(year - 1)} aria-label="Previous year">←</button>
          <b className="num">{year}</b>
          <button className="btn-ghost btn-small" onClick={() => setYear(year + 1)} aria-label="Next year">→</button>
        </div>
        <h2>Your goals</h2>
        <ul className="pl-goals">
          {allGoals.map((g) => (
            <li key={g.id}>
              <span className="pl-goal-dot" style={{ background: CAT[g.category] }} />
              <div>
                <b>{g.title}</b>
                <div className="pl-bar"><i style={{ transform: `scaleX(${g.progress})`, background: CAT[g.category] }} /></div>
                <span>{Math.round(g.progress * 100)}% · target {new Date(g.targetDate!).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
              </div>
            </li>
          ))}
        </ul>
        <h3 className="pl-sub">How to read the wheel</h3>
        <ul className="pl-read">
          <li>Twelve slices are the months; the bright line is today.</li>
          <li>Small bars on the rim are hours of finished work each day.</li>
          <li>Coloured arcs are goals from start to target; the bright part is progress.</li>
          <li>Pins on the outside are open deadlines.</li>
        </ul>
      </aside>
    </div>
  );
}
