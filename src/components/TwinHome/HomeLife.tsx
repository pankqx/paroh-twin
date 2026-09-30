"use client";

// Ambient life around the line-art twin: a speech bubble that cycles through real things she
// knows, and floating chips. Pure SVG/CSS (transform and
// opacity only), no data writes. Pointer-events are off so nothing blocks the stars.

import { useEffect, useState } from "react";
import "./HomeLife.css";

interface Props {
  name: string;
  deadline?: { title: string; days: number };
  habitPct: number;
  loadPct: number;
  approvedCount: number;
  /** Called each time a new bubble line appears (the twin mouths it). */
  onLine?: (i: number) => void;
}

export default function HomeLife({ name, deadline, habitPct, loadPct, approvedCount, onLine }: Props) {
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
    onLine?.(i);
  }, [i]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const id = window.setInterval(() => setI((n) => (n + 1) % lines.length), 4200);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines.length]);

  return (
    <div className="hl" aria-hidden="true">
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
