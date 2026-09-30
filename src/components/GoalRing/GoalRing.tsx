"use client";

import { useId } from "react";
import "./GoalRing.css";

const R = 42;
const CIRC = 2 * Math.PI * R;

export default function GoalRing({
  title,
  meta,
  progress,
  delay = 0,
}: {
  title: string;
  meta?: string;
  progress: number; // 0-1
  delay?: number; // ms
}) {
  const id = useId();
  const p = Math.min(Math.max(progress, 0), 1);
  const pct = Math.round(p * 100);

  return (
    <figure className="goal-ring">
      <svg viewBox="0 0 100 100" role="img" aria-label={`${title}: ${pct}% done`}>
        <defs>
          <linearGradient id={id} x1="0" y1="1" x2="1" y2="0">
            <stop offset="0" stopColor="var(--violet)" />
            <stop offset="1" stopColor="var(--teal)" />
          </linearGradient>
        </defs>
        <circle className="goal-ring-track" cx="50" cy="50" r={R} />
        <circle
          className="goal-ring-arc"
          cx="50"
          cy="50"
          r={R}
          stroke={`url(#${id})`}
          strokeDasharray={CIRC}
          style={{
            ["--full" as string]: CIRC,
            ["--to" as string]: CIRC * (1 - p),
            animationDelay: `${delay}ms`,
          }}
        />
        <text x="50" y="51" className="goal-ring-pct" textAnchor="middle" dominantBaseline="middle">
          {pct}%
        </text>
      </svg>
      <figcaption>
        <span className="goal-ring-title">{title}</span>
        {meta && <span className="goal-ring-meta">{meta}</span>}
      </figcaption>
    </figure>
  );
}
