import type { Telemetry } from "./useTelemetry";

const R = 5.5;
const C = 2 * Math.PI * R;

function Ring({ value }: { value: number }) {
  const v = Math.min(Math.max(value, 0), 100) / 100;
  return (
    <svg className="hud-ring" width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <circle cx="7" cy="7" r={R} className="hud-ring-track" />
      <circle cx="7" cy="7" r={R} className="hud-ring-arc" strokeDasharray={C} style={{ strokeDashoffset: C * (1 - v) }} transform="rotate(-90 7 7)" />
    </svg>
  );
}

function Spark({ series }: { series: number[] }) {
  if (series.length < 2) return <span className="hud-dot" />;
  const max = Math.max(...series);
  const pts = series.map((v, i) => `${(i / (series.length - 1)) * 26},${10 - (v / max) * 9}`).join(" ");
  // keyed on the length so a new approval redraws the line
  return (
    <svg key={series.length} className="hud-spark" width="28" height="12" viewBox="0 0 28 12" aria-hidden="true">
      <polyline points={pts} pathLength={1} />
    </svg>
  );
}

/** Tiny readouts in the right margin. Every number comes from the DataService. */
export default function Hud({ t }: { t: Telemetry | null }) {
  if (!t) return null;
  const items = [
    { k: "load", label: "LOAD", value: `${t.load}%`, icon: <Ring value={t.load} /> },
    { k: "fid", label: "FIDELITY", value: `${t.fidelity}%`, icon: <Ring value={t.fidelity} /> },
    { k: "facts", label: "APPROVED FACTS", value: String(t.approved), icon: <Spark series={t.approvedSeries} /> },
    t.nextDeadlineDays !== null && {
      k: "due",
      label: "NEXT DEADLINE",
      value: t.nextDeadlineDays === 0 ? "today" : `${t.nextDeadlineDays}d`,
      icon: <Ring value={100 - Math.min(t.nextDeadlineDays, 7) * (100 / 7)} />,
    },
  ].filter(Boolean) as Array<{ k: string; label: string; value: string; icon: React.ReactNode }>;

  return (
    <div className="atmo-hud">
      {items.map((it) => (
        <div key={it.k} className="hud-item">
          {it.icon}
          <span className="hud-label">{it.label}</span>
          <span key={it.value} className="hud-value num">
            {it.value}
          </span>
        </div>
      ))}
    </div>
  );
}
