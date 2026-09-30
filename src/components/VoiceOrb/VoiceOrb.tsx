"use client";

import { motion, useReducedMotion, useSpring } from "motion/react";
import { useEffect } from "react";
import Orb from "@/components/fx/Orb";
import "./VoiceOrb.css";

export type VoiceState = "idle" | "listening" | "thinking" | "speaking";

export interface OrbDomain {
  key: string;
  label: string;
  confidence: number; // 0-1
}

interface Props {
  state: VoiceState;
  level?: number; // 0-1 live input level while listening (never recorded)
  confidence: OrbDomain[]; // one ring segment per domain
  load: number; // weekly load, percent
  fidelity: number; // 0-1
  flare?: string[]; // domain keys that just grew: their segments pulse once
}

// Colour per state (also the reduced-motion signal).
const HUES: Record<VoiceState, [string, string]> = {
  idle: ["var(--violet)", "var(--teal)"],
  listening: ["var(--teal)", "var(--violet)"],
  thinking: ["var(--amber)", "var(--violet)"],
  speaking: ["var(--violet)", "var(--rose)"],
};

const STATE_LABEL: Record<VoiceState, string> = {
  idle: "resting",
  listening: "listening",
  thinking: "thinking",
  speaking: "speaking",
};

const R = 92; // ring radius in a 220 x 220 box
const C = 110;
const GAP = 7; // degrees between segments
const SPARSE_BELOW = 0.3;

function arc(start: number, end: number) {
  const rad = (d: number) => ((d - 90) * Math.PI) / 180;
  const [x0, y0] = [C + R * Math.cos(rad(start)), C + R * Math.sin(rad(start))];
  const [x1, y1] = [C + R * Math.cos(rad(end)), C + R * Math.sin(rad(end))];
  return `M ${x0} ${y0} A ${R} ${R} 0 0 1 ${x1} ${y1}`;
}

export default function VoiceOrb({ state, level = 0, confidence, load, fidelity, flare = [] }: Props) {
  const reduce = useReducedMotion();
  const scale = useSpring(1, { stiffness: 260, damping: 18 });

  // Listening: the orb swells with the live input level.
  useEffect(() => {
    scale.set(state === "listening" && !reduce ? 1 + Math.min(Math.max(level, 0), 1) * 0.12 : 1);
  }, [state, level, reduce, scale]);

  // Pulse speed from load, faster while speaking; swirl faster while thinking.
  const loadBreath = Math.max(2.5, 7 - (Math.min(load, 120) / 100) * 4.5);
  const breathe = state === "speaking" ? 0.9 : state === "listening" ? 2.2 : loadBreath;
  const spin = state === "thinking" ? 3.5 : 22;
  const ringSpin = state === "thinking" ? 8 : 90;
  const [hue, accent] = HUES[state];
  const step = 360 / Math.max(confidence.length, 1);
  const pct = Math.round(fidelity * 100);

  return (
    <div
      className={`voice-orb state-${state}`}
      role="img"
      aria-label={`Twin ${STATE_LABEL[state]}. Fidelity ${pct}%. Weekly load ${Math.round(load)}%. ${confidence
        .map((d) => `${d.label} ${Math.round(d.confidence * 100)}%`)
        .join(", ")}.`}
      style={{ ["--ring-spin" as string]: `${ringSpin}s` }}
    >
      <svg className="voice-orb-ring" viewBox="0 0 220 220" aria-hidden="true">
        <g className="voice-orb-ring-spin">
          {confidence.map((d, i) => {
            const conf = Math.min(Math.max(d.confidence, 0), 1);
            const sparse = conf < SPARSE_BELOW;
            const colour = `color-mix(in srgb, var(--teal) ${Math.round((i / Math.max(confidence.length - 1, 1)) * 100)}%, var(--violet))`;
            return (
              <motion.path
                key={d.key}
                d={arc(i * step + GAP / 2, (i + 1) * step - GAP / 2)}
                className={`voice-orb-seg ${sparse ? "sparse" : ""} ${flare.includes(d.key) ? "flare" : ""}`}
                stroke={colour}
                strokeWidth={1.5 + conf * 6}
                initial={reduce ? false : { pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: sparse ? 0.55 : 0.5 + conf * 0.5 }}
                transition={{ duration: 1.2, delay: 0.2 + i * 0.08, ease: [0.2, 0.7, 0.2, 1] }}
              />
            );
          })}
        </g>
        {confidence.map((d, i) => {
          const mid = ((i + 0.5) * step - 90) * (Math.PI / 180);
          return (
            <text
              key={d.key}
              x={C + (R + 16) * Math.cos(mid)}
              y={C + (R + 16) * Math.sin(mid)}
              className="voice-orb-label"
              textAnchor="middle"
              dominantBaseline="middle"
            >
              {d.label}
            </text>
          );
        })}
      </svg>

      <motion.div className="voice-orb-core" style={{ scale }}>
        <Orb hue={hue} accent={accent} spin={spin} breathe={breathe} glow={0.3 + fidelity * 0.7}>
          <span className="voice-orb-pct num">{pct}%</span>
          <span className="voice-orb-caption">fidelity</span>
        </Orb>
      </motion.div>
    </div>
  );
}
