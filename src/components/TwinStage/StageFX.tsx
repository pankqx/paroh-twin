"use client";

import { useEffect, useRef } from "react";
import { mindTarget } from "@/components/TwinAvatar/mindPoint";
import type { AvatarState } from "@/components/TwinAvatar/avatarStore";
import { useStageData } from "./useStageData";
import "./StageFX.css";

const COLOURS = ["94, 234, 212", "167, 139, 250", "251, 191, 36"]; // teal, violet, amber

/**
 * The glow behind her while you talk: aurora ribbons that pulse with your voice, a slow HUD
 * ring, sound arcs while she speaks, stat chips drifting around her (real values), and
 * particles spiralling into her mind point. One small canvas, everything else CSS transforms.
 * The host sets --cx (her centre), --top and --h (her box) on its root.
 */
export default function StageFX({ active, state, level }: { active: boolean; state: AvatarState; level: number }) {
  const { twin } = useStageData(active);
  const canvas = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef({ state, level });
  useEffect(() => {
    stateRef.current = { state, level };
  });

  // Particles: a half-resolution canvas, only while this stage is showing and the tab is visible.
  useEffect(() => {
    const cv = canvas.current;
    if (!active || !cv) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const SCALE = 0.5;
    const resize = () => {
      cv.width = Math.round(window.innerWidth * SCALE);
      cv.height = Math.round(window.innerHeight * SCALE);
    };
    resize();
    window.addEventListener("resize", resize);

    const N = 64;
    const parts = Array.from({ length: N }, (_, i) => ({ a: (i / N) * Math.PI * 2, r: 0.2 + Math.random() * 0.8, s: 0.03 + Math.random() * 0.05, c: COLOURS[i % 3], sz: 0.6 + Math.random() * 1.1 }));
    let tx = window.innerWidth / 2;
    let ty = window.innerHeight * 0.25;
    let lastProbe = 0;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      if (now - lastProbe > 150) {
        lastProbe = now;
        const p = mindTarget()?.point();
        if (p) {
          tx = p.x;
          ty = p.y;
        }
      }
      const boost = 1 + stateRef.current.level * 1.6 + (stateRef.current.state === "speaking" ? 0.5 : 0);
      const R0 = Math.min(window.innerWidth, window.innerHeight) * 0.42;
      ctx.clearRect(0, 0, cv.width, cv.height);
      for (const p of parts) {
        p.r -= p.s * dt * boost;
        p.a += dt * (1.2 + (1 - p.r) * 2.4);
        if (p.r <= 0.02) {
          p.r = 1;
          p.a = Math.random() * Math.PI * 2;
        }
        const rr = p.r * R0;
        const x = (tx + Math.cos(p.a) * rr) * SCALE;
        const y = (ty + Math.sin(p.a) * rr * 0.75) * SCALE;
        const alpha = Math.min(1, p.r * 1.6) * (p.r < 0.12 ? p.r / 0.12 : 1) * 0.85;
        ctx.fillStyle = `rgba(${p.c}, ${alpha.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(x, y, p.sz * (1 + (1 - p.r)), 0, 7);
        ctx.fill();
      }
    };
    raf = requestAnimationFrame(tick);
    const onVis = () => {
      if (document.hidden) cancelAnimationFrame(raf);
      else {
        last = performance.now();
        raf = requestAnimationFrame(tick);
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("resize", resize);
    };
  }, [active]);

  const chips = twin
    ? [
        { k: "load", v: `${Math.round(twin.loadPct)}%`, c: "var(--amber)" },
        { k: "fidelity", v: `${Math.round(twin.fidelity * 100)}%`, c: "var(--violet)" },
        { k: "habits", v: `${Math.round(twin.habitConsistency * 100)}%`, c: "var(--green)" },
        { k: "goals", v: `${Math.round(twin.goalAlignment * 100)}%`, c: "var(--teal)" },
      ]
    : [];

  return (
    <div className={`stage-fx${active ? " on" : ""} st-${state}`} style={{ ["--lvl" as string]: level }} aria-hidden="true">
      <svg className="sf-ribbons" viewBox="0 0 1440 900" preserveAspectRatio="none">
        <defs>
          <linearGradient id="sf-r1" x1="0" x2="1">
            <stop offset="0" stopColor="var(--teal)" stopOpacity="0" />
            <stop offset="0.5" stopColor="var(--teal)" stopOpacity="0.9" />
            <stop offset="1" stopColor="var(--violet)" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="sf-r2" x1="0" x2="1">
            <stop offset="0" stopColor="var(--violet)" stopOpacity="0" />
            <stop offset="0.5" stopColor="var(--violet)" stopOpacity="0.9" />
            <stop offset="1" stopColor="var(--rose)" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="sf-r3" x1="0" x2="1">
            <stop offset="0" stopColor="var(--amber)" stopOpacity="0" />
            <stop offset="0.5" stopColor="var(--amber)" stopOpacity="0.8" />
            <stop offset="1" stopColor="var(--teal)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <g className="sf-rib a">
          <path d="M -50 300 C 300 120, 560 420, 900 250 S 1300 120, 1500 260" stroke="url(#sf-r1)" />
        </g>
        <g className="sf-rib b">
          <path d="M -50 470 C 260 560, 600 300, 940 470 S 1300 600, 1500 440" stroke="url(#sf-r2)" />
        </g>
        <g className="sf-rib c">
          <path d="M -50 680 C 280 560, 620 760, 960 640 S 1320 520, 1500 650" stroke="url(#sf-r3)" />
        </g>
      </svg>

      <div className="sf-hud">
        <svg viewBox="0 0 200 200">
          <g className="sf-ring slow">
            <circle cx="100" cy="100" r="96" />
            <circle cx="100" cy="100" r="96" className="ticks" />
          </g>
          <g className="sf-ring fast">
            <circle cx="100" cy="100" r="86" className="dash" />
          </g>
        </svg>
      </div>

      <div className="sf-arcs">
        {[0, 1, 2].map((i) => (
          <span key={i} className="sf-arc" style={{ animationDelay: `${i * 0.55}s` }} />
        ))}
      </div>

      <div className="sf-orbit">
        {chips.map((c, i) => (
          <div key={c.k} className="sf-chip-x" style={{ animationDelay: `${-i * 7.5}s` }}>
            <div className="sf-chip-y" style={{ animationDelay: `${-i * 7.5 - 7.5}s` }}>
              <span className="sf-chip" style={{ ["--c" as string]: c.c }}>
                <em>{c.k}</em> <b className="num">{c.v}</b>
              </span>
            </div>
          </div>
        ))}
      </div>

      <canvas ref={canvas} className="sf-particles" />
    </div>
  );
}
