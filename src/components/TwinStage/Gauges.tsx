"use client";

import Ring from "@/components/Ring/Ring";
import { useStageData } from "./useStageData";
import "./Gauges.css";

const DOMAINS: Array<{ key: string; label: string }> = [
  { key: "tasks", label: "Tasks" },
  { key: "habits", label: "Habits" },
  { key: "routines", label: "Routines" },
  { key: "mood", label: "Energy" },
  { key: "goals", label: "Goals" },
  { key: "planner", label: "Planner" },
];

const loadColour = (l: number) => (l > 85 ? "var(--rose)" : l >= 60 ? "var(--amber)" : "var(--teal)");

/** Live gauges, real values: how well she knows each area, weekly load, and fidelity. */
export default function Gauges() {
  const { twin } = useStageData(true);
  if (!twin) return <section className="glass gauges" aria-busy="true" />;
  const load = Math.round(twin.loadPct);
  return (
    <section className="glass gauges" aria-label="Live gauges" style={{ ["--glass-accent" as string]: "var(--teal)" }}>
      <header>
        <h2>How well she knows you</h2>
      </header>
      <ul className="gauge-grid">
        {DOMAINS.map((d) => {
          const c = twin.confidenceByDomain[d.key] ?? 0;
          return (
            <li key={d.key}>
              <div className="gauge-ring">
                <Ring value={Math.max(c, 0.02)} colour="var(--violet)" size={58} label={`${d.label} confidence ${Math.round(c * 100)}%`} />
                <span className="num">{Math.round(c * 100)}</span>
              </div>
              <span className="gauge-label">{d.label}</span>
            </li>
          );
        })}
      </ul>
      <div className="gauge-row">
        <div>
          <span className="gauge-big num" style={{ color: loadColour(twin.loadPct) }}>
            {load}%
          </span>
          <span className="gauge-label">weekly load</span>
        </div>
        <div>
          <span className="gauge-big num" style={{ color: "var(--violet)" }}>
            {Math.round(twin.fidelity * 100)}%
          </span>
          <span className="gauge-label">fidelity</span>
        </div>
      </div>
    </section>
  );
}
