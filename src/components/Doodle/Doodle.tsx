"use client";

import { motion, useInView, useReducedMotion } from "motion/react";
import { useRef } from "react";
import "./Doodle.css";

// Hand-drawn arrows: a loose curve with a two-stroke head. All in a 70 x 46 box.
const ARROWS = {
  "down-left": "M 64 4 C 46 4, 22 12, 8 38 M 8 38 l 3 -11 M 8 38 l 11 -4",
  "down-right": "M 6 4 C 24 4, 48 12, 62 38 M 62 38 l -3 -11 M 62 38 l -11 -4",
  "up-right": "M 6 42 C 24 42, 48 34, 62 8 M 62 8 l -3 11 M 62 8 l -11 4",
  "up-left": "M 64 42 C 46 42, 22 34, 8 8 M 8 8 l 3 11 M 8 8 l 11 4",
  underline: "M 2 8 C 30 2, 70 12, 118 4",
} as const;

/**
 * A hand-written note in Caveat with a hand-drawn arrow that draws itself on when it
 * scrolls into view. Keep to one or two per page, pointing at something useful.
 */
export default function Doodle({
  text,
  arrow = "down-left",
  className,
  tone = "amber",
}: {
  text: string;
  arrow?: keyof typeof ARROWS;
  className?: string;
  tone?: "amber" | "violet" | "teal";
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -10% 0px" });
  const reduce = useReducedMotion();
  const wide = arrow === "underline";

  return (
    <span ref={ref} className={`doodle-note tone-${tone} ${wide ? "wide" : ""} ${className ?? ""}`}>
      <span className="doodle-text">{text}</span>
      <svg viewBox={wide ? "0 0 120 12" : "0 0 70 46"} width={wide ? 120 : 70} height={wide ? 12 : 46} aria-hidden="true">
        <motion.path
          d={ARROWS[arrow]}
          initial={reduce ? false : { pathLength: 0 }}
          animate={{ pathLength: reduce || inView ? 1 : 0 }}
          transition={{ duration: 1, delay: 0.25, ease: [0.2, 0.7, 0.2, 1] }}
        />
      </svg>
    </span>
  );
}
