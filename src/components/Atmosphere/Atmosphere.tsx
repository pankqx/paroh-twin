"use client";

import { useReducedMotion } from "motion/react";
import Dust from "./Dust";
import { FpsMeter, useDevKeys } from "./DevTools";
import GridTicks from "./GridTicks";
import Hud from "./Hud";
import Marquee from "./Marquee";
import Motes from "./Motes";
import OrbitLines from "./OrbitLines";
import { VARIANTS, type AtmosphereVariant } from "./config";
import { useTelemetry } from "./useTelemetry";
import "./Atmosphere.css";

/**
 * The living space around every page: orbit lines, drift dust, a horizon grid with ruler
 * ticks, HUD readouts and a honesty ticker. Fixed behind the content, never interactive
 * (the ticker only listens for hover so it can pause). Press D to hide it, F for an FPS readout.
 */
export default function Atmosphere({ variant }: { variant: AtmosphereVariant }) {
  const cfg = VARIANTS[variant];
  const reduce = useReducedMotion();
  const { on, fps } = useDevKeys();
  const telemetry = useTelemetry(on && cfg.hud);

  return (
    <>
      {on && (
        <div className="atmosphere" data-variant={variant} data-still={reduce ? "" : undefined} aria-hidden="true" style={{ ["--atmo" as string]: cfg.strength, ["--a1" as string]: cfg.accent[0], ["--a2" as string]: cfg.accent[1] }}>
          <OrbitLines rings={cfg.rings} accent={cfg.accent} />
          {cfg.dust.kind === "svg" && <Motes accent={cfg.accent} />}
          {cfg.dust.kind === "canvas" && <Dust count={cfg.dust.count} accent={cfg.accent} flow={cfg.dust.flow} />}
          <GridTicks grid={cfg.grid} />
          {cfg.hud && <Hud t={telemetry} />}
          {cfg.marquee && <Marquee />}
        </div>
      )}
      {fps && <FpsMeter atmosphereOn={on} />}
    </>
  );
}
