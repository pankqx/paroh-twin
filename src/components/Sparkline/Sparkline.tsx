"use client";

import { motion, useReducedMotion } from "motion/react";
import { useId } from "react";
import "./Sparkline.css";

/**
 * A tiny trend line with a soft area under it and a dot on the last value. The line draws
 * itself on (pathLength). Values are real series from the engine; nothing is invented, and
 * an all-flat or empty series draws a quiet baseline instead of a fake trend.
 */
export default function Sparkline({
  values,
  colour = "var(--teal)",
  height = 44,
  label,
}: {
  values: number[];
  colour?: string;
  height?: number;
  label: string;
}) {
  const reduce = useReducedMotion();
  const gid = `sp-${useId().replace(/:/g, "")}`;
  const W = 260;
  const pad = 4;
  const n = values.length;
  const lo = Math.min(...values, 0);
  const hi = Math.max(...values, 0.0001);
  const span = hi - lo || 1;
  const pts = values.map((v, i) => ({
    x: n <= 1 ? W / 2 : pad + (i / (n - 1)) * (W - pad * 2),
    y: height - pad - ((v - lo) / span) * (height - pad * 2),
  }));

  // Smooth line through the points (midpoint quadratic curves).
  let d = "";
  if (pts.length > 0) {
    d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) {
      const mx = (pts[i - 1].x + pts[i].x) / 2;
      const my = (pts[i - 1].y + pts[i].y) / 2;
      d += ` Q ${pts[i - 1].x} ${pts[i - 1].y} ${mx} ${my}`;
    }
    d += ` T ${pts[pts.length - 1].x} ${pts[pts.length - 1].y}`;
  }
  const last = pts[pts.length - 1];
  const area = pts.length > 1 ? `${d} L ${last.x} ${height} L ${pts[0].x} ${height} Z` : "";

  return (
    <svg
      className="spark"
      viewBox={`0 0 ${W} ${height}`}
      role="img"
      aria-label={label}
      style={{ ["--c" as string]: colour }}
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={colour} stopOpacity="0.32" />
          <stop offset="1" stopColor={colour} stopOpacity="0" />
        </linearGradient>
      </defs>
      <line x1="0" x2={W} y1={height - 0.5} y2={height - 0.5} className="spark-base" />
      {area && <path d={area} fill={`url(#${gid})`} className="spark-area" />}
      {pts.length > 1 && (
        <motion.path
          d={d}
          className="spark-line"
          stroke={colour}
          initial={reduce ? false : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.3, delay: 0.5, ease: [0.2, 0.7, 0.2, 1] }}
        />
      )}
      {last && <circle cx={last.x} cy={last.y} r="3.2" className="spark-dot" fill={colour} />}
    </svg>
  );
}
