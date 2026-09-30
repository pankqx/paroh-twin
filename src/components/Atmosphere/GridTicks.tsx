"use client";

import { motion, useReducedMotion, useScroll, useSpring, useTransform, type MotionValue } from "motion/react";

const TICKS = 36;

function Tick({ i, progress, reduce }: { i: number; progress: MotionValue<number>; reduce: boolean | null }) {
  const at = i / (TICKS - 1);
  // Each tick lights once the scroll position reaches it.
  const opacity = useTransform(progress, [Math.max(at - 0.04, 0), at + 0.0001], [0, 1]);
  const long = i % 5 === 0;
  const y = 8 + i * 11;
  return (
    <>
      <line x1={long ? 0 : 6} y1={y} x2="18" y2={y} className="atmo-tick" />
      <motion.line x1={long ? 0 : 6} y1={y} x2="18" y2={y} className="atmo-tick lit" style={{ opacity: reduce ? 0.9 : opacity }} />
    </>
  );
}

/** Horizon grid, corner crosshairs, ruler ticks that light with scroll, and a progress line. */
export default function GridTicks({ grid }: { grid: boolean }) {
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll();
  const smooth = useSpring(scrollYProgress, { stiffness: 120, damping: 28, mass: 0.4 });

  // Perspective lines: radiate from a vanishing point at the top edge; rows bunch toward it.
  const rays = Array.from({ length: 21 }, (_, i) => 800 + (i - 10) * 170);
  const rows = Array.from({ length: 9 }, (_, i) => 400 * Math.pow((i + 1) / 9, 2.2));

  return (
    <>
      {grid && (
        <svg className="atmo-grid" viewBox="0 0 1600 400" preserveAspectRatio="none">
          {rays.map((x) => (
            <line key={x} x1="800" y1="0" x2={x} y2="400" />
          ))}
          {rows.map((y) => (
            <line key={y} x1="0" y1={y} x2="1600" y2={y} />
          ))}
        </svg>
      )}

      {(["tl", "tr", "bl", "br"] as const).map((c) => (
        <svg key={c} className={`atmo-cross ${c}`} width="16" height="16" viewBox="0 0 16 16">
          <path d="M8 1v14M1 8h14" />
        </svg>
      ))}

      <svg className="atmo-ticks" width="20" viewBox={`0 0 20 ${TICKS * 11 + 12}`} preserveAspectRatio="none">
        {Array.from({ length: TICKS }, (_, i) => (
          <Tick key={i} i={i} progress={smooth} reduce={reduce} />
        ))}
      </svg>
      <motion.div className="atmo-progress" style={{ scaleY: reduce ? scrollYProgress : smooth }} />
    </>
  );
}
