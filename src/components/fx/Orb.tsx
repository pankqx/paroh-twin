"use client";

import type { CSSProperties, ReactNode } from "react";
import "./Orb.css";

/**
 * Orb. Hand-written equivalent of the React Bits "Orb" role (no WebGL): a
 * glowing sphere built from static gradient layers, with a swirl layer that
 * rotates and a body that breathes. Only transform and opacity animate.
 */
export default function Orb({
  hue = "var(--violet)",
  accent = "var(--teal)",
  spin = 24,
  breathe = 6,
  glow = 0.7,
  className,
  style,
  children,
}: {
  hue?: string; // main colour
  accent?: string; // swirl colour
  spin?: number; // seconds per swirl rotation
  breathe?: number; // seconds per breath
  glow?: number; // 0-1 halo strength
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}) {
  const vars = {
    ["--orb-hue" as string]: hue,
    ["--orb-accent" as string]: accent,
    ["--orb-spin" as string]: `${spin}s`,
    ["--orb-breathe" as string]: `${breathe}s`,
    ["--orb-glow" as string]: Math.min(Math.max(glow, 0), 1),
    ...style,
  };
  return (
    <div className={`fx-orb ${className ?? ""}`} style={vars}>
      <div className="fx-orb-halo" />
      <div className="fx-orb-body">
        <div className="fx-orb-swirl" />
        <div className="fx-orb-shine" />
      </div>
      {children && <div className="fx-orb-content">{children}</div>}
    </div>
  );
}
