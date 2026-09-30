import "./StatRow.css";

export interface Stat {
  value: string;
  label: string;
}

export default function StatRow({ stats }: { stats: Stat[] }) {
  return (
    <dl className="stat-row">
      {stats.map((s) => (
        <div key={s.label} className="stat">
          <dd className="stat-value">{s.value}</dd>
          <dt className="stat-label">{s.label}</dt>
        </div>
      ))}
    </dl>
  );
}
