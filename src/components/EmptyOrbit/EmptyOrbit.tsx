"use client";

import { motion, useInView, useReducedMotion } from "motion/react";
import { useRef } from "react";
import "./EmptyOrbit.css";

/**
 * A drawn empty state: a dashed orbit that draws itself, a plain line, and one doodle line.
 * Replaces the old flat "nothing here" boxes.
 */
export default function EmptyOrbit({ title, doodle }: { title: string; doodle?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true });
  const reduce = useReducedMotion();
  const go = reduce || inView;
  const draw = (delay: number) => ({
    initial: reduce ? false : { pathLength: 0, opacity: 0 },
    animate: { pathLength: go ? 1 : 0, opacity: go ? 1 : 0 },
    transition: { duration: 1.3, delay, ease: [0.2, 0.7, 0.2, 1] as const },
  });

  return (
    <div ref={ref} className="empty-orbit">
      <svg viewBox="0 0 120 84" width="132" height="92" aria-hidden="true">
        <motion.circle cx="60" cy="42" r="36" className="eo-ring" {...draw(0)} />
        <motion.ellipse cx="60" cy="42" rx="52" ry="18" transform="rotate(-16 60 42)" className="eo-ring" {...draw(0.25)} />
        <circle cx="60" cy="42" r="5" className="eo-core" />
        <motion.circle cx="104" cy="28" r="2.6" className="eo-dot" initial={reduce ? false : { scale: 0 }} animate={{ scale: go ? 1 : 0 }} transition={{ delay: 1.2, type: "spring", stiffness: 200, damping: 14 }} />
      </svg>
      <p className="eo-title">{title}</p>
      {doodle && <span className="eo-doodle">{doodle}</span>}
    </div>
  );
}
