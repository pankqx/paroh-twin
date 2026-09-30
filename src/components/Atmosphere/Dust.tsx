"use client";

import { useEffect, useRef } from "react";

interface Mote {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  ph: number;
  c: number; // 0 or 1: which accent
}

const PULL_RADIUS = 300;

/**
 * Drift dust: one small 2D canvas, max 60 motes, DPR capped at 1.5. Motes drift slowly and
 * lean toward the cursor. `flow="inward"` (Sources) sends them toward the centre instead.
 * Pauses when the tab is hidden; under reduced motion it draws one still frame and stops.
 */
export default function Dust({ count, accent, flow }: { count: number; accent: [string, string]; flow?: "inward" }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const n = Math.min(count, 60);
    const still = window.matchMedia("(prefers-reduced-motion: reduce)");
    const rgb = (v: string): [number, number, number] => {
      const probe = document.createElement("span");
      probe.style.color = v;
      document.body.appendChild(probe);
      const m = getComputedStyle(probe).color.match(/\d+/g) ?? ["167", "139", "250"];
      probe.remove();
      return [Number(m[0]), Number(m[1]), Number(m[2])];
    };
    const colours = [rgb(accent[0]), rgb(accent[1])];

    let w = 0;
    let h = 0;
    let raf = 0;
    let last = performance.now();
    const pointer = { x: -9999, y: -9999 };

    let seed = 12345;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const motes: Mote[] = Array.from({ length: n }, () => ({
      x: rnd(),
      y: rnd(),
      vx: (rnd() - 0.5) * 0.000012,
      vy: (rnd() - 0.5) * 0.000012,
      r: 0.8 + rnd() * 1.6,
      ph: rnd() * Math.PI * 2,
      c: rnd() < 0.5 ? 0 : 1,
    }));

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (still.matches) draw(performance.now(), 0);
    };

    const draw = (now: number, dt: number) => {
      ctx.clearRect(0, 0, w, h);
      for (const m of motes) {
        if (dt) {
          const px = m.x * w;
          const py = m.y * h;
          if (flow === "inward") {
            // drift toward the middle, then re-enter from the edge
            m.vx += (0.5 - m.x) * 0.0000006 * dt;
            m.vy += (0.5 - m.y) * 0.0000006 * dt;
            if (Math.hypot(m.x - 0.5, m.y - 0.5) < 0.06) {
              const a = rnd() * Math.PI * 2;
              m.x = 0.5 + Math.cos(a) * 0.62;
              m.y = 0.5 + Math.sin(a) * 0.62;
              m.vx = m.vy = 0;
            }
          }
          const dx = pointer.x - px;
          const dy = pointer.y - py;
          const d = Math.hypot(dx, dy);
          if (d < PULL_RADIUS && d > 1) {
            const k = (1 - d / PULL_RADIUS) * 0.0000009 * dt;
            m.vx += (dx / d) * k;
            m.vy += (dy / d) * k;
          }
          m.vx *= 0.999;
          m.vy *= 0.999;
          m.x += m.vx * dt;
          m.y += m.vy * dt;
          if (flow !== "inward") {
            m.x = (m.x + 1) % 1;
            m.y = (m.y + 1) % 1;
          }
        }
        const a = (0.28 + 0.22 * Math.sin(now * 0.0011 + m.ph)) * (still.matches ? 0.8 : 1);
        const [r, g, b] = colours[m.c];
        const x = m.x * w;
        const y = m.y * h;
        ctx.fillStyle = `rgba(${r},${g},${b},${a * 0.22})`;
        ctx.beginPath();
        ctx.arc(x, y, m.r * 4, 0, 6.2832);
        ctx.fill();
        ctx.fillStyle = `rgba(${r},${g},${b},${a + 0.25})`;
        ctx.beginPath();
        ctx.arc(x, y, m.r, 0, 6.2832);
        ctx.fill();
      }
    };

    const tick = (now: number) => {
      const dt = Math.min(now - last, 64);
      last = now;
      draw(now, dt);
      raf = requestAnimationFrame(tick);
    };
    const start = () => {
      cancelAnimationFrame(raf);
      if (still.matches || document.hidden) return;
      last = performance.now();
      raf = requestAnimationFrame(tick);
    };
    const onVisibility = () => (document.hidden ? cancelAnimationFrame(raf) : start());
    const onMove = (e: PointerEvent) => {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
    };

    resize();
    start();
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);
    still.addEventListener("change", start);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("visibilitychange", onVisibility);
      still.removeEventListener("change", start);
    };
  }, [count, accent, flow]);

  return <canvas ref={ref} className="atmo-dust" />;
}
