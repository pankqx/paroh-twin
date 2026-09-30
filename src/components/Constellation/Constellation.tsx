"use client";

import { motion, useReducedMotion } from "motion/react";
import type { Fact, FactKind } from "@/lib/types";
import "./Constellation.css";

// Every kind always has a hub, so the sky reads the same before anything is approved.
const KINDS: Array<{ kind: FactKind; label: string; colour: string }> = [
  { kind: "task", label: "tasks", colour: "var(--teal)" },
  { kind: "deadline", label: "deadlines", colour: "var(--rose)" },
  { kind: "goal", label: "goals", colour: "var(--amber)" },
  { kind: "habit", label: "habits", colour: "var(--green)" },
  { kind: "routine", label: "routines", colour: "var(--violet)" },
  { kind: "preference", label: "preferences", colour: "var(--lilac)" },
];

const SIZE = 600;
const C = SIZE / 2;
const HUB_R = 250; // hubs sit on this circle
const ORB_EDGE = 150; // hub-to-core lines stop here
const PER_HUB = 7; // cap nodes drawn per kind

interface Placed {
  fact: Fact;
  x: number;
  y: number;
}

const shortDate = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

export function describeFact(f: Fact) {
  return `${f.kind} · ${f.text} · approved ${shortDate.format(new Date(f.updatedAt))}`;
}

/**
 * The knowledge constellation: approved facts as small stars around the orb,
 * grouped by kind, with faint links between facts that came from the same source.
 * Render the orb on top of it, centred.
 */
export default function Constellation({
  facts,
  onFocusFact,
}: {
  facts: Fact[]; // approved facts only
  onFocusFact: (f: Fact | null) => void;
}) {
  const reduce = useReducedMotion();
  const step = 360 / KINDS.length;

  const hubs = KINDS.map((k, i) => {
    const a = ((i * step - 90 + step / 2) * Math.PI) / 180;
    return { ...k, a, x: C + HUB_R * Math.cos(a), y: C + HUB_R * Math.sin(a) };
  });

  const placed: Placed[] = [];
  const byHub = hubs.map((hub) => {
    const mine = facts.filter((f) => f.kind === hub.kind).slice(0, PER_HUB);
    const nodes = mine.map((fact, j) => {
      // fan the stars out on the far side of the hub
      const spread = mine.length > 1 ? (j / (mine.length - 1) - 0.5) * 2.2 : 0;
      const ang = hub.a + spread * 0.6;
      const dist = 34 + (j % 2) * 16;
      const p = { fact, x: hub.x + dist * Math.cos(ang), y: hub.y + dist * Math.sin(ang) };
      placed.push(p);
      return p;
    });
    return { hub, nodes };
  });

  // Facts that share a source get a faint link.
  const links: Array<[Placed, Placed]> = [];
  for (let i = 0; i < placed.length; i++) {
    for (let j = i + 1; j < placed.length; j++) {
      if (placed[i].fact.sourceId === placed[j].fact.sourceId && placed[i].fact.kind !== placed[j].fact.kind) {
        links.push([placed[i], placed[j]]);
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
    <svg className="constellation" viewBox={`0 0 ${SIZE} ${SIZE}`} aria-label="Knowledge constellation">
      {links.map(([a, b], i) => (
        <motion.path
          key={`l${i}`}
          d={`M ${a.x} ${a.y} Q ${C} ${C} ${b.x} ${b.y}`}
          className="const-link"
          {...draw(0.9 + i * 0.05)}
        />
      ))}

      {byHub.map(({ hub, nodes }, i) => {
        const empty = nodes.length === 0;
        return (
          <g
            key={hub.kind}
            className="const-group"
            style={{ ["--drift" as string]: `${10 + (i % 3) * 3}s`, ["--dx" as string]: `${(i % 2 ? 1 : -1) * 4}px` }}
          >
            <motion.line
              x1={C + ORB_EDGE * Math.cos(hub.a)}
              y1={C + ORB_EDGE * Math.sin(hub.a)}
              x2={hub.x}
              y2={hub.y}
              className={`const-spoke ${empty ? "empty" : ""}`}
              {...draw(0.3 + i * 0.07)}
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
                {...draw(0.6 + i * 0.07 + j * 0.04)}
              />
            ))}
            <circle
              cx={hub.x}
              cy={hub.y}
              r={empty ? 7 : 9}
              className={`const-hub ${empty ? "empty" : ""}`}
              stroke={hub.colour}
              style={{ ["--c" as string]: hub.colour }}
            />
            <text
              x={hub.x}
              y={hub.y + (Math.sin(hub.a) >= 0 ? 26 : -20)}
              textAnchor="middle"
              className="const-label"
            >
              {hub.label}
              {!empty && <tspan className="const-count"> {nodes.length}</tspan>}
            </text>
            {nodes.map((n, j) => (
              <motion.circle
                key={n.fact.id}
                cx={n.x}
                cy={n.y}
                r={3 + n.fact.confidence * 3}
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
                transition={{ type: "spring", stiffness: 200, damping: 16, delay: 0.8 + i * 0.07 + j * 0.05 }}
                style={{ ["--c" as string]: hub.colour }}
              />
            ))}
          </g>
        );
      })}
    </svg>
  );
}
