import type { ReactNode } from "react";
import "./StatRow.css";

export interface Stat {
  value: ReactNode;
  label: string;
  note?: ReactNode;
}

export default function StatRow({ stats }: { stats: Stat[] }) {
  return (
    <dl className="stat-row">
      {stats.map((s) => (
        <div key={s.label} className="stat">
          <dt className="stat-label">
            {s.label}
            {s.note && <span className="stat-note">{s.note}</span>}
          </dt>
          <dd className="stat-value">{s.value}</dd>
        </div>
      ))}
    </dl>
  );
}
