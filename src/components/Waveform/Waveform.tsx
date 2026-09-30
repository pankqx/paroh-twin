"use client";

import "./Waveform.css";

const BARS = 36;

// Fixed, pleasant-looking per-bar shape (no randomness, so server and client agree).
const SHAPE = Array.from({ length: BARS }, (_, i) => {
  const edge = Math.sin(((i + 0.5) / BARS) * Math.PI); // taller in the middle
  return 0.35 + 0.65 * edge * (0.72 + 0.28 * Math.sin(i * 2.3));
});

/**
 * A bar waveform. `level` (0-1) is the live microphone level; with `live` off it breathes
 * gently instead. Bars scale with transform only, driven by one CSS variable.
 */
export default function Waveform({ level = 0, live = false, label }: { level?: number; live?: boolean; label?: string }) {
  const amp = live ? Math.min(1, 0.08 + level * 1.4) : 0.1;
  return (
    <div
      className={`wave${live ? " live" : ""}`}
      style={{ ["--amp" as string]: amp }}
      role="img"
      aria-label={label ?? (live ? "Microphone level" : "Idle")}
    >
      {SHAPE.map((k, i) => (
        <span key={i} style={{ ["--k" as string]: k, animationDelay: `${-(i * 0.17) % 1.6}s`, animationDuration: `${1.1 + (i % 5) * 0.17}s` }} />
      ))}
    </div>
  );
}
