"use client";

import { motion, useReducedMotion } from "motion/react";
import "./Ring.css";

/**
 * A ring or half-ring gauge that draws itself on. `value` is 0-1 of the arc.
 * The arc is drawn with pathLength (the design system's "draw-on" rule).
 */
export default function Ring({
  value,
  colour = "var(--teal)",
  half = false,
  size = 96,
  label,
}: {
  value: number;
  colour?: string;
  half?: boolean; // semicircle gauge
  size?: number;
  label: string; // accessible description
}) {
  const reduce = useReducedMotion();
  const v = Math.min(Math.max(value, 0), 1);
  const r = 40;
  const d = half
    ? `M ${50 - r} 52 A ${r} ${r} 0 0 1 ${50 + r} 52`
    : `M 50 ${50 - r} A ${r} ${r} 0 1 1 49.99 ${50 - r}`;
  const box = half ? "0 0 100 60" : "0 0 100 100";

  return (
    <svg
      className="ring"
      viewBox={box}
      width={size}
      height={half ? size * 0.6 : size}
      role="img"
      aria-label={label}
      style={{ ["--c" as string]: colour }}
    >
      <path d={d} className="ring-track" />
      <motion.path
        d={d}
        className="ring-arc"
        stroke={colour}
        initial={reduce ? false : { pathLength: 0 }}
        animate={{ pathLength: v }}
        transition={{ duration: 1.4, delay: 0.3, ease: [0.2, 0.7, 0.2, 1] }}
      />
    </svg>
  );
}
