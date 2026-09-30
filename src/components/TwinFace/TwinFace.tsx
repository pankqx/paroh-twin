"use client";

import { motion } from "motion/react";
import { useEffect, useId, useImperativeHandle, useRef, useState, type Ref } from "react";
import * as G from "./geometry";
import type { AvatarLook } from "./geometry";
import { registerMindPoint } from "./mindPoint";
import { useTwinLook } from "./useTwinLook";
import { setVoiceLook } from "../../lib/voice/speak";
import "./TwinFace.css";

export type FaceState = "idle" | "listening" | "thinking" | "speaking";
export type FaceExpression = "neutral" | "smile" | "listening" | "thinking" | "delighted";
export type { AvatarLook };

export interface TwinFaceHandle {
  /** Flare the mind point (an approved fact just arrived). */
  flare(): void;
  /** Mind point centre in viewport coordinates. */
  mindPoint(): { x: number; y: number } | null;
}

interface Props {
  state: FaceState;
  look?: AvatarLook;
  expression?: FaceExpression;
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
      initial={{ opacity: 0 }}
      animate={{ opacity: o }}
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

export default function TwinFace({ state, level = 0, mouth, lookAt, fill, className, ref, look: chosenLook, expression }: Props) {
  const reduce = useReducedMotionState();
  const [savedLook] = useTwinLook();
  const look = chosenLook ?? savedLook;
  const spec = G.AVATAR_SPECS[look];
  const faceExpression = expression ?? (state === "listening" ? "listening" : state === "thinking" ? "thinking" : "neutral");
  const uid = useId().replace(/:/g, "");
  const grad = `tf-grad-${uid}`;
  const fade = `tf-fade-${uid}`;
  const mask = `tf-mask-${uid}`;

  const rootRef = useRef<HTMLDivElement>(null);
  const mindRef = useRef<SVGCircleElement>(null);
  const gapRef = useRef<SVGPathElement>(null);
  const openRef = useRef(0); // current mouth opening, user units
  const lookRef = useRef<{ x: number; y: number } | null>(null);
  const [flareKey, setFlareKey] = useState(0);
  const [reacting, setReacting] = useState(false);

  useEffect(() => { setVoiceLook(look); }, [look]);

  const mindPoint = () => {
    const r = mindRef.current?.getBoundingClientRect();
    return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null;
  };
  const flare = () => setFlareKey((k) => k + 1);
  const playfulReaction = () => {
    setReacting(true);
    rootRef.current?.classList.add("blinking");
    window.setTimeout(() => { setReacting(false); rootRef.current?.classList.remove("blinking"); }, 520);
  };

  useImperativeHandle(ref, () => ({ flare, mindPoint }), []);
  useEffect(() => registerMindPoint({ point: mindPoint, flare }), []);

  // ---- Eyes: follow the cursor, or look where told (thinking glances up and left). ----
  const target = lookAt ?? (faceExpression === "thinking" ? { x: -1, y: -1 } : null);
  useEffect(() => {
    lookRef.current = target ? { x: clamp(target.x), y: clamp(target.y) } : null;
    const root = rootRef.current;
    if (!root) return;
    const t = lookRef.current ?? { x: 0, y: 0 };
    root.style.setProperty("--px", `${t.x * 4.5}px`);
    root.style.setProperty("--py", `${t.y * 3.5}px`);
    root.style.setProperty("--head-x", `${t.x * 4}px`);
    root.style.setProperty("--head-y", `${t.y * 2.5}px`);
    root.style.setProperty("--head-rot", `${t.x * 1.5}deg`);
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
      root.style.setProperty("--head-x", `${tx * 4}px`);
      root.style.setProperty("--head-y", `${ty * 2.5}px`);
      root.style.setProperty("--head-rot", `${tx * 1.5}deg`);
      root.style.setProperty("--hair-x", `${tx * -2.5}px`);
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
    const gp = gapRef.current;
    if (!gp) return;
    const write = (h: number) => {
      gp.style.setProperty("--mouth-open", String(Math.max(0.04, h / G.MOUTH_OPEN[3])));
      gp.style.opacity = String(Math.min(0.94, h / G.MOUTH_OPEN[3]));
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

  const smile = faceExpression === "smile" || faceExpression === "delighted" || reacting ? 1 : faceExpression === "neutral" ? 0.45 : 0.2;
  const closed = G.mouthPaths(0, spec.lipFullness, smile);
  const openMouth = G.mouthPaths(G.MOUTH_OPEN[3], spec.lipFullness, smile);
  const swayDur = state === "thinking" ? 3.6 : 9;
  // How loud she is: live input while listening, the mouth shape (or a steady guess) while speaking.
  const amp = state === "speaking" ? Math.max(clamp(level, 0, 1), mouth === undefined ? 0.6 : mouth / 3) : clamp(level, 0, 1);
  const figureProps = { fill: "none", stroke: `url(#${grad})`, strokeLinecap: "round", strokeLinejoin: "round" } as const;

  const brows = G.BROW_SHAPES[spec.browShape];
  const eye = (side: "left" | "right", c: { cx: number; cy: number }, order: number) => (
    <g key={side} transform={`translate(${c.cx} ${c.cy}) scale(${spec.eyeSize}) translate(${-c.cx} ${-c.cy})`}>
      <g transform={`translate(${c.cx} ${c.cy})`}>
        <g className="tf-eye">
          <g transform={`translate(${-c.cx} ${-c.cy})`}>
          <clipPath id={`tf-clip-${side}-${uid}`}>
            <path d={G.EYE[side].clip} />
          </clipPath>
          <path d={G.EYE[side].clip} className="tf-eye-white" />
          <g clipPath={`url(#tf-clip-${side}-${uid})`}>
            <g className="tf-pupil">
              <g transform={`translate(${c.cx} ${c.cy})`}>
                <circle r="11.5" className="tf-iris" />
                <g className="tf-pupil-dot">
                  <circle r="4.8" className="tf-pupil-fill" />
                </g>
                <circle cx={side === "left" ? 4 : -4} cy="-4" r="2.5" className="tf-glint" />
                <circle cx={side === "left" ? -3 : 3} cy="3" r="1.05" className="tf-glint small" />
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
    </g>
  );

  const staticLines = (
    <>
      <Line d={G.CONTOUR_LEFT} order={0.3} reduce={reduce} />
      <Line d={G.CONTOUR_RIGHT} order={0.3} reduce={reduce} />
      <g className="tf-brows">
        <Line d={brows.left} order={0.5} reduce={reduce} w={3.1} />
        <Line d={brows.right} order={0.5} reduce={reduce} w={3.1} />
      </g>
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
      <Line d={G.COLLARBONE_LEFT} order={0.6} reduce={reduce} o={0.42} w={1.2} />
      <Line d={G.COLLARBONE_RIGHT} order={0.6} reduce={reduce} o={0.42} w={1.2} />
    </>
  );
  const shortStrands = [
    "M 198 257 C 228 216, 267 201, 300 204",
    "M 205 270 C 232 228, 270 211, 300 211",
    "M 212 280 C 240 240, 273 222, 300 220",
    "M 402 257 C 372 216, 333 201, 300 204",
    "M 395 270 C 368 228, 330 211, 300 211",
    "M 388 280 C 360 240, 327 222, 300 220",
    "M 208 286 C 199 306, 198 325, 201 341",
    "M 392 286 C 401 306, 402 325, 399 341",
  ];

  return (
    <div
      ref={rootRef}
      className={`twin-face state-${state} look-${look} expression-${faceExpression}${reacting ? " reacting" : ""}${fill ? " fill" : ""} ${className ?? ""}`}
      role="button"
      tabIndex={0}
      onClick={playfulReaction}
      onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); playfulReaction(); } }}
      aria-label={`${look === "spirit" ? "Luminous twin spirit" : `Twin appearance: ${look}`}. ${state === "idle" ? "Resting" : state}. Activate for a playful reaction.`}
      style={{ ["--lvl" as string]: clamp(level, 0, 1), ["--amp" as string]: amp, ["--skin-light" as string]: spec.palette.skinLight, ["--skin-tone" as string]: spec.palette.skin, ["--hair-tone" as string]: spec.palette.hair, ["--hair-light" as string]: spec.palette.hairLight, ["--iris-tone" as string]: spec.palette.iris, ["--rim-tone" as string]: spec.palette.rim, ["--jaw-width" as string]: spec.jawWidth }}
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
          <radialGradient id={`${grad}-skin`} cx="38%" cy="28%" r="78%"><stop offset="0" stopColor="var(--skin-light)"/><stop offset="0.68" stopColor="var(--skin-tone)"/><stop offset="1" stopColor="color-mix(in srgb, var(--skin-tone) 66%, var(--bg-2))"/></radialGradient>
          <radialGradient id={`${grad}-blush`}><stop offset="0" stopColor="var(--rose)" stopOpacity="0.30"/><stop offset="1" stopColor="var(--rose)" stopOpacity="0"/></radialGradient>
          <linearGradient id={`${grad}-hair`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="var(--hair-light)"/><stop offset="0.55" stopColor="var(--hair-tone)"/><stop offset="1" stopColor="var(--bg-2)"/></linearGradient>
          <radialGradient id={`${grad}-spirit`}><stop stopColor="var(--skin-light)" stopOpacity="0.94"/><stop offset="0.55" stopColor="var(--rim-tone)" stopOpacity="0.42"/><stop offset="1" stopColor="var(--teal)" stopOpacity="0.02"/></radialGradient>
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

        {look === "spirit" ? (
          <g className="tf-spirit" transform="translate(300 410)">
            <circle r="190" className="tf-spirit-glow" fill={`url(#${grad}-spirit)`} />
            {[112, 145, 178].map((radius, i) => <circle key={radius} r={radius} className="tf-spirit-ripple" style={{ animationDelay: `${i * 0.42}s` }} />)}
            <circle r="72" className="tf-spirit-core" />
            <path d="M -35 0 C -18 -19, 18 -19, 35 0 C 18 19, -18 19, -35 0 Z" className="tf-spirit-mark" />
          </g>
        ) : (
        <g mask={`url(#${mask})`}>
          <g transform="translate(300 640)">
            <g className="tf-lean">
              <g className="tf-breathe">
                <g className="tf-head-track">
                <g transform="translate(-300 -640)">
                  {/* Gentle, filled forms keep the face warm instead of reading as a mask. */}
                  <g className="tf-volume" stroke="none" strokeLinejoin="round">
                    {spec.hairStyle === "long" && <path d={G.LONG_HAIR_FORM} fill={`url(#${grad}-hair)`} className="tf-hair-backfill" />}
                    {spec.hairStyle === "short" && <path d={G.SHORT_HAIR_FORM} fill={`url(#${grad}-hair)`} className="tf-hair-backfill" />}
                    <path d={G.SHOULDER_FORM} fill="color-mix(in srgb, var(--violet) 22%, var(--bg-2))" opacity="0.92" />
                    <path d={G.NECK_FORM} fill={`url(#${grad}-skin)`} />
                    <path d={G.FACE_FORM} transform={`translate(300 0) scale(${spec.jawWidth} 1) translate(-300 0)`} className="tf-skin" fill={`url(#${grad}-skin)`} stroke="var(--rim-tone)" strokeWidth="2.4" />
                    <ellipse cx="242" cy="430" rx="37" ry="20" fill={`url(#${grad}-blush)`} className="tf-blush" />
                    <ellipse cx="358" cy="430" rx="37" ry="20" fill={`url(#${grad}-blush)`} className="tf-blush" />
                    <ellipse cx="276" cy="274" rx="46" ry="21" fill="var(--text)" opacity="0.08" />
                    {spec.hairStyle === "long" && <path d="M 198 298 C 213 255, 249 230, 300 226 C 351 230, 387 255, 402 298 C 374 282, 353 277, 332 278 C 311 279, 307 293, 300 298 C 289 286, 275 277, 253 279 C 233 280, 215 288, 198 310 Z" fill={`url(#${grad}-hair)`} className="tf-hair-fringe" />}
                    {look === "man" && <g className="tf-stubble" fill="var(--hair-tone)"><path d="M 220 458 C 230 485 249 509 276 524 C 265 518 254 514 246 504 C 235 491 227 475 220 458 Z"/><path d="M 380 458 C 370 485 351 509 324 524 C 335 518 346 514 354 504 C 365 491 373 475 380 458 Z"/><path d="M 276 532 Q 300 540 324 532 L 316 544 Q 300 549 284 544 Z"/></g>}
                  </g>
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
                    {look === "woman" && <g className="tf-hair back">
                      {G.HAIR_BACK.map((p, i) => (
                        <Strand key={p.id} d={p.d} order={p.order} w={1} o={0.42} sway={i} dir={i % 2 ? 1 : -1} dur={swayDur + (i % 5) * 1.3} rip />
                      ))}
                    </g>}
                    <g className="tf-face-rig" transform={`translate(300 0) scale(${spec.jawWidth} 1) translate(-300 0)`}>
                      {staticLines}
                      {eye("left", G.LEFT_EYE, 0.45)}
                      {eye("right", G.RIGHT_EYE, 0.45)}
                      <g className="tf-mouth">
                        <path d={closed.upper} className="tf-lip upper" />
                        <path d={closed.lower} className="tf-lip lower" />
                        <path ref={gapRef} d={openMouth.gap} className="tf-mouth-gap" />
                      </g>
                    </g>
                    {look === "woman" ? <g className="tf-hair front">
                      {G.HAIR_FRONT.map((p, i) => (
                        <Strand key={p.id} d={p.d} order={p.order} w={1.15} o={0.8} sway={i + 3} dir={i % 2 ? -1 : 1} dur={swayDur + (i % 4) * 1.1} rip />
                      ))}
                      {G.FRINGE.map((p, i) => (
                        <Strand key={p.id} d={p.d} order={p.order} w={1.3} o={0.9} sway={i} dir={i % 2 ? -1 : 1} dur={swayDur * 0.8} rip />
                      ))}
                    </g> : <g className="tf-hair front">{shortStrands.map((d, i) => <Strand key={d} d={d} order={0.12 + i * 0.02} w={1.4} o={0.72} sway={i} dir={i % 2 ? -1 : 1} dur={swayDur} rip />)}</g>}
                  </g>
                </g>
                </g>
              </g>
            </g>
          </g>
        </g>
        )}

        {/* thought dots, only while thinking */}
        <g className="tf-thought">
          {G.THOUGHT_DOTS.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={3 + i} style={{ animationDelay: `${i * 0.28}s` }} />
          ))}
        </g>
        <g className="tf-sparkles">
          <path d="M 176 269 l 4 10 10 4 -10 4 -4 10 -4 -10 -10 -4 10 -4 Z" />
          <path d="M 454 354 l 3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3 Z" />
          <circle cx="431" cy="315" r="2.5" />
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

export { useTwinLook } from "./useTwinLook";
export { default as LookPicker } from "./LookPicker";
