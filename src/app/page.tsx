import Link from "next/link";
import Heatmap from "@/components/Heatmap/Heatmap";
import LedgerList from "@/components/LedgerList/LedgerList";
import ProgressBar from "@/components/ProgressBar/ProgressBar";
import RiskPill from "@/components/RiskPill/RiskPill";
import StatRow from "@/components/StatRow/StatRow";
import TwinBloom, { type BloomDomain } from "@/components/TwinBloom/TwinBloom";
import { loadTwinState } from "./loadTwinState";
import {
  STUDENT_NAME,
  WAITING_FOR_REVIEW,
  deadlines,
  goals,
  memory,
} from "./twinHomeSample";
import "./twin-home.css";

const DOMAINS: Array<{ key: string; label: string }> = [
  { key: "tasks", label: "Tasks" },
  { key: "habits", label: "Habits" },
  { key: "routines", label: "Routines" },
  { key: "energy", label: "Energy" },
  { key: "goals", label: "Goals" },
  { key: "planner", label: "Planner" },
];

const KIND_LABEL: Record<string, string> = {
  task: "task",
  goal: "goal",
  habit: "habit",
  routine: "routine",
  preference: "preference",
  deadline: "deadline",
  decision: "decision",
};

// Fixed locale + UTC so server and client always agree.
const shortDate = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
const fmt = (iso: string) => shortDate.format(new Date(`${iso}T00:00:00Z`));

export default async function TwinPage() {
  const twin = await loadTwinState();

  const domains: BloomDomain[] = DOMAINS.map((d) => ({
    ...d,
    confidence: twin.confidenceByDomain[d.key] ?? 0,
  }));

  const onTimeOdds =
    deadlines.reduce((sum, d) => sum + d.onTime, 0) / Math.max(deadlines.length, 1);

  return (
    <main className="page twin-home">
      <section className="hero">
        <div className="hero-text">
          <p className="eyebrow">Good to see you</p>
          <h1 className="hero-title">Hey {STUDENT_NAME}, here&rsquo;s your week.</h1>
          <p className="hero-lede">
            Two deadlines are close. Ask a what-if to see how a different plan changes
            your odds.
          </p>
          <Link href="/ask" className="btn-primary big">
            Ask a what-if
          </Link>
        </div>
        <div className="hero-visual">
          <TwinBloom domains={domains} load={twin.loadPct} fidelity={twin.fidelity} />
        </div>
      </section>

      <StatRow
        stats={[
          { value: `${Math.round(onTimeOdds * 100)}%`, label: "on-time odds this week" },
          { value: `${Math.round(twin.fidelity * 100)}%`, label: "twin fidelity" },
          { value: String(WAITING_FOR_REVIEW), label: "waiting for review" },
        ]}
      />

      <section className="home-section">
        <h2>Focus hours</h2>
        <p className="section-note">When you tend to get your best work done.</p>
        <Heatmap data={twin.heatmap} />
      </section>

      <section className="home-section">
        <h2>Coming up</h2>
        <LedgerList
          items={deadlines}
          keyOf={(d) => d.id}
          empty="No deadlines in sight."
          render={(d) => (
            <div className="row">
              <div className="row-main">
                <span className="row-title">{d.title}</span>
                <span className="row-meta">Due {fmt(d.due)}</span>
              </div>
              <RiskPill onTime={d.onTime} />
            </div>
          )}
        />
      </section>

      <section className="home-section">
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
                  <span className="row-meta">By {fmt(g.target)}</span>
                </div>
                <span className="goal-pct">{Math.round(g.progress * 100)}%</span>
              </div>
              <ProgressBar value={g.progress} label={g.title} />
            </div>
          )}
        />
      </section>

      <section className="home-section">
        <h2>What your twin has learned</h2>
        <LedgerList
          items={memory}
          keyOf={(m) => m.id}
          empty="Nothing here yet."
          render={(m) => (
            <div className="memory">
              <time className="memory-date" dateTime={m.date}>
                {fmt(m.date)}
              </time>
              <span className="memory-text">{m.text}</span>
              <span className="kind-pill">{KIND_LABEL[m.kind] ?? m.kind}</span>
            </div>
          )}
        />
      </section>
    </main>
  );
}
