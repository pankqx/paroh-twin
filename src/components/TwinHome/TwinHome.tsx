"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { dataService } from "@/app/dataService";
import { takeGrowth, type Growth } from "@/app/bloomGrowth";
import CountUp from "@/components/CountUp/CountUp";
import Heatmap from "@/components/Heatmap/Heatmap";
import LedgerList from "@/components/LedgerList/LedgerList";
import ProgressBar from "@/components/ProgressBar/ProgressBar";
import RiskPill from "@/components/RiskPill/RiskPill";
import StatRow from "@/components/StatRow/StatRow";
import TwinBloom, { type BloomDomain } from "@/components/TwinBloom/TwinBloom";
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
      .slice(0, 8),
    waiting: facts.filter((f) => f.status === "pending").length,
  };
}

export default function TwinHome() {
  const [view, setView] = useState<View | null>(null);
  const [grew, setGrew] = useState<Growth>({});

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

  if (!view) return <main className="page twin-home" aria-busy="true" />;

  const { twin, deadlines, goals, learned, waiting } = view;
  const name = SAMPLE_STUDENT_NAME.split(" ")[0];
  const domains: BloomDomain[] = DOMAINS.map((d) => ({
    ...d,
    confidence: twin.confidenceByDomain[d.key] ?? 0,
  }));
  const onTimeOdds = deadlines.length
    ? Math.round((deadlines.reduce((s, d) => s + d.onTime, 0) / deadlines.length) * 100)
    : null;

  return (
    <main className="page twin-home">
      <section className="hero">
        <div className="hero-text reveal">
          <p className="eyebrow">Good to see you</p>
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
        </div>
        <div className="hero-visual">
          <TwinBloom
            domains={domains}
            load={twin.loadPct}
            fidelity={twin.fidelity}
            grew={grew}
          />
        </div>
      </section>

      <div className="reveal" style={{ ["--i" as string]: 1 }}>
        <StatRow
          stats={[
            {
              value: onTimeOdds === null ? "–" : <CountUp to={onTimeOdds} suffix="%" />,
              label: "on-time odds this week",
            },
            {
              value: <CountUp to={Math.round(twin.fidelity * 100)} suffix="%" />,
              label: "twin fidelity",
            },
            { value: <CountUp to={waiting} />, label: "waiting for review" },
          ]}
        />
      </div>

      <section className="home-section reveal" style={{ ["--i" as string]: 2 }}>
        <h2>Focus hours</h2>
        <p className="section-note">When you tend to get your best work done.</p>
        <Heatmap data={twin.heatmap} />
      </section>

      <section className="home-section reveal" style={{ ["--i" as string]: 3 }}>
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

      <section className="home-section reveal" style={{ ["--i" as string]: 4 }}>
        <h2>Goals</h2>
        <LedgerList
          items={goals}
          keyOf={(g) => g.id}
          empty="No goals yet."
          render={(g) => (
            <div className="goal">
              <div className="row">
                <div className="row-main">
                  <span className="row-title">{g.title}</span>
                  {g.targetDate && <span className="row-meta">By {fmt(g.targetDate)}</span>}
                </div>
                <span className="goal-pct">{Math.round(g.progress * 100)}%</span>
              </div>
              <ProgressBar value={g.progress} label={g.title} />
            </div>
          )}
        />
      </section>

      <section className="home-section reveal" style={{ ["--i" as string]: 5 }}>
        <h2>What your twin has learned</h2>
        <LedgerList
          items={learned}
          keyOf={(f) => f.id}
          empty="Nothing here yet. Approve something from your journal and it will show up here."
          render={(f) => (
            <div className="memory">
              <time className="memory-date" dateTime={f.updatedAt}>
                {fmt(f.updatedAt)}
              </time>
              <span className="memory-text">{f.text}</span>
              <span className="kind-pill">{f.kind}</span>
            </div>
          )}
        />
      </section>
    </main>
  );
}
