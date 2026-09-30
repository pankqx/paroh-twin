"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { dataService } from "@/app/dataService";
import { takeGrowth } from "@/app/bloomGrowth";
import Doodle from "@/components/Doodle/Doodle";
import EmptyOrbit from "@/components/EmptyOrbit/EmptyOrbit";
import Constellation, { describeFact } from "@/components/Constellation/Constellation";
import Aurora from "@/components/fx/Aurora";
import BlurText from "@/components/fx/BlurText";
import CountUp from "@/components/fx/CountUp";
import SpotlightCard from "@/components/fx/SpotlightCard";
import Heatmap from "@/components/Heatmap/Heatmap";
import Ring from "@/components/Ring/Ring";
import Sparkline from "@/components/Sparkline/Sparkline";
import RiskPill, { riskOf } from "@/components/RiskPill/RiskPill";
import HomeLife from "./HomeLife";
import TwinFace, { type TwinFaceHandle } from "@/components/TwinFace/TwinFace";
import { SAMPLE_STUDENT_NAME } from "@/mock/sample";
import { simulate } from "@/lib/twin/scenarios";
import type { Fact, TwinState } from "@/lib/types";
import "./TwinHome.css";

// Engine domain keys, shown as "how well she knows you".
const DOMAINS: Array<{ key: string; label: string }> = [
  { key: "tasks", label: "Tasks" },
  { key: "habits", label: "Habits" },
  { key: "routines", label: "Routines" },
  { key: "mood", label: "Energy" },
  { key: "goals", label: "Goals" },
  { key: "planner", label: "Planner" },
];

const RISK_COLOUR = { "on track": "var(--teal)", tight: "var(--amber)", "at risk": "var(--rose)" };

interface Deadline {
  id: string;
  title: string;
  due: string; // YYYY-MM-DD
  taskCount: number;
  onTime: number; // 0-1
}

interface Series {
  load: number[]; // estimated hours due per day, today + 6
  habits: number[]; // share of habits done per day, last 14 days
  goalHours: number[]; // goal-linked hours logged per day, last 7 days
  guesses: boolean[]; // last 10 decisions: did the twin guess the choice?
}

interface View {
  series: Series;
  twin: TwinState;
  deadlines: Deadline[];
  approved: Fact[];
  guesses: { hits: number; total: number };
}

// Fixed locale + UTC so dates never shift between server and client.
const shortDate = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
const fmt = (iso: string) => shortDate.format(new Date(iso));

const loadColour = (load: number) =>
  load > 85 ? "var(--rose)" : load >= 60 ? "var(--amber)" : "var(--teal)";

async function loadView(): Promise<View> {
  const [twin, facts, tasks, goals, decisions, habits, consent] = await Promise.all([
    dataService.getTwinState(),
    dataService.facts.list(),
    dataService.tasks.list(),
    dataService.goals.list(),
    dataService.decisions.list(),
    dataService.habits.list(),
    dataService.getConsent(),
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

  // Same rule as the engine's fidelity: last 10 decisions with a recorded choice.
  const recorded = decisions.filter((d) => d.chosenScenarioId).slice(-10);
  const hits = recorded.filter((d) => d.predictedChoiceId === d.chosenScenarioId).length;

  // Real series behind the stat cards, all derived from the stored tasks, habits and decisions.
  const dayKey = (t: number) => new Date(t).toISOString().slice(0, 10);
  const days = (n: number, from: number, step: number) => Array.from({ length: n }, (_, i) => dayKey(from + i * step * 86400000));
  const dueHours = new Map<string, number>();
  for (const t of tasks) if (!t.done && t.dueAt) dueHours.set(t.dueAt.slice(0, 10), (dueHours.get(t.dueAt.slice(0, 10)) ?? 0) + t.estHours);
  const goalHours = new Map<string, number>();
  for (const t of tasks) {
    if (t.done && t.goalId && t.completedAt) goalHours.set(t.completedAt.slice(0, 10), (goalHours.get(t.completedAt.slice(0, 10)) ?? 0) + (t.actualHours ?? t.estHours));
  }
  const series: Series = {
    load: days(7, now, 1).map((k) => dueHours.get(k) ?? 0),
    habits: days(14, now - 13 * 86400000, 1).map((k) =>
      habits.length ? habits.filter((h) => h.log[k]).length / habits.length : 0,
    ),
    goalHours: days(7, now - 6 * 86400000, 1).map((k) => goalHours.get(k) ?? 0),
    guesses: recorded.map((d) => d.predictedChoiceId === d.chosenScenarioId),
  };

  return {
    series,
    twin,
    deadlines,
    // Mirror the engine: journal-sourced facts only count while journal consent is on.
    approved: facts
      .filter((f) => f.status === "approved" && (consent.journal || f.sourceType !== "journal"))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    guesses: { hits, total: recorded.length },
  };
}

export default function TwinHome() {
  const [view, setView] = useState<View | null>(null);
  const [grew, setGrew] = useState<string[]>([]);
  const [focused, setFocused] = useState<Fact | null>(null);
  const face = useRef<TwinFaceHandle>(null);

  useEffect(() => {
    let live = true;
    loadView().then((v) => {
      if (!live) return;
      // Domains that grew since an approval elsewhere pulse once on arrival.
      setGrew(Object.keys(takeGrowth()));
      setView(v);
    });
    return () => {
      live = false;
    };
  }, []);

  // After the draw-on, her mind point flares once for facts approved elsewhere.
  useEffect(() => {
    if (!view || grew.length === 0) return;
    const t = window.setTimeout(() => face.current?.flare(), 2000);
    return () => window.clearTimeout(t);
  }, [view, grew]);

  if (!view) return <main className="page twin" aria-busy="true" />;

  const { twin, deadlines, approved, guesses, series } = view;
  const name = SAMPLE_STUDENT_NAME.split(" ")[0];
  const load = Math.round(twin.loadPct);

  return (
    <main className="page twin">
      <Aurora amplitude={0.8} speed={0.8} />

      <section className="twin-hero">
        <div className="twin-stage">
          <HomeLife
            name={name}
            deadline={deadlines[0] ? { title: deadlines[0].title.length > 28 ? `${deadlines[0].title.slice(0, 26)}…` : deadlines[0].title, days: Math.max(0, Math.ceil((new Date(deadlines[0].due).getTime() - Date.now()) / 86400000)) } : undefined}
            habitPct={Math.round(twin.habitConsistency * 100)}
            loadPct={load}
            approvedCount={approved.length}
          />
          <Constellation facts={approved} onFocusFact={setFocused} />
          <div className="twin-stage-face">
            <TwinFace ref={face} state="idle" />
          </div>

          <div className="twin-hero-text">
            <p className="twin-eyebrow">{name}&rsquo;s twin · sample data</p>
            <BlurText text={`Hey ${name}, here’s your week.`} className="twin-title" />
            <p className="twin-lede">
              {deadlines.length > 0
                ? `${deadlines.length} deadline${deadlines.length === 1 ? "" : "s"} ahead and a ${load}% load. `
                : `A ${load}% load this week. `}
              Everything here comes from what {name} chose to share and approve.
            </p>
            <div className="twin-actions">
              <Link href="/talk" className="btn-primary">
                Talk to your twin
              </Link>
              <Link href="/ask" className="btn-ghost">
                Ask a what-if
              </Link>
            </div>
          </div>

          <p className="glass twin-caption" aria-live="polite">
            {focused
              ? describeFact(focused)
              : approved.length > 0
                ? `${approved.length} approved fact${approved.length === 1 ? "" : "s"} in the sky. Hover a star to read it.`
                : "No approved facts yet. Each one you approve becomes a star."}
          </p>

          <div className="twin-doodle">
            {approved.length === 0 ? (
              <Doodle text="approve a fact, get a star" arrow="down-left" />
            ) : (
              <Doodle text="hover a star" arrow="down-left" tone="teal" />
            )}
          </div>
        </div>
      </section>

      <section className="twin-stats" aria-label="This week at a glance">
        <SpotlightCard className="stat rise" style={{ ["--i" as string]: 1, ["--glass-accent" as string]: loadColour(twin.loadPct) }}>
          <header className="stat-head">
            <span className="stat-label">weekly load</span>
            <span className="stat-tag" style={{ color: loadColour(twin.loadPct) }}>
              {twin.loadPct > 85 ? "heavy" : twin.loadPct >= 60 ? "full" : "light"}
            </span>
          </header>
          <div className="stat-body">
            <div className="stat-num num">
              <CountUp to={load} suffix="%" />
            </div>
            <Ring value={Math.min(twin.loadPct, 100) / 100} colour={loadColour(twin.loadPct)} size={76} label={`Weekly load ${load}%`} />
          </div>
          <Sparkline values={series.load} colour={loadColour(twin.loadPct)} label="Estimated hours due each day for the next 7 days" />
          <p className="stat-note">hours due per day, next 7 days, vs 4 free hours a day</p>
        </SpotlightCard>

        <SpotlightCard className="stat rise" style={{ ["--i" as string]: 2, ["--glass-accent" as string]: "var(--green)" }}>
          <header className="stat-head">
            <span className="stat-label">habit consistency</span>
            <span className="stat-tag" style={{ color: "var(--green)" }}>14 days</span>
          </header>
          <div className="stat-body">
            <div className="stat-num num">
              <CountUp to={Math.round(twin.habitConsistency * 100)} suffix="%" />
            </div>
            <Ring value={twin.habitConsistency} colour="var(--green)" size={76} label={`Habit consistency ${Math.round(twin.habitConsistency * 100)}%`} />
          </div>
          <Sparkline values={series.habits} colour="var(--green)" label="Share of habits done each day, last 14 days" />
          <p className="stat-note">share of habits checked in, day by day</p>
        </SpotlightCard>

        <SpotlightCard className="stat rise" style={{ ["--i" as string]: 3, ["--glass-accent" as string]: "var(--amber)" }}>
          <header className="stat-head">
            <span className="stat-label">goal-linked work</span>
            <span className="stat-tag" style={{ color: "var(--amber)" }}>7 days</span>
          </header>
          <div className="stat-body">
            <div className="stat-num num">
              <CountUp to={Math.round(twin.goalAlignment * 100)} suffix="%" />
            </div>
            <Ring value={twin.goalAlignment} colour="var(--amber)" size={76} label={`Goal-linked work ${Math.round(twin.goalAlignment * 100)}%`} />
          </div>
          <Sparkline values={series.goalHours} colour="var(--amber)" label="Goal-linked hours logged each day, last 7 days" />
          <p className="stat-note">hours finished on a goal, day by day</p>
        </SpotlightCard>

        <SpotlightCard className="stat stat-fidelity rise" style={{ ["--i" as string]: 4, ["--glass-accent" as string]: "var(--violet)" }}>
          <header className="stat-head">
            <span className="stat-label">twin&rsquo;s guess vs your choice</span>
            <span className="fidelity-chip">
              <span className="fidelity-dot" aria-hidden="true" />
              fidelity {Math.round(twin.fidelity * 100)}%
            </span>
          </header>
          <div className="stat-body">
            <div className="stat-num num">
              {guesses.total > 0 ? (
                <>
                  <CountUp to={guesses.hits} />
                  <span className="stat-of"> of {guesses.total}</span>
                </>
              ) : (
                "–"
              )}
            </div>
          </div>
          <div className="guess-dots" role="img" aria-label={`${guesses.hits} of ${guesses.total} guesses matched`}>
            {series.guesses.map((hit, i) => (
              <span key={i} className={hit ? "hit" : "miss"} style={{ animationDelay: `${0.6 + i * 0.07}s` }} />
            ))}
          </div>
          <p className="stat-note">
            {guesses.total > 0
              ? `last ${guesses.total} decisions. An estimate, not a prediction.`
              : "no decisions yet. Try Ask."}
          </p>
        </SpotlightCard>
      </section>

      <section className="twin-grid">
        <div className="glass twin-panel twin-heat rise" style={{ ["--i" as string]: 5, ["--glass-accent" as string]: "var(--teal)" }}>
          <h2>Focus hours</h2>
          <p className="twin-panel-note">When finished work usually happens, by weekday and hour.</p>
          <Heatmap data={twin.heatmap} />
        </div>

        <div className="glass twin-panel rise" style={{ ["--i" as string]: 6, ["--glass-accent" as string]: "var(--rose)" }}>
          <h2>Coming up</h2>
          <p className="twin-panel-note">On-time odds from 500 simulated runs of {name}&rsquo;s own pace.</p>
          {deadlines.length === 0 ? (
            <EmptyOrbit title="No deadlines in sight." doodle="a quiet week" />
          ) : (
            <ul className="risk-list">
              {deadlines.map((d) => (
                <li key={d.id}>
                  <Ring
                    value={d.onTime}
                    colour={RISK_COLOUR[riskOf(d.onTime)]}
                    size={40}
                    label={`${Math.round(d.onTime * 100)}% on-time odds`}
                  />
                  <div className="risk-main">
                    <span className="risk-title">{d.title}</span>
                    <span className="risk-meta">
                      Due {fmt(d.due)} · {d.taskCount} open task{d.taskCount === 1 ? "" : "s"}
                    </span>
                  </div>
                  <RiskPill onTime={d.onTime} />
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="glass twin-panel twin-coverage rise" style={{ ["--i" as string]: 7 }}>
          <h2>How well she knows you</h2>
          <p className="twin-panel-note">
            Confidence per area, from the data you allowed and the facts you approved. More data
            raises it; it is never a guarantee.
          </p>
          <ul className="coverage">
            {DOMAINS.map((d, i) => {
              const c = twin.confidenceByDomain[d.key] ?? 0;
              return (
                <li key={d.key} className={c < 0.3 ? "sparse" : undefined}>
                  <span className="coverage-label">{d.label}</span>
                  <span className="coverage-track">
                    <span className="coverage-fill" style={{ transform: `scaleX(${Math.max(c, 0.02)})`, animationDelay: `${0.4 + i * 0.08}s` }} />
                  </span>
                  <span className="coverage-pct num">{Math.round(c * 100)}%</span>
                </li>
              );
            })}
          </ul>
        </div>
      </section>
    </main>
  );
}
