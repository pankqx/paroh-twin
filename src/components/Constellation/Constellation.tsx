"use client";

import { motion, useReducedMotion } from "motion/react";
import type { Fact, FactKind } from "@/lib/types";
import "./Constellation.css";

// Six hubs, three on each side of her, spread wide. Every kind always has a hub, so the sky
// reads the same before anything is approved (empty hubs show dashed placeholder stars).
// Stars stack in a column between the hub and her, each with a short label.
const W = 1300;
const H = 900;
const HUB_X = 520; // hub distance from the centre line
const FACE_EDGE = 290; // spokes stop this far from the centre line, just short of her hair
const PER_HUB = 6;
const GHOSTS = 3;
const GAP = 34; // vertical gap between stars in a column

const HUBS: Array<{ kind: FactKind; label: string; colour: string; side: -1 | 1; y: number }> = [
  { kind: "task", label: "tasks", colour: "var(--teal)", side: -1, y: 440 },
  { kind: "deadline", label: "deadlines", colour: "var(--rose)", side: -1, y: 630 },
  { kind: "goal", label: "goals", colour: "var(--amber)", side: -1, y: 815 },
  { kind: "habit", label: "habits", colour: "var(--green)", side: 1, y: 440 },
  { kind: "routine", label: "routines", colour: "var(--violet)", side: 1, y: 630 },
  { kind: "preference", label: "preferences", colour: "var(--lilac)", side: 1, y: 815 },
];

const short = (t: string, n = 22) => (t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t);

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

  const hubs = HUBS.map((h) => ({ ...h, x: W / 2 + h.side * HUB_X }));
  const placed: Placed[] = [];
  const byHub = hubs.map((hub) => {
    const mine = facts.filter((f) => f.kind === hub.kind).slice(0, PER_HUB);
    const inward = -hub.side; // +1 means towards +x
    // A gently curved column: the middle stars sit closest to her.
    const nodes = mine.map((fact, j) => {
      const t = mine.length > 1 ? j / (mine.length - 1) - 0.5 : 0;
      const p: Placed = {
        fact,
        x: hub.x + inward * (64 + (0.25 - t * t) * 120),
        y: hub.y + (j - (mine.length - 1) / 2) * GAP,
        side: hub.side,
      };
      placed.push(p);
      return p;
    });
    const ghosts = mine.length === 0
      ? Array.from({ length: GHOSTS }, (_, j) => ({
          x: hub.x + inward * (64 + (0.25 - (j / (GHOSTS - 1) - 0.5) ** 2) * 120),
          y: hub.y + (j - (GHOSTS - 1) / 2) * GAP,
        }))
      : [];
    return { hub, nodes, ghosts };
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
    <svg className="constellation" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" aria-label="Knowledge constellation">
      {links.map(([a, b], i) => (
        <motion.path
          key={`l${i}`}
          d={`M ${a.x} ${a.y} Q ${(a.x + b.x) / 2 + a.side * -30} ${(a.y + b.y) / 2} ${b.x} ${b.y}`}
          className="const-link"
          {...draw(1.6 + i * 0.05)}
        />
      ))}

      {byHub.map(({ hub, nodes, ghosts }, i) => {
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
              <circle r={empty ? 13 : 16} className={`const-hub ${empty ? "empty" : ""}`} stroke={hub.colour} style={{ ["--c" as string]: hub.colour }} />
              {!empty && <circle r="4" fill={hub.colour} />}
            </g>
            <text x={hub.x} y={hub.y - 34} textAnchor="middle" className="const-label">
              {hub.label}
              <tspan className="const-count" dx="8">
                {facts.filter((f) => f.kind === hub.kind).length}
              </tspan>
            </text>
            {ghosts.map((g, j) => (
              <circle key={`g${j}`} cx={g.x} cy={g.y} r="7" className="const-ghost" style={{ ["--c" as string]: hub.colour }} />
            ))}
            {nodes.map((n, j) => (
              <g key={n.fact.id} transform={`translate(${n.x} ${n.y})`}>
                <motion.circle
                  r={6 + n.fact.confidence * 4}
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
                <text
                  x={hub.side === -1 ? 18 : -18}
                  y="4"
                  textAnchor={hub.side === -1 ? "start" : "end"}
                  className="const-node-label"
                >
                  {short(n.fact.text)}
                </text>
              </g>
            ))}
          </g>
        );
      })}
    </svg>
  );
}
