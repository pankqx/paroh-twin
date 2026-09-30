"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import type { FaceState } from "../TwinFace/TwinFace";
import "./TwinStage.css";

export interface TwinStageProps {
  state: FaceState;
  level?: number;
  /** Approved fact text only; words are visual captions, never sent anywhere. */
  memoryWords?: string[];
  children?: ReactNode;
}

const arcs = [
  "M 280 345 C 198 270 198 170 280 112",
  "M 720 345 C 802 270 802 170 720 112",
  "M 248 430 C 132 382 92 296 112 214",
  "M 752 430 C 868 382 908 296 888 214",
];
const particleOffsets = [[-36, -25], [34, -31], [-41, 20], [45, 25], [-12, -42], [14, 40]] as const;

/** Full-viewport voice ambience, composed behind its children without canvas or audio capture. */
export default function TwinStage({ state, level = 0, memoryWords = [], children }: TwinStageProps) {
  const active = state === "speaking" || state === "listening";
  const reduce = useReducedMotion();
  return (
    <section className={`twin-stage-shell ${active ? "active" : ""} stage-${state}`} style={{ ["--stage-level" as string]: Math.max(0, Math.min(1, level)) }}>
      <div className="twin-stage-backdrop" aria-hidden="true">
        <div className="twin-stage-aurora" />
        <svg className="twin-stage-rings" viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid slice">
          <defs><radialGradient id="twin-stage-glow"><stop stopColor="var(--violet)" stopOpacity="0.24"/><stop offset="1" stopColor="var(--teal)" stopOpacity="0"/></radialGradient></defs>
          <circle cx="500" cy="340" r="265" fill="url(#twin-stage-glow)" />
          <g className="twin-stage-concentric"><circle cx="500" cy="340" r="190"/><circle cx="500" cy="340" r="250"/><circle cx="500" cy="340" r="322"/></g>
          <g className="twin-stage-arcs">{arcs.map((d) => <path key={d} d={d} />)}</g>
        </svg>
        <div className="twin-stage-particles">
          {particleOffsets.map(([x, y], i) => <span key={i} className="stage-particle" style={{ ["--dx" as string]: `${x}vw`, ["--dy" as string]: `${y}vh`, ["--delay" as string]: `${i * -0.48}s` }} />)}
        </div>
        <div className="twin-stage-memories">
          {memoryWords.slice(0, 8).map((word, i) => (
            <motion.span key={`${i}-${word}`} initial={{ opacity: 0, y: 8 }} animate={reduce ? { opacity: active ? 0.52 : 0, y: 0 } : active ? { opacity: [0, 0.72, 0], y: [8, -3, -12] } : { opacity: 0, y: 8 }} transition={reduce ? { duration: 0 } : { duration: 4.6, delay: i * 0.48, repeat: active ? Infinity : 0, ease: "easeInOut" }} style={{ left: `${12 + (i * 17) % 70}%`, top: `${20 + (i * 13) % 58}%` }}>{word.slice(0, 48)}</motion.span>
          ))}
        </div>
      </div>
      <div className="twin-stage-content">{children}</div>
    </section>
  );
}
