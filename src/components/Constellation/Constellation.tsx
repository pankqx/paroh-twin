"use client";

import { motion, useReducedMotion } from "motion/react";
import type { Fact, FactKind } from "@/lib/types";
import "./Constellation.css";

// Six hubs, three on each side of her. Every kind always has a hub, so the sky reads the
// same before anything is approved. Stars fan inward, toward her.
const W = 1100;
const H = 860;
const FACE_EDGE = 262; // spokes stop this far from the centre line, just short of her hair
const PER_HUB = 7;

const HUBS: Array<{ kind: FactKind; label: string; colour: string; side: -1 | 1; y: number }> = [
  { kind: "task", label: "tasks", colour: "var(--teal)", side: -1, y: 170 },
  { kind: "deadline", label: "deadlines", colour: "var(--rose)", side: -1, y: 430 },
  { kind: "goal", label: "goals", colour: "var(--amber)", side: -1, y: 690 },
  { kind: "habit", label: "habits", colour: "var(--green)", side: 1, y: 170 },
  { kind: "routine", label: "routines", colour: "var(--violet)", side: 1, y: 430 },
  { kind: "preference", label: "preferences", colour: "var(--lilac)", side: 1, y: 690 },
];

interface Placed {
  fact: Fact;
  x: number;
  y: number;
  side: -1 | 1;
}

const shortDate = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

export function describeFact(f: Fact) {
  return `${f.kind} · ${f.text} · approved ${shortDate.format(new Date(f.updatedAt))}`;
}

/**
 * The knowledge constellation: approved facts as small stars in two columns beside the
 * twin, grouped by kind, with faint links between facts that came from the same source.
 * Render the face on top, centred in the same box.
 */
export default function Constellation({
  facts,
  onFocusFact,
}: {
  facts: Fact[]; // approved facts only
  onFocusFact: (f: Fact | null) => void;
}) {
  const reduce = useReducedMotion();

  const hubs = HUBS.map((h) => ({ ...h, x: W / 2 + h.side * 440 }));
  const placed: Placed[] = [];
  const byHub = hubs.map((hub) => {
    const mine = facts.filter((f) => f.kind === hub.kind).slice(0, PER_HUB);
    const toward = hub.side === -1 ? 0 : Math.PI; // inward
    const nodes = mine.map((fact, j) => {
      const spread = mine.length > 1 ? (j / (mine.length - 1) - 0.5) * 2.6 : 0;
      const ang = toward + spread * (hub.side === -1 ? 1 : -1);
      const dist = 46 + (j % 3) * 24;
      const p: Placed = { fact, x: hub.x + dist * Math.cos(ang), y: hub.y + dist * Math.sin(ang), side: hub.side };
      placed.push(p);
      return p;
    });
    return { hub, nodes };
  });

  // Facts that share a source get a faint link (same side only, so nothing crosses her).
  const links: Array<[Placed, Placed]> = [];
  for (let i = 0; i < placed.length; i++) {
    for (let j = i + 1; j < placed.length; j++) {
      const a = placed[i];
      const b = placed[j];
      if (a.side === b.side && a.fact.sourceId === b.fact.sourceId && a.fact.kind !== b.fact.kind) {
        links.push([a, b]);
      }
    }
  }

  const draw = (delay: number) =>
    reduce
      ? {}
      : {
          initial: { pathLength: 0, opacity: 0 },
          animate: { pathLength: 1, opacity: 1 },
          transition: { duration: 1.1, delay, ease: [0.2, 0.7, 0.2, 1] as const },
        };

  return (
    <svg className="constellation" viewBox={`0 0 ${W} ${H}`} aria-label="Knowledge constellation">
      {links.map(([a, b], i) => (
        <motion.path
          key={`l${i}`}
          d={`M ${a.x} ${a.y} Q ${(a.x + b.x) / 2 + a.side * -30} ${(a.y + b.y) / 2} ${b.x} ${b.y}`}
          className="const-link"
          {...draw(1.6 + i * 0.05)}
        />
      ))}

      {byHub.map(({ hub, nodes }, i) => {
        const empty = nodes.length === 0;
        return (
          <g
            key={hub.kind}
            className="const-group"
            style={{ ["--drift" as string]: `${11 + (i % 3) * 3}s`, ["--dx" as string]: `${(i % 2 ? 1 : -1) * 5}px` }}
          >
            <motion.line
              x1={hub.x}
              y1={hub.y}
              x2={W / 2 + hub.side * FACE_EDGE}
              y2={hub.y}
              className={`const-spoke ${empty ? "empty" : ""}`}
              {...draw(0.9 + i * 0.07)}
            />
            {nodes.map((n, j) => (
              <motion.line
                key={`e${n.fact.id}`}
                x1={hub.x}
                y1={hub.y}
                x2={n.x}
                y2={n.y}
                stroke={hub.colour}
                className="const-edge"
                {...draw(1.2 + i * 0.07 + j * 0.04)}
              />
            ))}
            <g transform={`translate(${hub.x} ${hub.y})`}>
              <circle r={empty ? 8 : 10.5} className={`const-hub ${empty ? "empty" : ""}`} stroke={hub.colour} style={{ ["--c" as string]: hub.colour }} />
            </g>
            <text
              x={hub.x}
              y={hub.y + 34}
              textAnchor="middle"
              className="const-label"
            >
              {hub.label}
              {!empty && <tspan className="const-count"> {facts.filter((f) => f.kind === hub.kind).length}</tspan>}
            </text>
            {nodes.map((n, j) => (
              <g key={n.fact.id} transform={`translate(${n.x} ${n.y})`}>
                <motion.circle
                  r={3.6 + n.fact.confidence * 3.4}
                  fill={hub.colour}
                  className="const-star"
                  tabIndex={0}
                  role="img"
                  aria-label={describeFact(n.fact)}
                  onPointerEnter={() => onFocusFact(n.fact)}
                  onPointerLeave={() => onFocusFact(null)}
                  onFocus={() => onFocusFact(n.fact)}
                  onBlur={() => onFocusFact(null)}
                  initial={reduce ? false : { opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: "spring", stiffness: 200, damping: 16, delay: 1.3 + i * 0.07 + j * 0.05 }}
                  style={{ ["--c" as string]: hub.colour }}
                />
              </g>
            ))}
          </g>
        );
      })}
    </svg>
  );
}
