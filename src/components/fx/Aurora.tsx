"use client";

import "./Aurora.css";

/**
 * Aurora background. Hand-written equivalent of the React Bits "Aurora" role
 * (no WebGL): three large blurred colour fields that drift using transform only.
 * Fixed behind the page; use on the Twin page only.
 */
export default function Aurora({
  colorStops = ["var(--teal)", "var(--violet)", "var(--amber)"],
  amplitude = 1,
  speed = 1,
}: {
  colorStops?: [string, string, string];
  amplitude?: number; // 0-2, how far the fields drift
  speed?: number; // 1 = default pace
}) {
  const style = {
    ["--a1" as string]: colorStops[0],
    ["--a2" as string]: colorStops[1],
    ["--a3" as string]: colorStops[2],
    ["--amp" as string]: amplitude,
    ["--dur" as string]: `${28 / Math.max(speed, 0.1)}s`,
  };
  return (
    <div className="fx-aurora" aria-hidden="true" style={style}>
      <span className="fx-aurora-field f1" />
      <span className="fx-aurora-field f2" />
      <span className="fx-aurora-field f3" />
    </div>
  );
}
