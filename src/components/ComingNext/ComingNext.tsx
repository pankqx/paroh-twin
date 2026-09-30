"use client";

import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import "./ComingNext.css";

/** Designed placeholder for a screen that is not built yet. */
export default function ComingNext({
  title,
  blurb,
  points,
}: {
  title: string;
  blurb: string;
  points: string[];
}) {
  const reduce = useReducedMotion();
  const draw = (delay: number) =>
    reduce
      ? {}
      : {
          initial: { pathLength: 0, opacity: 0 },
          animate: { pathLength: 1, opacity: 1 },
          transition: { duration: 1.6, delay, ease: [0.2, 0.7, 0.2, 1] as const },
        };

  return (
    <main className="page coming">
      <div className="coming-art" aria-hidden="true">
        <svg viewBox="0 0 320 320">
          <motion.circle cx="160" cy="160" r="128" className="coming-orbit dashed" {...draw(0)} />
          <motion.ellipse
            cx="160"
            cy="160"
            rx="150"
            ry="62"
            transform="rotate(-18 160 160)"
            className="coming-orbit"
            {...draw(0.3)}
          />
          <motion.circle cx="160" cy="160" r="84" className="coming-orbit dashed faint" {...draw(0.55)} />
          <circle cx="160" cy="160" r="26" className="coming-core" />
        </svg>
        <div className="coming-planet" />
      </div>

      <div className="coming-copy">
        <p className="doodle">coming next</p>
        <h1>{title}</h1>
        <p className="coming-blurb">{blurb}</p>
        <ul className="coming-points">
          {points.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
        <Link href="/" className="btn-ghost">
          Back to your twin
        </Link>
      </div>
    </main>
  );
}
