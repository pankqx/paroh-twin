"use client";

// Ambient life around the line-art twin: a speech bubble that cycles through real things she
// knows, orbit rings with travelling lights, and floating chips. Pure SVG/CSS (transform and
// opacity only), no data writes. Pointer-events are off so nothing blocks the stars.

import { useEffect, useState } from "react";
import "./HomeLife.css";

interface Props {
  name: string;
  deadline?: { title: string; days: number };
  habitPct: number;
  loadPct: number;
  approvedCount: number;
}

export default function HomeLife({ name, deadline, habitPct, loadPct, approvedCount }: Props) {
  const lines = [
    `Hi ${name}. Ready when you are.`,
    deadline
      ? `${deadline.title} is due in ${deadline.days} day${deadline.days === 1 ? "" : "s"}.`
      : "No deadline is close this week.",
    `Your habits are at ${habitPct}% over the last two weeks.`,
    approvedCount > 0
      ? `I know ${approvedCount} thing${approvedCount === 1 ? "" : "s"} you approved. Teach me more?`
      : "Tap talk and teach me one thing about you.",
  ];
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setI((n) => (n + 1) % lines.length), 4200);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines.length]);

  return (
    <div className="hl" aria-hidden="true">
      <svg className="hl-rings" viewBox="-600 -400 1200 800" preserveAspectRatio="xMidYMid meet">
        <g className="hl-spin a">
          <ellipse rx="520" ry="340" fill="none" stroke="var(--teal)" strokeOpacity="0.22" strokeDasharray="2 10" />
          <circle cx="520" cy="0" r="6" fill="var(--teal)" />
          <circle cx="-520" cy="0" r="4" fill="var(--violet)" />
        </g>
        <g className="hl-spin b">
          <ellipse rx="420" ry="270" fill="none" stroke="var(--violet)" strokeOpacity="0.25" strokeDasharray="1 14" />
          <circle cx="0" cy="-270" r="5" fill="var(--amber)" />
          <circle cx="0" cy="270" r="3.5" fill="var(--teal)" />
        </g>
        <g className="hl-spin c">
          <ellipse rx="610" ry="390" fill="none" stroke="var(--rose)" strokeOpacity="0.14" strokeDasharray="3 18" />
          <circle cx="610" cy="0" r="4" fill="var(--rose)" />
        </g>
      </svg>

      <div className="hl-bubble" key={i}>
        <span className="hl-bubble-text">{lines[i]}</span>
      </div>

      <div className="hl-chip c1">
        <b>{loadPct}%</b> load this week
      </div>
      <div className="hl-chip c2">
        <b>{habitPct}%</b> habit streak
      </div>
      {deadline && (
        <div className="hl-chip c3">
          next: <b>{deadline.title}</b> · {deadline.days}d
        </div>
      )}
      <div className="hl-chip c4">
        <b>{approvedCount}</b> approved facts
      </div>
    </div>
  );
}
