"use client";

import { useEffect, useImperativeHandle, useRef, type Ref } from "react";
import "./LivingCore.css";

export interface CoreDomain {
  key: string;
  label: string;
  confidence: number; // 0-1
}

export interface LivingCoreHandle {
  /** Bright pulse on a node; with `fromConfidence` it also glides inward from there. */
  flare(key: string, fromConfidence?: number): void;
}

interface Props {
  domains: CoreDomain[];
  load: number; // weekly workload, percent
  fidelity: number; // 0-1
  ref?: Ref<LivingCoreHandle>;
}

type RGB = [number, number, number];

interface NodeState {
  shown: number; // displayed confidence, eases toward the real one
  flareAt: number; // ms timestamp, -Infinity when idle
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  phase: number;
}

const SPARSE_BELOW = 0.3;
const ROTATE_PER_MS = (Math.PI * 2) / 240000; // one turn every four minutes
const FLARE_MS = 1400;
const PARTICLES = 70;

function hexToRgb(hex: string, fallback: RGB): RGB {
  const m = hex.trim().match(/^#?([0-9a-f]{6})$/i);
  if (!m) return fallback;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const mix = (a: RGB, b: RGB, t: number): RGB => [
  Math.round(a[0] + (b[0] - a[0]) * t),
  Math.round(a[1] + (b[1] - a[1]) * t),
  Math.round(a[2] + (b[2] - a[2]) * t),
];

const rgba = (c: RGB, a: number) => `rgba(${c[0]},${c[1]},${c[2]},${Math.max(0, Math.min(1, a))})`;

function makeParticles(seed = 7): Particle[] {
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  return Array.from({ length: PARTICLES }, () => {
    const angle = rnd() * Math.PI * 2;
    const speed = 0.000004 + rnd() * 0.000008;
    return {
      x: rnd(),
      y: rnd(),
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      r: 0.5 + rnd() * 1.3,
      phase: rnd() * Math.PI * 2,
    };
  });
}

export default function LivingCore({ domains, load, fidelity, ref }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const latest = useRef({ domains, load, fidelity });
  const nodes = useRef(new Map<string, NodeState>());
  const redraw = useRef<() => void>(() => {});

  useEffect(() => {
    latest.current = { domains, load, fidelity };
    redraw.current();
  }, [domains, load, fidelity]);

  useImperativeHandle(
    ref,
    () => ({
      flare(key, fromConfidence) {
        const node = nodes.current.get(key) ?? { shown: 0, flareAt: -Infinity };
        if (fromConfidence !== undefined) node.shown = fromConfidence;
        node.flareAt = performance.now();
        nodes.current.set(key, node);
        redraw.current();
      },
    }),
    [],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const css = getComputedStyle(document.documentElement);
    const token = (name: string, fallback: RGB) => hexToRgb(css.getPropertyValue(name), fallback);
    const violet = token("--violet", [139, 124, 255]);
    const teal = token("--teal", [79, 209, 197]);
    const amber = token("--amber", [246, 179, 92]);
    const rose = token("--rose", [244, 114, 166]);
    const text = token("--text", [237, 239, 250]);
    const muted = token("--muted", [155, 163, 199]);

    const still = window.matchMedia("(prefers-reduced-motion: reduce)");
    const particles = makeParticles();
    let size = 0;
    let frame = 0;
    let last = performance.now();
    let rotation = 0;
    let shownFidelity = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      size = canvas.clientWidth;
      canvas.width = Math.round(size * dpr);
      canvas.height = Math.round(size * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const draw = (now: number) => {
      const dt = Math.min(now - last, 64);
      last = now;
      const moving = !still.matches;
      const { domains: doms, load: ld, fidelity: fid } = latest.current;
      const S = size;
      const C = S / 2;
      if (!S) return;

      ctx.clearRect(0, 0, S, S);
      if (moving) rotation += dt * ROTATE_PER_MS;
      const ease = moving ? 1 - Math.exp(-dt / 320) : 1;
      shownFidelity += (fid - shownFidelity) * (moving ? 1 - Math.exp(-dt / 260) : 1);

      // Drifting particles
      for (const p of particles) {
        if (moving) {
          p.x = (p.x + p.vx * dt + 1) % 1;
          p.y = (p.y + p.vy * dt + 1) % 1;
        }
        const tw = 0.35 + 0.35 * Math.sin(now * 0.0012 + p.phase);
        ctx.fillStyle = rgba(mix(violet, teal, p.x), moving ? tw : 0.4);
        ctx.beginPath();
        ctx.arc(p.x * S, p.y * S, p.r, 0, Math.PI * 2);
        ctx.fill();
      }

      // Weekly load ring
      const ringR = S * 0.47;
      const loadColour = ld > 85 ? rose : ld >= 60 ? amber : teal;
      ctx.lineWidth = 1;
      ctx.strokeStyle = "rgba(255,255,255,0.08)";
      ctx.beginPath();
      ctx.arc(C, C, ringR, 0, Math.PI * 2);
      ctx.stroke();
      ctx.save();
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";
      ctx.strokeStyle = rgba(loadColour, 0.9);
      ctx.shadowColor = rgba(loadColour, 0.8);
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.arc(C, C, ringR, -Math.PI / 2, -Math.PI / 2 + (Math.min(Math.max(ld, 0), 100) / 100) * Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // Core glow (breathes slowly)
      const coreR = S * 0.11;
      const breathe = moving ? 1 + 0.04 * Math.sin(now / 1700) : 1;
      const halo = ctx.createRadialGradient(C, C, coreR * 0.4, C, C, coreR * 3.2 * breathe);
      halo.addColorStop(0, rgba(violet, 0.5));
      halo.addColorStop(0.45, rgba(teal, 0.12));
      halo.addColorStop(1, rgba(teal, 0));
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(C, C, coreR * 3.2 * breathe, 0, Math.PI * 2);
      ctx.fill();

      // Nodes and threads
      const n = doms.length;
      doms.forEach((d, i) => {
        const target = Math.min(Math.max(d.confidence, 0), 1);
        const state = nodes.current.get(d.key) ?? { shown: 0, flareAt: -Infinity };
        state.shown += (target - state.shown) * ease;
        nodes.current.set(d.key, state);

        const conf = state.shown;
        const sparse = target < SPARSE_BELOW;
        const colour = mix(violet, teal, n > 1 ? i / (n - 1) : 0);
        const angle = (i / n) * Math.PI * 2 - Math.PI / 2 + rotation;
        const wobble = moving ? Math.sin(now / 2400 + i * 1.7) * S * 0.006 : 0;
        const orbit = S * (0.2 + (1 - conf) * 0.21) + wobble;
        const x = C + Math.cos(angle) * orbit;
        const y = C + Math.sin(angle) * orbit;
        const bright = sparse ? 0.4 : 0.55 + 0.45 * conf;
        const flareP = (now - state.flareAt) / FLARE_MS;
        const flaring = flareP >= 0 && flareP < 1;
        const boost = flaring ? 1 - flareP : 0;
        const nodeR = 5 + conf * 5 + boost * 3;

        // thread to the core
        const tx = C + Math.cos(angle) * coreR;
        const ty = C + Math.sin(angle) * coreR;
        const thread = ctx.createLinearGradient(tx, ty, x, y);
        thread.addColorStop(0, rgba(violet, 0.05));
        thread.addColorStop(1, rgba(colour, (sparse ? 0.22 : 0.45) * bright + boost * 0.5));
        ctx.strokeStyle = thread;
        ctx.lineWidth = 1 + boost;
        ctx.setLineDash(sparse ? [3, 5] : []);
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(x, y);
        ctx.stroke();
        ctx.setLineDash([]);

        // glow
        const glowR = nodeR * (3.2 + boost * 3);
        const glow = ctx.createRadialGradient(x, y, 0, x, y, glowR);
        glow.addColorStop(0, rgba(colour, (sparse ? 0.12 : 0.35) * bright + boost * 0.6));
        glow.addColorStop(1, rgba(colour, 0));
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(x, y, glowR, 0, Math.PI * 2);
        ctx.fill();

        // body
        ctx.beginPath();
        ctx.arc(x, y, nodeR, 0, Math.PI * 2);
        if (sparse && !flaring) {
          ctx.setLineDash([2.5, 3]);
          ctx.strokeStyle = rgba(colour, 0.6);
          ctx.lineWidth = 1.2;
          ctx.stroke();
          ctx.setLineDash([]);
        } else {
          ctx.fillStyle = rgba(mix(colour, [255, 255, 255], 0.25 + boost * 0.5), bright);
          ctx.fill();
        }

        // flare ring
        if (flaring) {
          ctx.strokeStyle = rgba(mix(colour, [255, 255, 255], 0.4), (1 - flareP) * 0.9);
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(x, y, nodeR + flareP * S * 0.09, 0, Math.PI * 2);
          ctx.stroke();
        }

        // label, pushed outward from the node
        const lx = x + Math.cos(angle) * (nodeR + 14);
        const ly = y + Math.sin(angle) * (nodeR + 14);
        const cos = Math.cos(angle);
        ctx.textAlign = Math.abs(cos) < 0.3 ? "center" : cos > 0 ? "left" : "right";
        ctx.textBaseline = "middle";
        ctx.font = `500 ${Math.max(11, S * 0.03)}px Inter, system-ui, sans-serif`;
        ctx.fillStyle = rgba(sparse ? muted : text, sparse ? 0.75 : 0.92);
        ctx.fillText(d.label, lx, ly - S * 0.012);
        ctx.font = `500 ${Math.max(10, S * 0.025)}px Inter, system-ui, sans-serif`;
        ctx.fillStyle = rgba(muted, 0.85);
        ctx.fillText(`${Math.round(target * 100)}%`, lx, ly + S * 0.024);
      });

      // Core orb
      const orb = ctx.createRadialGradient(C - coreR * 0.3, C - coreR * 0.35, coreR * 0.1, C, C, coreR);
      orb.addColorStop(0, "rgba(40,36,78,0.95)");
      orb.addColorStop(1, "rgba(16,18,36,0.95)");
      ctx.fillStyle = orb;
      ctx.beginPath();
      ctx.arc(C, C, coreR, 0, Math.PI * 2);
      ctx.fill();
      const rim = ctx.createLinearGradient(C - coreR, C + coreR, C + coreR, C - coreR);
      rim.addColorStop(0, rgba(violet, 0.9));
      rim.addColorStop(1, rgba(teal, 0.9));
      ctx.strokeStyle = rim;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = rgba(text, 1);
      ctx.font = `600 ${coreR * 0.62}px Fraunces, Georgia, serif`;
      ctx.fillText(`${Math.round(shownFidelity * 100)}%`, C, C - coreR * 0.1);
      ctx.fillStyle = rgba(muted, 1);
      ctx.font = `500 ${Math.max(9, coreR * 0.2)}px Inter, system-ui, sans-serif`;
      ctx.fillText("fidelity", C, C + coreR * 0.42);
    };

    const loop = (now: number) => {
      draw(now);
      if (!still.matches) frame = requestAnimationFrame(loop);
    };

    // Reduced motion: one complete, still frame, redrawn only when something changes.
    redraw.current = () => {
      if (still.matches) draw(performance.now());
    };

    const start = () => {
      cancelAnimationFrame(frame);
      last = performance.now();
      frame = requestAnimationFrame(loop);
    };

    const observer = new ResizeObserver(() => {
      resize();
      redraw.current();
    });
    observer.observe(canvas);
    resize();
    start();
    still.addEventListener("change", start);
    document.fonts?.ready.then(() => redraw.current());

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      still.removeEventListener("change", start);
      redraw.current = () => {};
    };
  }, []);

  const pct = (v: number) => `${Math.round(v * 100)}%`;
  const summary = domains.map((d) => `${d.label} ${pct(d.confidence)}`).join(", ");

  return (
    <canvas
      ref={canvasRef}
      className="living-core"
      role="img"
      aria-label={`Living Core. Twin fidelity ${pct(fidelity)}. Weekly workload ${Math.round(load)}%. How well the twin knows each area: ${summary}.`}
    />
  );
}
