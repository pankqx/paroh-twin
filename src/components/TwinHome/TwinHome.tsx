"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { dataService } from "@/app/dataService";
import { takeGrowth, type Growth } from "@/app/bloomGrowth";
import CountUp from "@/components/CountUp/CountUp";
import Heatmap from "@/components/Heatmap/Heatmap";
import LedgerList from "@/components/LedgerList/LedgerList";
import GoalRing from "@/components/GoalRing/GoalRing";
import RiskPill from "@/components/RiskPill/RiskPill";
import StatRow from "@/components/StatRow/StatRow";
import LivingCore, { type CoreDomain, type LivingCoreHandle } from "@/components/LivingCore/LivingCore";
import { SAMPLE_STUDENT_NAME } from "@/mock/sample";
import { simulate } from "@/lib/twin/scenarios";
import type { Fact, Goal, TwinState } from "@/lib/types";
import "./TwinHome.css";

const DOMAINS: Array<{ key: string; label: string }> = [
  { key: "tasks", label: "Tasks" },
  { key: "habits", label: "Habits" },
  { key: "routines", label: "Routines" },
  { key: "mood", label: "Energy" },
  { key: "goals", label: "Goals" },
  { key: "planner", label: "Planner" },
];

interface Deadline {
  id: string;
  title: string;
  due: string; // YYYY-MM-DD
  taskCount: number;
  onTime: number; // 0-1
}

interface View {
  twin: TwinState;
  deadlines: Deadline[];
  goals: Goal[];
  learned: Fact[];
  learnedCount: number;
  waiting: number;
}

// Fixed locale + UTC so dates never shift between server and client.
const shortDate = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
const fmt = (iso: string) => shortDate.format(new Date(iso));

async function loadView(): Promise<View> {
  const [twin, facts, tasks, goals] = await Promise.all([
    dataService.getTwinState(),
    dataService.facts.list(),
    dataService.tasks.list(),
    dataService.goals.list(),
  ]);

  // Open tasks grouped by due day; each group is one deadline, scored by the
  // real simulation over the student's own actual/estimate history.
  const now = Date.now();
  const open = tasks
    .filter((t) => !t.done && t.dueAt && new Date(t.dueAt).getTime() > now - 86400000)
    .sort((a, b) => a.dueAt!.localeCompare(b.dueAt!));
  const groups = new Map<string, typeof open>();
  for (const t of open) {
    const day = t.dueAt!.slice(0, 10);
    groups.set(day, [...(groups.get(day) ?? []), t]);
  }
  const data = { tasks, goals, habits: [], checkins: [], decisions: [] };
  const deadlines: Deadline[] = [...groups.entries()].slice(0, 4).map(([day, group]) => {
    const goal = goals.find((g) => g.id === group[0].goalId);
    const extra = group.length - 1;
    const title = goal?.title ?? `${group[0].title}${extra > 0 ? ` and ${extra} more` : ""}`;
    const result = simulate(
      {
        id: `deadline-${day}`,
        label: title,
        summary: title,
        priority: "neutral",
        tasks: group.map((t) => ({
          taskId: t.id,
          title: t.title,
          hours: t.estHours,
          dueAt: t.dueAt,
          goalId: t.goalId,
        })),
      },
      data,
    );
    return { id: day, title, due: day, taskCount: group.length, onTime: result.onTimeProb };
  });

  return {
    twin,
    deadlines,
    goals,
    learned: facts
      .filter((f) => f.status === "approved")
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, 6),
    learnedCount: facts.filter((f) => f.status === "approved").length,
    waiting: facts.filter((f) => f.status === "pending").length,
  };
}

export default function TwinHome() {
  const [view, setView] = useState<View | null>(null);
  const [grew, setGrew] = useState<Growth>({});
  const core = useRef<LivingCoreHandle>(null);

  useEffect(() => {
    let live = true;
    loadView().then((v) => {
      if (!live) return;
      // Take the hand-off from /approvals only for the mount that renders it.
      setGrew(takeGrowth());
      setView(v);
    });
    return () => {
      live = false;
    };
  }, []);

  // Once the core has settled in, flare each node that grew since the last visit.
  useEffect(() => {
    const keys = Object.keys(grew);
    if (!view || keys.length === 0) return;
    const timers = keys.map((key, i) =>
      window.setTimeout(() => core.current?.flare(key, grew[key]), 1300 + i * 350),
    );
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [view, grew]);

  const domains: CoreDomain[] = useMemo(
    () =>
      DOMAINS.map((d) => ({
        ...d,
        confidence: view?.twin.confidenceByDomain[d.key] ?? 0,
      })),
    [view],
  );

  if (!view) return <main className="page twin-home" aria-busy="true" />;

  const { twin, deadlines, goals, learned, learnedCount, waiting } = view;
  const name = SAMPLE_STUDENT_NAME.split(" ")[0];
  const load = Math.round(twin.loadPct);
  const onTimeOdds = deadlines.length
    ? Math.round((deadlines.reduce((s, d) => s + d.onTime, 0) / deadlines.length) * 100)
    : null;
  const stagger = (i: number) => ({ ["--i" as string]: i });

  return (
    <main className="page twin-home">
      <div className="dash">
        <section className="panel hero rise" style={stagger(0)}>
          <div className="hero-text">
            <p className="eyebrow gradient-text">Good to see you</p>
            <h1 className="hero-title">Hey {name}, here&rsquo;s your week.</h1>
            <p className="hero-lede">
              {deadlines.length > 0
                ? `${deadlines.length} deadline${deadlines.length === 1 ? "" : "s"} coming up. `
                : ""}
              Ask a what-if to see how a different plan changes your odds.
            </p>
            <Link href="/ask" className="btn-primary big">
              Ask a what-if
            </Link>
            <p className="hero-key">
              Closer, brighter nodes are areas your twin knows well. Dashed ones need more
              data. The outer arc is this week&rsquo;s load: {load}%.
            </p>
          </div>
          <div className="hero-visual">
            <LivingCore ref={core} domains={domains} load={twin.loadPct} fidelity={twin.fidelity} />
          </div>
        </section>

        <section className="panel stat-panel span-12 rise" style={stagger(1)} aria-label="This week at a glance">
          <StatRow
            stats={[
              {
                value: onTimeOdds === null ? "–" : <CountUp to={onTimeOdds} suffix="%" />,
                label: "on-time odds this week",
              },
              {
                value: <CountUp to={Math.round(twin.fidelity * 100)} suffix="%" />,
                label: "twin fidelity",
                note: "twin’s guess vs your actual choice",
              },
              {
                value: <CountUp to={learnedCount} />,
                label: "facts learned",
                note:
                  waiting > 0 ? (
                    <Link href="/approvals">{waiting} waiting for review</Link>
                  ) : (
                    "nothing waiting for review"
                  ),
              },
            ]}
          />
        </section>

        <section className="panel span-5 rise" style={stagger(2)}>
          <h2>Goals</h2>
          {goals.length === 0 ? (
            <p className="empty-state">No goals yet.</p>
          ) : (
            <div className="goal-grid">
              {goals.slice(0, 3).map((g, i) => (
                <GoalRing
                  key={g.id}
                  title={g.title}
                  meta={g.targetDate ? `by ${fmt(g.targetDate)}` : undefined}
                  progress={g.progress}
                  delay={300 + i * 150}
                />
              ))}
            </div>
          )}
          {goals.length > 3 && <p className="panel-note">+{goals.length - 3} more goals</p>}
        </section>

        <section className="panel span-7 rise" style={stagger(3)}>
          <h2>Coming up</h2>
          <LedgerList
            items={deadlines}
            keyOf={(d) => d.id}
            empty="No deadlines in sight."
            render={(d) => (
              <div className="row">
                <div className="row-main">
                  <span className="row-title">{d.title}</span>
                  <span className="row-meta">
                    Due {fmt(d.due)} · {d.taskCount} open task{d.taskCount === 1 ? "" : "s"}
                  </span>
                </div>
                <RiskPill onTime={d.onTime} />
              </div>
            )}
          />
        </section>

        <section className="panel span-7 rise" style={stagger(4)}>
          <h2>Focus hours</h2>
          <p className="panel-note">When you tend to get your best work done.</p>
          <Heatmap data={twin.heatmap} />
        </section>

        <section className="panel span-5 rise" style={stagger(5)}>
          <h2>Recent signals</h2>
          <LedgerList
            items={learned}
            keyOf={(f) => f.id}
            empty="Nothing here yet. Approve something from your journal and it shows up here."
            render={(f) => (
              <div className="signal">
                <span className="kind-pill">{f.kind}</span>
                <span className="signal-text">{f.text}</span>
                <time className="signal-date" dateTime={f.updatedAt}>
                  {fmt(f.updatedAt)}
                </time>
              </div>
            )}
          />
        </section>
      </div>
    </main>
  );
}
