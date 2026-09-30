"use client";

import { motion } from "motion/react";
import { useEffect, useId, useImperativeHandle, useRef, useState, type Ref } from "react";
import * as G from "./geometry";
import { registerMindPoint } from "./mindPoint";
import "./TwinFace.css";

export type FaceState = "idle" | "listening" | "thinking" | "speaking";

export interface TwinFaceHandle {
  /** Flare the mind point (an approved fact just arrived). */
  flare(): void;
  /** Mind point centre in viewport coordinates. */
  mindPoint(): { x: number; y: number } | null;
}

interface Props {
  state: FaceState;
  /** Live input level 0-1 while listening (drives the ring around her). */
  level?: number;
  /** Mouth shape 0 closed, 1 slight, 2 open, 3 wide. Omit to let her talk on her own. */
  mouth?: 0 | 1 | 2 | 3;
  /** Where she looks, -1..1 on each axis. Omit to follow the cursor. */
  lookAt?: { x: number; y: number };
  /** Scale to about 90vh and centre in the space she is given. */
  fill?: boolean;
  className?: string;
  ref?: Ref<TwinFaceHandle>;
}

const EASE = [0.2, 0.7, 0.2, 1] as const;

// motion's useReducedMotion returns a ref value that does not re-render after hydration, which
// left the draw-on stuck part-way for people who prefer reduced motion. Track it as state.
function useReducedMotionState(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduce(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return reduce;
}
const clamp = (v: number, lo = -1, hi = 1) => Math.min(hi, Math.max(lo, v));

// A draw-on line. With reduced motion it is simply drawn.
function Line({
  d,
  order = 0,
  w,
  o = 1,
  reduce,
  pathRef,
  fill,
  fillOpacity,
}: {
  d: string;
  order?: number;
  w?: number;
  o?: number;
  reduce: boolean | null;
  pathRef?: Ref<SVGPathElement>;
  fill?: string;
  fillOpacity?: number;
}) {
  if (reduce) return <path ref={pathRef} d={d} strokeWidth={w} opacity={o} fill={fill} fillOpacity={fillOpacity} />;
  return (
    <motion.path
      ref={pathRef}
      d={d}
      strokeWidth={w}
      fill={fill}
      fillOpacity={fillOpacity}
      initial={{ pathLength: 0, opacity: 0 }}
      animate={{ pathLength: 1, opacity: o }}
      transition={{ duration: 0.95, delay: 0.1 + order, ease: EASE }}
    />
  );
}

// A hair strand or fine detail line: drawn on with a CSS dash (no JS per path), then idle.
function Strand({ d, order, w = 1, o = 1, sway, dir = 1, dur = 9, rip = false }: {
  d: string;
  order: number;
  w?: number;
  o?: number;
  sway?: number; // index, sets the stagger
  dir?: 1 | -1;
  dur?: number;
  rip?: boolean;
}) {
  const path = (
    <path
      d={d}
      pathLength={1}
      className="tf-strand"
      strokeWidth={w}
      style={{ ["--o" as string]: o, animationDelay: `${0.1 + order}s` }}
    />
  );
  if (sway === undefined) return path;
  return (
    <g
      className={`tf-sway${rip ? " rip" : ""}`}
      style={{ ["--dir" as string]: dir, ["--d" as string]: `${dur}s`, animationDelay: `${-sway * 0.73}s` }}
    >
      {path}
    </g>
  );
}

export default function TwinFace({ state, level = 0, mouth, lookAt, fill, className, ref }: Props) {
  const reduce = useReducedMotionState();
  const uid = useId().replace(/:/g, "");
  const grad = `tf-grad-${uid}`;
  const fade = `tf-fade-${uid}`;
  const mask = `tf-mask-${uid}`;

  const rootRef = useRef<HTMLDivElement>(null);
  const mindRef = useRef<SVGCircleElement>(null);
  const upperRef = useRef<SVGPathElement>(null);
  const lowerRef = useRef<SVGPathElement>(null);
  const gapRef = useRef<SVGPathElement>(null);
  const openRef = useRef(0); // current mouth opening, user units
  const lookRef = useRef<{ x: number; y: number } | null>(null);
  const [flareKey, setFlareKey] = useState(0);

  const mindPoint = () => {
    const r = mindRef.current?.getBoundingClientRect();
    return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null;
  };
  const flare = () => setFlareKey((k) => k + 1);

  useImperativeHandle(ref, () => ({ flare, mindPoint }), []);
  useEffect(() => registerMindPoint({ point: mindPoint, flare }), []);

  // ---- Eyes: follow the cursor, or look where told (thinking glances up and left). ----
  const target = lookAt ?? (state === "thinking" ? { x: -1, y: -1 } : null);
  useEffect(() => {
    lookRef.current = target ? { x: clamp(target.x), y: clamp(target.y) } : null;
    const root = rootRef.current;
    if (!root) return;
    const t = lookRef.current ?? { x: 0, y: 0 };
    root.style.setProperty("--px", `${t.x * 4.5}px`);
    root.style.setProperty("--py", `${t.y * 3.5}px`);
  }, [target?.x, target?.y]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const root = rootRef.current;
    if (!root || reduce) return;
    let raf = 0;
    let tx = 0;
    let ty = 0;
    const apply = () => {
      raf = 0;
      root.style.setProperty("--px", `${tx * 4.5}px`);
      root.style.setProperty("--py", `${ty * 3.5}px`);
    };
    const onMove = (e: PointerEvent) => {
      if (lookRef.current) return;
      const r = root.getBoundingClientRect();
      tx = clamp((e.clientX - (r.left + r.width / 2)) / (window.innerWidth / 2));
      ty = clamp((e.clientY - (r.top + r.height * 0.45)) / (window.innerHeight / 2));
      if (!raf) raf = requestAnimationFrame(apply);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
    };
  }, [reduce]);

  // ---- Blink every 3-6s, 120ms. ----
  useEffect(() => {
    const root = rootRef.current;
    if (!root || reduce) return;
    let timer = 0;
    let off = 0;
    const loop = () => {
      timer = window.setTimeout(() => {
        root.classList.add("blinking");
        off = window.setTimeout(() => root.classList.remove("blinking"), 120);
        loop();
      }, 3000 + Math.random() * 3000);
    };
    loop();
    return () => {
      clearTimeout(timer);
      clearTimeout(off);
      root.classList.remove("blinking");
    };
  }, [reduce]);

  // ---- Mouth: morph between four shapes; talk on her own when no shape is passed. ----
  useEffect(() => {
    const up = upperRef.current;
    const lo = lowerRef.current;
    const gp = gapRef.current;
    if (!up || !lo || !gp) return;
    const write = (h: number) => {
      const p = G.mouthPaths(h);
      up.setAttribute("d", p.upper);
      lo.setAttribute("d", p.lower);
      gp.setAttribute("d", p.gap);
    };
    const talking = state === "speaking" && mouth === undefined;
    const base = mouth !== undefined ? G.MOUTH_OPEN[mouth] : 0;

    if (reduce) {
      openRef.current = talking ? G.MOUTH_OPEN[1] : base;
      write(openRef.current);
      return;
    }

    let raf = 0;
    let last = performance.now();
    let goal = base;
    let nextPick = 0;
    const tick = (now: number) => {
      const dt = Math.min(now - last, 50);
      last = now;
      if (talking && now >= nextPick) {
        const r = Math.random();
        goal = r < 0.2 ? G.MOUTH_OPEN[0] : r < 0.5 ? G.MOUTH_OPEN[1] : r < 0.82 ? G.MOUTH_OPEN[2] : G.MOUTH_OPEN[3];
        nextPick = now + 110 + Math.random() * 55; // about 6-9 shapes a second
      }
      const diff = goal - openRef.current;
      openRef.current += diff * (1 - Math.exp(-dt / 38));
      if (Math.abs(diff) > 0.02 || talking) {
        write(openRef.current);
        raf = requestAnimationFrame(tick);
      } else {
        openRef.current = goal;
        write(goal);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [state, mouth, reduce]);

  const closed = G.mouthPaths(0);
  const swayDur = state === "thinking" ? 3.6 : 9;
  // How loud she is: live input while listening, the mouth shape (or a steady guess) while speaking.
  const amp = state === "speaking" ? Math.max(clamp(level, 0, 1), mouth === undefined ? 0.6 : mouth / 3) : clamp(level, 0, 1);
  const figureProps = { fill: "none", stroke: `url(#${grad})`, strokeLinecap: "round", strokeLinejoin: "round" } as const;

  const eye = (side: "left" | "right", c: { cx: number; cy: number }, order: number) => (
    <g key={side} transform={`translate(${c.cx} ${c.cy})`}>
      <g className="tf-eye">
        <g transform={`translate(${-c.cx} ${-c.cy})`}>
          <clipPath id={`tf-clip-${side}-${uid}`}>
            <path d={G.EYE[side].clip} />
          </clipPath>
          <g clipPath={`url(#tf-clip-${side}-${uid})`}>
            <g className="tf-pupil">
              <g transform={`translate(${c.cx} ${c.cy})`}>
                <circle r="11.5" className="tf-iris" stroke={`url(#${grad})`} fill="none" strokeWidth="1.5" />
                <circle r="7.6" stroke={`url(#${grad})`} fill="none" strokeWidth="0.7" opacity="0.5" />
                <path d={G.IRIS_SPOKES} stroke={`url(#${grad})`} strokeWidth="0.7" opacity="0.6" />
                <g className="tf-pupil-dot">
                  <circle r="4.8" className="tf-pupil-fill" />
                </g>
                <circle cx={side === "left" ? 4 : -4} cy="-3.4" r="1.7" className="tf-glint" />
              </g>
            </g>
          </g>
          <g {...figureProps} strokeWidth="1.6">
            <Line d={G.EYE[side].upper} order={order} reduce={reduce} w={1.9} />
            <Line d={G.EYE[side].lower} order={order} reduce={reduce} />
            <Line d={G.EYE[side].crease} order={order + 0.05} reduce={reduce} o={0.55} w={1.2} />
            <Line d={G.EYE[side].flick} order={order + 0.05} reduce={reduce} w={1.4} />
            <Strand d={G.LASHES[side]} order={order + 0.15} w={1.25} o={0.9} />
          </g>
        </g>
      </g>
    </g>
  );

  const staticLines = (
    <>
      {G.JAW_HATCH.length > 0 && <Strand d={G.JAW_HATCH.join(" ")} order={0.75} w={0.9} o={0.5} />}
      <Strand d={G.CHEEK_LINES.join(" ")} order={0.8} w={0.9} o={0.4} />
      <Strand d={G.TEMPLE_LINES.join(" ")} order={0.7} w={0.9} o={0.4} />
      <Strand d={G.NECK_SHADE.join(" ")} order={0.8} w={0.9} o={0.4} />
      <Strand d={G.NOSE_SHADE.join(" ")} order={0.85} w={0.9} o={0.45} />
      <Strand d={G.THROAT} order={0.85} w={1} o={0.5} />
      <Strand d={G.SHOULDER_DETAIL.join(" ")} order={0.6} w={1} o={0.45} />
      <Line d={G.CONTOUR_LEFT} order={0.3} reduce={reduce} />
      <Line d={G.CONTOUR_RIGHT} order={0.3} reduce={reduce} />
      <Line d={G.BROWS.left} order={0.5} reduce={reduce} w={2.2} />
      <Line d={G.BROWS.right} order={0.5} reduce={reduce} w={2.2} />
      <Line d={G.NOSE_BRIDGE} order={0.6} reduce={reduce} />
      <Line d={G.NOSE_BASE} order={0.62} reduce={reduce} />
      {G.NOSE_NOSTRILS.map((d) => (
        <Line key={d} d={d} order={0.66} reduce={reduce} w={1.3} />
      ))}
      <Line d={G.CHIN_LINE} order={0.7} reduce={reduce} o={0.45} w={1.2} />
      <Line d={G.NECK_LEFT} order={0.35} reduce={reduce} />
      <Line d={G.NECK_RIGHT} order={0.35} reduce={reduce} />
      <Line d={G.SHOULDER_LEFT} order={0.45} reduce={reduce} />
      <Line d={G.SHOULDER_RIGHT} order={0.45} reduce={reduce} />
      <Line d={G.COLLAR} order={0.55} reduce={reduce} />
      <Line d={G.COLLARBONE_LEFT} order={0.6} reduce={reduce} o={0.55} w={1.2} />
      <Line d={G.COLLARBONE_RIGHT} order={0.6} reduce={reduce} o={0.55} w={1.2} />
    </>
  );

  return (
    <div
      ref={rootRef}
      className={`twin-face state-${state}${fill ? " fill" : ""} ${className ?? ""}`}
      role="img"
      aria-label={`Line drawing of the student's twin, a young woman. She is ${
        state === "idle" ? "resting" : state
      }.`}
      style={{ ["--lvl" as string]: clamp(level, 0, 1), ["--amp" as string]: amp }}
    >
      <svg viewBox={`0 0 ${G.VIEW_W} ${G.VIEW_H}`} aria-hidden="true">
        <defs>
          <linearGradient id={grad} gradientUnits="userSpaceOnUse" x1="120" y1="180" x2="480" y2="780">
            <stop offset="0" className="tf-stop a" />
            <stop offset="0.55" className="tf-stop b" />
            <stop offset="1" className="tf-stop c" />
          </linearGradient>
          <linearGradient id={fade} gradientUnits="userSpaceOnUse" x1="0" y1="560" x2="0" y2="800">
            <stop offset="0" stopColor="#fff" />
            <stop offset="0.45" stopColor="#fff" stopOpacity="0.7" />
            <stop offset="1" stopColor="#000" />
          </linearGradient>
          <mask id={mask} maskUnits="userSpaceOnUse" x="-200" y="-100" width="1000" height="1000">
            <rect x="-200" y="-100" width="1000" height="1000" fill={`url(#${fade})`} />
          </mask>
        </defs>

        {/* ring that pulses with her listening */}
        <g transform="translate(300 420)">
          <g className="tf-ring-level">
            <g className="tf-ring">
              <ellipse rx="262" ry="352" fill="none" stroke={`url(#${grad})`} strokeWidth="1.2" />
            </g>
          </g>
        </g>

        {/* voice rings: radiate from her while she speaks. Opacity and scale only. */}
        <g transform="translate(300 420)" className="tf-voice">
          {[0, 1, 2, 3].map((i) => (
            <g key={i} className="tf-vring" style={{ animationDelay: `${i * 0.6}s` }}>
              <ellipse rx={268 + i * 6} ry={358 + i * 8} fill="none" stroke={`url(#${grad})`} strokeWidth="1.2" />
            </g>
          ))}
        </g>

        <g mask={`url(#${mask})`}>
          <g transform="translate(300 640)">
            <g className="tf-lean">
              <g className="tf-breathe">
                <g transform="translate(-300 -640)">
                  {/* soft glow, fades in after the draw-on */}
                  <g className="tf-halo" {...figureProps} strokeWidth="7">
                    {G.HAIR_FRONT.filter((_, i) => i % 3 === 0).map((p) => (
                      <path key={p.id} d={p.d} />
                    ))}
                    <path d={G.CONTOUR_LEFT} />
                    <path d={G.CONTOUR_RIGHT} />
                    <path d={G.NECK_LEFT} />
                    <path d={G.NECK_RIGHT} />
                    <path d={G.SHOULDER_LEFT} />
                    <path d={G.SHOULDER_RIGHT} />
                    <path d={closed.upper} />
                    <path d={closed.lower} />
                  </g>

                  <g {...figureProps} strokeWidth="1.5">
                    <g className="tf-hair back">
                      {G.HAIR_BACK.map((p, i) => (
                        <Strand key={p.id} d={p.d} order={p.order} w={1} o={0.42} sway={i} dir={i % 2 ? 1 : -1} dur={swayDur + (i % 5) * 1.3} rip />
                      ))}
                    </g>
                    {staticLines}
                    <g className="tf-hair front">
                      {G.HAIR_FRONT.map((p, i) => (
                        <Strand key={p.id} d={p.d} order={p.order} w={1.15} o={0.8} sway={i + 3} dir={i % 2 ? -1 : 1} dur={swayDur + (i % 4) * 1.1} rip />
                      ))}
                      {G.FRINGE.map((p, i) => (
                        <Strand key={p.id} d={p.d} order={p.order} w={1.3} o={0.9} sway={i} dir={i % 2 ? -1 : 1} dur={swayDur * 0.8} rip />
                      ))}
                    </g>
                    {eye("left", G.LEFT_EYE, 0.45)}
                    {eye("right", G.RIGHT_EYE, 0.45)}
                    <Line d={closed.upper} order={0.72} reduce={reduce} pathRef={upperRef} w={1.7} />
                    <Line d={closed.lower} order={0.72} reduce={reduce} pathRef={lowerRef} w={1.7} />
                    <Line d={closed.gap} order={0.76} reduce={reduce} pathRef={gapRef} w={1.3} fill="var(--teal)" fillOpacity={0.12} />
                  </g>
                </g>
              </g>
            </g>
          </g>
        </g>

        {/* thought dots, only while thinking */}
        <g className="tf-thought">
          {G.THOUGHT_DOTS.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={3 + i} style={{ animationDelay: `${i * 0.28}s` }} />
          ))}
        </g>

        {/* mind point: approved facts fly in here */}
        <g className="tf-mind" transform={`translate(${G.MIND_POINT.x} ${G.MIND_POINT.y})`}>
          <circle r="14" className="tf-mind-halo" />
          <circle ref={mindRef} r="4.5" className="tf-mind-core" />
          {flareKey > 0 && (
            <g key={flareKey}>
              <circle r="10" className="tf-flare" />
              <circle r="10" className="tf-flare ring" />
            </g>
          )}
        </g>
      </svg>
    </div>
  );
}
