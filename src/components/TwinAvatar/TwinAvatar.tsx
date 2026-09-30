"use client";

import { animate } from "motion/react";
import { memo, useEffect, useId, useImperativeHandle, useRef, useState, type Ref, type RefObject } from "react";
import { onAction, play, type AvatarAction, type AvatarState, type LookKind, type Mouth } from "./avatarStore";
import * as G from "./geometry";
import { registerMindPoint } from "./mindPoint";
import { ACTION_LENGTH, REST, ease, target, type Pose } from "./pose";
import "./TwinAvatar.css";

export type { AvatarState };
export type Expression = "neutral" | "smile" | "curious";

export interface TwinAvatarHandle {
  /** Flare the mind point (an approved fact just arrived). */
  flare(): void;
  /** Mind point centre in viewport coordinates. */
  mindPoint(): { x: number; y: number } | null;
  play(action: AvatarAction): void;
}

export interface TwinAvatarProps {
  /** 0 = pure line art, 1 = fully coloured. Changes animate over about 1.6s. */
  form: number;
  state: AvatarState;
  mouth?: Mouth;
  level?: number;
  look?: LookKind;
  skin?: string;
  hair?: string;
  outfit?: string;
  expression?: Expression;
  /** Hold the animation loop (she is off screen). */
  paused?: boolean;
  /** Where she looks, -1..1 on each axis. Omit to follow the cursor. */
  lookAt?: { x: number; y: number };
  className?: string;
  ref?: Ref<TwinAvatarHandle>;
}

const clamp = (v: number, lo = -1, hi = 1) => Math.min(hi, Math.max(lo, v));
const SMILE: Record<Expression, number> = { neutral: 0.05, smile: 0.35, curious: 0.15 };

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

/** Elements the pose engine moves. Filled in by ref callbacks, read by the engine. */
interface Bag {
  fig: SVGGElement | null;
  headB: SVGGElement | null;
  headF: SVGGElement | null;
  torso: SVGGElement | null;
  armLU: SVGGElement | null;
  armLF: SVGGElement | null;
  armRU: SVGGElement | null;
  armRF: SVGGElement | null;
  brows: SVGGElement | null;
  upper: SVGPathElement | null;
  lower: SVGPathElement | null;
  gap: SVGPathElement | null;
  lips: SVGPathElement | null;
  lipLine: SVGPathElement | null;
  mind: SVGCircleElement | null;
}
const emptyBag = (): Bag => ({ fig: null, headB: null, headF: null, torso: null, armLU: null, armLF: null, armRU: null, armRF: null, brows: null, upper: null, lower: null, gap: null, lips: null, lipLine: null, mind: null });

// ---- Small drawing helpers ------------------------------------------------------------------

/** A line that draws itself on (CSS dash, no JS per path). The aurora line at form 0, a soft rim light later. */
function Ln({ d, order = 0, w = 1.5, o = 1, fade = 0.55, grad }: { d: string; order?: number; w?: number; o?: number; fade?: number; grad: string }) {
  return <path d={d} pathLength={1} className={`ln draw${fade >= 1 ? " detail" : ""}`} stroke={`url(#${grad})`} strokeWidth={w} style={{ ["--o" as string]: o, ["--fade" as string]: fade, animationDelay: `${0.1 + order}s` }} />;
}
/** A darker drawn feature that takes over from the aurora line as she gains colour. */
function Dk({ d, w = 1.5, o = 1 }: { d: string; w?: number; o?: number }) {
  return <path d={d} className="dk" strokeWidth={w} style={{ ["--o" as string]: o }} />;
}
/** A filled shape that blooms in with the form (opacity, staggered by `fd`). */
function Fl({ d, fill, fd = 0, cls = "" }: { d: string; fill: string; fd?: number; cls?: string }) {
  return <path d={d} fill={fill} className={`fill ${cls}`} style={{ ["--fd" as string]: fd }} />;
}

/** Hair strands in bundles: each bundle sways on its own clock, so 140 strands need only ~25 animations. */
function Bundles({ parts, grad, w, o, fade, per = 6, dur = 9, dirSeed = 0 }: { parts: G.Part[]; grad: string; w: number; o: number; fade: number; per?: number; dur?: number; dirSeed?: number }) {
  const groups: G.Part[][] = [];
  for (let i = 0; i < parts.length; i += per) groups.push(parts.slice(i, i + per));
  return (
    <>
      {groups.map((g, gi) => (
        <g key={gi} className="tf-sway rip" style={{ ["--dir" as string]: (gi + dirSeed) % 2 ? 1 : -1, ["--d" as string]: `${dur + (gi % 5) * 1.3}s`, animationDelay: `${-gi * 0.73}s` }}>
          {g.map((p) => (
            <Ln key={p.id} d={p.d} order={p.order} w={w} o={o} fade={fade} grad={grad} />
          ))}
        </g>
      ))}
    </>
  );
}

// ---- The art ---------------------------------------------------------------------------------
// Memoised: it only re-renders when the look changes. Everything that moves is driven by the
// engine through the `bag` refs, so speaking and listening never re-render these ~700 nodes.

const Art = memo(function Art({ uid, bagRef, look }: { uid: string; bagRef: RefObject<Bag>; look: LookKind }) {
  const grad = `g-${uid}`;
  const gradB = `gb-${uid}`;
  const id = (n: string) => `${n}-${uid}`;
  const man = look === "man";
  const closed = G.mouthPaths(0);
  const cl = man ? G.MAN_CONTOUR_LEFT : G.CONTOUR_LEFT;
  const cr = man ? G.MAN_CONTOUR_RIGHT : G.CONTOUR_RIGHT;
  const faceFill = man ? G.MAN_FACE_FILL : G.FACE_FILL;
  const ref =
    <K extends keyof Bag>(k: K) =>
    (el: Bag[K]) => {
      bagRef.current[k] = el;
    };

  const eye = (side: "left" | "right") => {
    const c = side === "left" ? G.LEFT_EYE : G.RIGHT_EYE;
    return (
      <g key={side} transform={`translate(${c.cx} ${c.cy})`}>
        <g className="tf-eye">
          <g transform={`translate(${-c.cx} ${-c.cy})`}>
            <clipPath id={id(`clip-${side}`)}>
              <path d={G.EYE[side].clip} />
            </clipPath>
            <path d={G.EYE[side].clip} fill={`url(#${id("sclera")})`} className="fill" style={{ ["--fd" as string]: 0.3 }} />
            <g clipPath={`url(#${id(`clip-${side}`)})`}>
              <g className="tf-pupil">
                <g transform={`translate(${c.cx} ${c.cy})`}>
                  <circle r="11.8" fill={`url(#${id("iris")})`} className="fill" style={{ ["--fd" as string]: 0.3 }} />
                  <circle r="11.5" className="ln" stroke={`url(#${grad})`} fill="none" strokeWidth="1.5" style={{ ["--fade" as string]: 0.8 }} />
                  <circle r="7.6" stroke={`url(#${grad})`} fill="none" strokeWidth="0.7" className="ln" style={{ ["--o" as string]: 0.5, ["--fade" as string]: 1 }} />
                  <path d={G.IRIS_SPOKES} stroke={`url(#${grad})`} strokeWidth="0.7" className="ln" style={{ ["--o" as string]: 0.6, ["--fade" as string]: 0.6 }} />
                  <g className="tf-pupil-dot">
                    <circle r="4.8" className="tf-pupil-fill" />
                  </g>
                  <circle cx={side === "left" ? 4 : -4} cy="-3.6" r="2.1" className="tf-glint" />
                  <circle cx={side === "left" ? -3.4 : 3.4} cy="3.6" r="1" className="tf-glint small" />
                </g>
              </g>
              <path d={G.EYE[side].upper} className="lidshade" strokeWidth="7" />
            </g>
            <Ln d={G.EYE[side].upper} order={0.45} w={1.9} grad={grad} fade={1} />
            <Dk d={G.EYE[side].upper} w={2.6} o={0.95} />
            <Ln d={G.EYE[side].lower} order={0.45} grad={grad} fade={1} />
            <Dk d={G.EYE[side].lower} w={1} o={0.35} />
            <Ln d={G.EYE[side].crease} order={0.5} w={1.2} o={0.55} grad={grad} fade={1} />
            <Dk d={G.EYE[side].crease} w={1} o={0.3} />
            <Ln d={G.EYE[side].flick} order={0.5} w={1.4} grad={grad} fade={1} />
            <Ln d={G.LASHES[side]} order={0.6} w={1.25} o={0.9} grad={grad} fade={1} />
            <Dk d={G.LASHES[side]} w={1.3} o={0.9} />
          </g>
        </g>
      </g>
    );
  };

  const arm = (side: "l" | "r") => {
    const A = side === "l" ? G.ARM : G.ARM_R;
    const up = side === "l" ? "armLU" : "armRU";
    const fo = side === "l" ? "armLF" : "armRF";
    return (
      <g key={side} className="joint" ref={ref(up)} style={{ transformOrigin: `${A.shoulder.x}px ${A.shoulder.y}px` }}>
        <path d={A.upper} className="occ" />
        <Fl d={A.upper} fill={`url(#${id("outfit")})`} fd={0.08} />
        <Ln d={A.upper} order={0.6} grad={gradB} />
        <g className="joint" ref={ref(fo)} style={{ transformOrigin: `${A.elbow.x}px ${A.elbow.y}px` }}>
          <path d={A.fore} className="occ" />
          <Fl d={A.fore} fill={`url(#${id("outfit")})`} fd={0.1} />
          <Ln d={A.fore} order={0.65} grad={gradB} />
          <Ln d={A.cuff} order={0.7} grad={gradB} o={0.7} />
          <path d={A.hand} className="occ" />
          <Fl d={A.hand} fill={`url(#${id("skinB")})`} fd={0.12} />
          <Fl d={A.thumb} fill={`url(#${id("skinB")})`} fd={0.12} />
          <Ln d={A.hand} order={0.75} grad={gradB} />
          <Ln d={A.thumb} order={0.78} grad={gradB} o={0.8} />
          <Ln d={A.fingers.join(" ")} order={0.8} grad={gradB} o={0.5} w={1} fade={1} />
          <Dk d={A.fingers.join(" ")} w={1} o={0.3} />
          <Dk d={A.cuff} w={2} o={0.3} />
        </g>
      </g>
    );
  };

  const stop = (o: number, expr: string) => <stop offset={o} style={{ stopColor: expr }} />;
  const bodyScale = man ? "translate(300 0) scale(1.1 1) translate(-300 0)" : undefined;

  return (
    <svg viewBox={`0 0 ${G.VIEW_W} ${G.VIEW_H}`} aria-hidden="true">
      <defs>
        <linearGradient id={grad} gradientUnits="userSpaceOnUse" x1="120" y1="180" x2="480" y2="780">
          <stop offset="0" className="tf-stop a" />
          <stop offset="0.55" className="tf-stop b" />
          <stop offset="1" className="tf-stop c" />
        </linearGradient>
        <linearGradient id={gradB} gradientUnits="userSpaceOnUse" x1="110" y1="380" x2="490" y2="960">
          <stop offset="0" className="tf-stop a" />
          <stop offset="0.55" className="tf-stop b" />
          <stop offset="1" className="tf-stop c" />
        </linearGradient>
        <radialGradient id={id("skinF")} cx="0.42" cy="0.36" r="0.8">
          {stop(0, "color-mix(in srgb, var(--skin) 76%, white)")}
          {stop(0.55, "var(--skin)")}
          {stop(1, "color-mix(in srgb, var(--skin) 60%, #5a2540)")}
        </radialGradient>
        <linearGradient id={id("skinB")} x1="0" y1="0" x2="1" y2="0">
          {stop(0, "color-mix(in srgb, var(--skin) 78%, #4a2236)")}
          {stop(0.5, "color-mix(in srgb, var(--skin) 92%, white)")}
          {stop(1, "color-mix(in srgb, var(--skin) 72%, #4a2236)")}
        </linearGradient>
        <linearGradient id={id("hair")} x1="0" y1="0" x2="0.35" y2="1">
          {stop(0, "color-mix(in srgb, var(--hair) 65%, #000)")}
          {stop(0.3, "color-mix(in srgb, var(--hair) 72%, white)")}
          {stop(0.55, "var(--hair)")}
          {stop(1, "color-mix(in srgb, var(--hair) 55%, #000)")}
        </linearGradient>
        <linearGradient id={id("outfit")} x1="0" y1="0" x2="1" y2="1">
          {stop(0, "color-mix(in srgb, var(--outfit) 72%, white)")}
          {stop(0.5, "var(--outfit)")}
          {stop(1, "color-mix(in srgb, var(--outfit) 55%, #0a0818)")}
        </linearGradient>
        <radialGradient id={id("iris")} cx="0.5" cy="0.5" r="0.5">
          {stop(0, "#0d3b3d")}
          {stop(0.62, "#1f8f86")}
          {stop(1, "#7be9d8")}
        </radialGradient>
        <linearGradient id={id("sclera")} x1="0" y1="0" x2="0" y2="1">
          {stop(0, "#cfc6df")}
          {stop(0.4, "#f6f2fb")}
          {stop(1, "#ffffff")}
        </linearGradient>
        <radialGradient id={id("cheek")}>
          <stop offset="0" stopColor="#ff7a93" stopOpacity="0.34" />
          <stop offset="1" stopColor="#ff7a93" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={id("lip")} x1="0" y1="0" x2="0" y2="1">
          {stop(0, "color-mix(in srgb, var(--skin) 35%, #c2415f)")}
          {stop(1, "color-mix(in srgb, var(--skin) 25%, #d8566f)")}
        </linearGradient>
        <radialGradient id={id("bloom")} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#fff" />
          <stop offset="0.72" stopColor="#fff" />
          <stop offset="1" stopColor="#000" />
        </radialGradient>
        {/* The colour bloom: a soft circle that grows from her mind point. */}
        <mask id={id("mH")} maskUnits="userSpaceOnUse" x="-1500" y="-1500" width="4000" height="4000">
          <circle className="bloom" style={{ ["--bs" as string]: 120, transformOrigin: `${G.MIND_POINT.x}px ${G.MIND_POINT.y}px` }} cx={G.MIND_POINT.x} cy={G.MIND_POINT.y} r="10" fill={`url(#${id("bloom")})`} />
        </mask>
        <mask id={id("mB")} maskUnits="userSpaceOnUse" x="-1500" y="-1500" width="4000" height="4000">
          <circle className="bloom" style={{ ["--bs" as string]: 100, transformOrigin: `${G.toAvatar(G.MIND_POINT.x, G.MIND_POINT.y).x}px ${G.toAvatar(G.MIND_POINT.x, G.MIND_POINT.y).y}px` }} cx={G.toAvatar(G.MIND_POINT.x, G.MIND_POINT.y).x} cy={G.toAvatar(G.MIND_POINT.x, G.MIND_POINT.y).y} r="10" fill={`url(#${id("bloom")})`} />
        </mask>
      </defs>

      <g className="fig" ref={ref("fig")}>
        {/* 1. Hair behind the head and shoulders */}
        <g className="head" ref={ref("headB")}>
          <g transform={G.HEAD_T}>
            <g mask={`url(#${id("mH")})`}>
              <Fl d={man ? G.MAN_HAIR_FILL : G.HAIR_FILL_BACK} fill={`url(#${id("hair")})`} />
            </g>
            {!man && (
              <>
                <Bundles parts={G.HAIR_BACK} grad={grad} w={1} o={0.42} fade={0.3} />
                <Bundles parts={G.HAIR_MID} grad={grad} w={1.05} o={0.6} fade={0.3} dirSeed={1} />
              </>
            )}
          </g>
        </g>

        <g transform={bodyScale}>
          {/* 2. Neck, chest, garment */}
          <g className="torso" ref={ref("torso")}>
            <path d={G.NECK_CHEST} className="occ" />
            <path d={G.GARMENT} className="occ" />
            <g mask={`url(#${id("mB")})`}>
              <Fl d={G.NECK_CHEST} fill={`url(#${id("skinB")})`} fd={0.04} />
              <Fl d={G.NECK_SHADOW} fill="color-mix(in srgb, var(--skin) 45%, #3a1630)" fd={0.06} cls="shade" />
              <Fl d={G.GARMENT} fill={`url(#${id("outfit")})`} fd={0.06} />
            </g>
            <Ln d={G.GARMENT} order={0.35} grad={gradB} />
            <Ln d={G.COLLAR_BAND} order={0.5} w={2.4} grad={gradB} fade={0.3} />
            <Ln d={G.NECK_EDGES} order={0.3} grad={gradB} fade={0.8} />
            <Ln d={G.COLLARBONES.join(" ")} order={0.6} w={1.1} o={0.6} grad={gradB} fade={1} />
            <Ln d={G.GARMENT_FOLDS.join(" ")} order={0.7} w={1} o={0.35} grad={gradB} fade={1} />
            <Dk d={G.GARMENT_FOLDS.join(" ")} w={1.6} o={0.16} />
            <Dk d={G.COLLARBONES.join(" ")} w={1.2} o={0.22} />
          </g>

          {/* 3. Arms: upper arm, forearm, hand, each turning on its own joint. The shoulder caps stay on the body so a swung arm never leaves a gap. */}
          {[G.ARM.shoulder, G.ARM_R.shoulder].map((sp, i) => (
            <g key={i}>
              <circle cx={sp.x + (i ? -8 : 8)} cy={sp.y + 6} r="36" className="occ" />
              <circle cx={sp.x + (i ? -8 : 8)} cy={sp.y + 6} r="36" fill={`url(#${id("outfit")})`} className="fill" style={{ ["--fd" as string]: 0.06 }} />
            </g>
          ))}
          {arm("l")}
          {arm("r")}
        </g>

        {/* 4. Head: face, features, hair in front */}
        <g className="head" ref={ref("headF")}>
          <g transform={G.HEAD_T}>
            <path d={faceFill} className="occ" />
            <g mask={`url(#${id("mH")})`}>
              <Fl d={faceFill} fill={`url(#${id("skinF")})`} fd={0.02} />
              {G.CHEEKS.map((c) => (
                <circle key={c.cx} cx={c.cx} cy={c.cy} r={c.r} fill={`url(#${id("cheek")})`} className="fill" style={{ ["--fd" as string]: 0.15 }} />
              ))}
              {man ? (
                <Fl d={G.MAN_HAIR_TOP} fill={`url(#${id("hair")})`} fd={0.04} />
              ) : (
                <>
                  {G.HAIR_FILL_SIDES.map((d, i) => (
                    <Fl key={i} d={d} fill={`url(#${id("hair")})`} fd={0.04} />
                  ))}
                  <Fl d={G.HAIR_FILL_FRINGE} fill={`url(#${id("hair")})`} fd={0.04} />
                </>
              )}
            </g>

            {/* Outlines: neon at form 0, a soft rim light once she has colour */}
            <Ln d={cl} order={0.3} grad={grad} />
            <Ln d={cr} order={0.3} grad={grad} />
            <Ln d={G.JAW_HATCH.join(" ")} order={0.75} w={0.9} o={0.5} grad={grad} fade={1} />
            <Ln d={G.CHEEK_LINES.join(" ")} order={0.8} w={0.9} o={0.4} grad={grad} fade={1} />
            <Dk d={G.CHEEK_LINES.slice(0, 1).join(" ")} w={1.4} o={0.1} />
            <Ln d={G.TEMPLE_LINES.join(" ")} order={0.7} w={0.9} o={0.4} grad={grad} fade={1} />

            <g ref={ref("brows")} className="brows">
              <Ln d={G.BROWS.left} order={0.5} w={man ? 3.4 : 2.2} grad={grad} fade={1} />
              <Ln d={G.BROWS.right} order={0.5} w={man ? 3.4 : 2.2} grad={grad} fade={1} />
              <Dk d={G.BROWS.left} w={man ? 5.2 : 3.4} o={0.88} />
              <Dk d={G.BROWS.right} w={man ? 5.2 : 3.4} o={0.88} />
            </g>

            {eye("left")}
            {eye("right")}

            <Ln d={G.NOSE_BRIDGE} order={0.6} grad={grad} fade={1} />
            <Ln d={G.NOSE_BASE} order={0.62} grad={grad} fade={1} />
            {G.NOSE_NOSTRILS.map((d) => (
              <Ln key={d} d={d} order={0.66} w={1.3} grad={grad} fade={1} />
            ))}
            <Dk d={G.NOSE_BRIDGE} w={1.3} o={0.22} />
            <Dk d={G.NOSE_BASE} w={1.6} o={0.34} />
            {G.NOSE_NOSTRILS.map((d) => (
              <Dk key={d} d={d} w={1.6} o={0.4} />
            ))}
            <Ln d={G.NOSE_SHADE.join(" ")} order={0.85} w={0.9} o={0.45} grad={grad} fade={1} />
            <Ln d={G.CHIN_LINE} order={0.7} w={1.2} o={0.45} grad={grad} fade={1} />

            {/* Mouth: lips fill, outlines and the open gap are rewritten by the engine */}
            <path ref={ref("lips")} d={closed.lips} fill={`url(#${id("lip")})`} className="fill" style={{ ["--fd" as string]: 0.3 }} />
            <path ref={ref("upper")} d={closed.upper} className="ln" stroke={`url(#${grad})`} strokeWidth="1.7" style={{ ["--fade" as string]: 1 }} />
            <path ref={ref("lower")} d={closed.lower} className="ln" stroke={`url(#${grad})`} strokeWidth="1.7" style={{ ["--fade" as string]: 1 }} />
            <path ref={ref("gap")} d={closed.gap} className="gap" stroke={`url(#${grad})`} strokeWidth="1.3" />
            <path ref={ref("lipLine")} d={closed.gap} className="lipline dk" strokeWidth="1.4" />

            {man ? (
              <Bundles parts={G.MAN_STRANDS} grad={grad} w={1.2} o={0.8} fade={0.35} per={5} dur={10} />
            ) : (
              <>
                <Bundles parts={G.HAIR_FRONT} grad={grad} w={1.15} o={0.8} fade={0.35} dur={8} />
                <Bundles parts={G.FRINGE} grad={grad} w={1.3} o={0.9} fade={0.35} per={2} dur={7} />
              </>
            )}

            {/* thought dots (thinking) */}
            <g className="tf-thought">
              {G.THOUGHT_DOTS.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r={3 + i} style={{ animationDelay: `${i * 0.28}s` }} />
              ))}
            </g>

            {/* mind point: approved facts fly in here */}
            <g className="tf-mind" transform={`translate(${G.MIND_POINT.x} ${G.MIND_POINT.y})`}>
              <circle r="14" className="tf-mind-halo" />
              <circle ref={ref("mind")} r="4.5" className="tf-mind-core" />
            </g>
          </g>
        </g>
      </g>
    </svg>
  );
});

// ---- The avatar ------------------------------------------------------------------------------

export default function TwinAvatar({ form, state, mouth, level = 0, look = "woman", skin, hair, outfit, expression = "smile", paused = false, lookAt, className, ref }: TwinAvatarProps) {
  const reduce = useReducedMotionState();
  const uid = useId().replace(/:/g, "");
  const rootRef = useRef<HTMLDivElement>(null);
  const bagRef = useRef<Bag>(emptyBag());
  const [initialForm] = useState(form);
  const [flareKey, setFlareKey] = useState(0);
  const [burst, setBurst] = useState(0);

  // Live inputs for the engine (read every frame, no re-render needed).
  const live = useRef({ state, mouth, level, expression, paused });
  useEffect(() => {
    live.current = { state, mouth, level, expression, paused };
  });

  const mindPoint = () => {
    const r = bagRef.current.mind?.getBoundingClientRect();
    return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null;
  };
  const flare = () => setFlareKey((k) => k + 1);
  useImperativeHandle(ref, () => ({ flare, mindPoint, play }), []);  
  useEffect(() => registerMindPoint({ point: mindPoint, flare }), []);  

  // ---- Form: 0 line art -> 1 coloured, about 1.6s. The CSS reads --form. ----
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const from = parseFloat(root.style.getPropertyValue("--form"));
    const start = Number.isFinite(from) ? from : form;
    // "formed" drops the line-art details (already invisible) from painting once she is coloured.
    const setFormed = (on: boolean) => root.toggleAttribute("data-formed", on);
    if (reduce || start === form) {
      root.style.setProperty("--form", String(form));
      setFormed(form >= 1);
      return;
    }
    setFormed(false);
    const c = animate(start, form, {
      duration: 1.6,
      ease: [0.2, 0.7, 0.2, 1],
      onUpdate: (v) => root.style.setProperty("--form", v.toFixed(3)),
      onComplete: () => setFormed(form >= 1),
    });
    return () => c.stop();
  }, [form, reduce]);

  // Sparkle burst when she is delighted.
  useEffect(() => {
    if (state !== "delighted") return;
    const k = window.setTimeout(() => setBurst((b) => b + 1), 0);
    return () => window.clearTimeout(k);
  }, [state]);

  // ---- Eyes: follow the cursor; thinking glances up and left. ----
  const gaze = lookAt ?? (state === "thinking" ? { x: -1, y: -1 } : null);
  const gazeRef = useRef<{ x: number; y: number } | null>(null);
  useEffect(() => {
    gazeRef.current = gaze ? { x: clamp(gaze.x), y: clamp(gaze.y) } : null;
    const root = rootRef.current;
    if (!root) return;
    const t = gazeRef.current ?? { x: 0, y: 0 };
    root.style.setProperty("--px", `${t.x * 4.5}px`);
    root.style.setProperty("--py", `${t.y * 3.5}px`);
  }, [gaze?.x, gaze?.y]); // eslint-disable-line react-hooks/exhaustive-deps

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
      if (gazeRef.current) return;
      const r = root.getBoundingClientRect();
      tx = clamp((e.clientX - (r.left + r.width / 2)) / (window.innerWidth / 2));
      ty = clamp((e.clientY - (r.top + r.height * 0.22)) / (window.innerHeight / 2));
      if (!raf) raf = requestAnimationFrame(apply);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
    };
  }, [reduce]);

  // ---- Blink every 3-6s. ----
  useEffect(() => {
    const root = rootRef.current;
    if (!root || reduce) return;
    let timer = 0;
    let off = 0;
    const loop = () => {
      timer = window.setTimeout(() => {
        root.setAttribute("data-blink", "");
        off = window.setTimeout(() => root.removeAttribute("data-blink"), 120);
        loop();
      }, 3000 + Math.random() * 3000);
    };
    loop();
    return () => {
      clearTimeout(timer);
      clearTimeout(off);
      root.removeAttribute("data-blink");
    };
  }, [reduce]);

  // ---- The engine: pose every frame + mouth shape. Paused when the page is hidden. ----
  useEffect(() => {
    const bag = bagRef.current;
    const writeMouth = (h: number, smile: number) => {
      const p = G.mouthPaths(h, smile);
      bag.upper?.setAttribute("d", p.upper);
      bag.lower?.setAttribute("d", p.lower);
      bag.gap?.setAttribute("d", p.gap);
      bag.lipLine?.setAttribute("d", p.gap);
      bag.lips?.setAttribute("d", p.lips);
    };
    const pose: Pose = { ...REST };
    let action: { name: AvatarAction; t0: number } | undefined;
    const offAction = onAction((name) => {
      action = { name, t0: performance.now() / 1000 };
    });

    const applyPose = (p: Pose) => {
      const f = (n: number) => n.toFixed(2);
      if (bag.fig) bag.fig.style.transform = `translate(${f(p.bx)}px, ${f(p.by)}px) rotate(${f(p.lean)}deg) scale(${f(1 + p.zoom)})`;
      const head = `translate(${f(p.hx)}px, ${f(p.hy + p.sh)}px) rotate(${f(p.hr)}deg)`;
      if (bag.headB) bag.headB.style.transform = head;
      if (bag.headF) bag.headF.style.transform = head;
      if (bag.torso) bag.torso.style.transform = `translateY(${f(p.sh)}px) scale(${f(1 + p.br * 0.006)}, ${f(1 + p.br * 0.01)})`;
      if (bag.armLU) bag.armLU.style.transform = `translateY(${f(p.sh)}px) rotate(${f(p.lu)}deg)`;
      if (bag.armLF) bag.armLF.style.transform = `rotate(${f(p.lf)}deg)`;
      if (bag.armRU) bag.armRU.style.transform = `translateY(${f(p.sh)}px) rotate(${f(-p.ru)}deg)`;
      if (bag.armRF) bag.armRF.style.transform = `rotate(${f(-p.rf)}deg)`;
      if (bag.brows) bag.brows.style.transform = `translateY(${f(-p.brow)}px)`;
    };

    if (reduce) {
      applyPose(REST);
      writeMouth(0, SMILE[live.current.expression]);
      return () => offAction();
    }

    let raf = 0;
    let last = performance.now();
    let open = 0; // current mouth opening
    let lastMouth = 0;
    let beat = 0;
    let beat2 = 0;
    let beatIdx = 0;
    let nextFake = 0;
    let mouthGoal = 0;
    let nextPick = 0;
    let shown = -1;

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const L = live.current;
      if (L.paused) {
        last = now;
        return;
      }
      // Resting breathing is slow: 30 updates a second is plenty. Anything livelier gets every frame.
      const busy = L.state !== "idle" || action !== undefined;
      if (!busy && now - last < 32) return;
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const t = now / 1000;
      const speaking = L.state === "speaking";

      // Word boundaries: the mouth leaving 0 is a beat. Without speech data, make our own.
      const m = L.mouth;
      if (speaking && m !== undefined) {
        if (lastMouth === 0 && m > 0) {
          beat = 1;
          beat2 = 1;
          beatIdx++;
        }
        lastMouth = m;
      } else if (speaking && t >= nextFake) {
        beat = 1;
        beat2 = 1;
        beatIdx++;
        nextFake = t + 0.3 + Math.random() * 0.25;
      } else if (!speaking) {
        lastMouth = 0;
      }
      beat *= Math.exp(-dt / 0.14);
      beat2 *= Math.exp(-dt / 0.42);

      if (action && t - action.t0 > ACTION_LENGTH[action.name]) action = undefined;
      const goal = target({ t, state: L.state, level: L.level, beat, beat2, beatIdx, action: action ? { name: action.name, u: t - action.t0 } : undefined });
      ease(pose, goal, dt);
      applyPose(pose);

      // Mouth: a given shape, or a lively random loop when she speaks with no data.
      const talking = speaking && m === undefined;
      if (talking && t >= nextPick) {
        const r = Math.random();
        mouthGoal = r < 0.2 ? G.MOUTH_OPEN[0] : r < 0.5 ? G.MOUTH_OPEN[1] : r < 0.82 ? G.MOUTH_OPEN[2] : G.MOUTH_OPEN[3];
        nextPick = t + 0.11 + Math.random() * 0.055;
      } else if (!talking) {
        mouthGoal = speaking && m !== undefined ? G.MOUTH_OPEN[m] : 0;
      }
      const grin = L.state === "delighted" || (action?.name === "delighted") || action?.name === "dance";
      if (grin) mouthGoal = G.MOUTH_OPEN[2];
      const smile = SMILE[L.expression] + (grin ? 0.5 : 0);
      const diff = mouthGoal - open;
      if (Math.abs(diff) > 0.02 || talking || smile !== shown) {
        open += diff * (1 - Math.exp(-dt / 0.038));
        shown = smile;
        writeMouth(open, smile);
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
      offAction();
    };
  }, [reduce]);  

  // With reduced motion the engine is off; write the expression once.
  useEffect(() => {
    if (!reduce) return;
    const bag = bagRef.current;
    const p = G.mouthPaths(0, SMILE[expression]);
    bag.upper?.setAttribute("d", p.upper);
    bag.lower?.setAttribute("d", p.lower);
    bag.gap?.setAttribute("d", p.gap);
    bag.lipLine?.setAttribute("d", p.gap);
    bag.lips?.setAttribute("d", p.lips);
  }, [expression, reduce]);  

  const style = {
    ["--form"]: initialForm,
    ["--skin"]: skin ?? "#e0b08a",
    ["--hair"]: hair ?? "#5a3a2a",
    ["--outfit"]: outfit ?? "#7c5fe0",
    ["--lvl"]: clamp(level, 0, 1),
  } as React.CSSProperties;

  const mp = G.toAvatar(G.MIND_POINT.x, G.MIND_POINT.y);
  return (
    <div
      ref={rootRef}
      className={`twin-avatar state-${state}${className ? ` ${className}` : ""}`}
      data-look={look}
      role="img"
      aria-label={`Illustration of the student's twin, a ${look === "man" ? "young man" : "young woman"}. ${state === "idle" ? "Resting." : `Currently ${state}.`}`}
      style={style}
    >
      <Art uid={uid} bagRef={bagRef} look={look} />
      <svg className="ta-fx" viewBox={`0 0 ${G.VIEW_W} ${G.VIEW_H}`} aria-hidden="true">
        {flareKey > 0 && (
          <g key={`flare-${flareKey}`} transform={`translate(${mp.x} ${mp.y})`}>
            <circle r="10" className="tf-flare" />
            <circle r="10" className="tf-flare ring" />
          </g>
        )}
        {burst > 0 && (
          <g key={`burst-${burst}`} transform="translate(300 260)">
            {Array.from({ length: 14 }, (_, i) => {
              const a = (i / 14) * Math.PI * 2;
              const r = 170 + (i % 3) * 50;
              return <path key={i} className="spark" d="M 0 -11 L 3 -3 L 11 0 L 3 3 L 0 11 L -3 3 L -11 0 L -3 -3 Z" style={{ fill: ["var(--amber)", "var(--rose)", "var(--teal)"][i % 3], ["--sx" as string]: `${Math.cos(a) * r}px`, ["--sy" as string]: `${Math.sin(a) * r - 20}px`, animationDelay: `${(i % 4) * 0.05}s` }} />;
            })}
          </g>
        )}
      </svg>
    </div>
  );
}
