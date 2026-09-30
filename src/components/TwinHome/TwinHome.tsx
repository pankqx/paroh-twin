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
import RiskPill, { riskOf } from "@/components/RiskPill/RiskPill";
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

interface View {
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
  const [twin, facts, tasks, goals, decisions, consent] = await Promise.all([
    dataService.getTwinState(),
    dataService.facts.list(),
    dataService.tasks.list(),
    dataService.goals.list(),
    dataService.decisions.list(),
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

  return {
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

  const { twin, deadlines, approved, guesses } = view;
  const name = SAMPLE_STUDENT_NAME.split(" ")[0];
  const load = Math.round(twin.loadPct);

  return (
    <main className="page twin">
      <Aurora amplitude={0.8} speed={0.8} />

      <section className="twin-hero">
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
          <p className="twin-caption" aria-live="polite">
            {focused
              ? describeFact(focused)
              : approved.length > 0
                ? `${approved.length} approved fact${approved.length === 1 ? "" : "s"} in the sky. Hover a star to read it.`
                : "No approved facts yet. Each one you approve becomes a star."}
          </p>
        </div>

        <div className="twin-stage">
          <Constellation facts={approved} onFocusFact={setFocused} />
          <div className="twin-stage-face">
            <TwinFace ref={face} state="idle" />
          </div>
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
        <SpotlightCard className="stat rise" style={{ ["--i" as string]: 1 }}>
          <Ring
            half
            value={Math.min(twin.loadPct, 100) / 100}
            colour={loadColour(twin.loadPct)}
            size={112}
            label={`Weekly load ${load}%`}
          />
          <div className="stat-num num">
            <CountUp to={load} suffix="%" />
          </div>
          <p className="stat-label">weekly load</p>
          <p className="stat-note">open work due in 7 days vs 4 free hours a day</p>
        </SpotlightCard>

        <SpotlightCard className="stat rise" style={{ ["--i" as string]: 2 }}>
          <div className="stat-ring">
            <Ring
              value={twin.habitConsistency}
              colour="var(--green)"
              size={72}
              label={`Habit consistency ${Math.round(twin.habitConsistency * 100)}%`}
            />
            <span className="stat-num num">
              <CountUp to={Math.round(twin.habitConsistency * 100)} suffix="%" />
            </span>
          </div>
          <p className="stat-label">habit consistency</p>
          <p className="stat-note">check-ins done, last 14 days</p>
        </SpotlightCard>

        <SpotlightCard className="stat rise" style={{ ["--i" as string]: 3 }}>
          <div className="stat-ring">
            <Ring
              value={twin.goalAlignment}
              colour="var(--amber)"
              size={72}
              label={`Goal-linked work ${Math.round(twin.goalAlignment * 100)}%`}
            />
            <span className="stat-num num">
              <CountUp to={Math.round(twin.goalAlignment * 100)} suffix="%" />
            </span>
          </div>
          <p className="stat-label">goal-linked work</p>
          <p className="stat-note">share of last week&rsquo;s hours on a goal</p>
        </SpotlightCard>

        <SpotlightCard className="stat stat-fidelity rise" style={{ ["--i" as string]: 4 }}>
          <span className="fidelity-chip">
            <span className="fidelity-dot" aria-hidden="true" />
            fidelity {Math.round(twin.fidelity * 100)}%
          </span>
          <div className="stat-num stat-num-big num">
            {guesses.total > 0 ? (
              <>
                <CountUp to={guesses.hits} />
                <span className="stat-of"> of {guesses.total}</span>
              </>
            ) : (
              "–"
            )}
          </div>
          <p className="stat-label">twin&rsquo;s guess vs your choice</p>
          <p className="stat-note">
            {guesses.total > 0
              ? `last ${guesses.total} decisions. An estimate, not a prediction.`
              : "no decisions yet. Try Ask."}
          </p>
        </SpotlightCard>
      </section>

      <section className="twin-grid">
        <div className="glass twin-panel twin-heat rise" style={{ ["--i" as string]: 5 }}>
          <h2>Focus hours</h2>
          <p className="twin-panel-note">When finished work usually happens, by weekday and hour.</p>
          <Heatmap data={twin.heatmap} />
        </div>

        <div className="glass twin-panel rise" style={{ ["--i" as string]: 6 }}>
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
