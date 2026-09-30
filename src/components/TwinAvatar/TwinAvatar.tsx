"use client";

import { motion } from "motion/react";
import { useEffect, useId, useImperativeHandle, useRef, useState, type Ref } from "react";
import * as G from "../TwinFace/geometry";
import { registerMindPoint } from "../TwinFace/mindPoint";
import * as A from "./avatarGeometry";
import { DEFAULT_STYLE, styleVars, type AvatarStyle } from "./looks";
import { Rig, type AvatarAction, type AvatarState, type RigRefs } from "./rig";
import "../TwinFace/TwinFace.css";
import "./TwinAvatar.css";

export type { AvatarAction, AvatarState };

export interface TwinAvatarHandle {
  /** A fact just arrived: flare the mind point and let her celebrate. */
  flare(): void;
  mindPoint(): { x: number; y: number } | null;
  /** Play an action for a while (ms). */
  react(action: AvatarAction, ms?: number): void;
}

interface Props {
  state: AvatarState;
  level?: number;
  /** 0 closed .. 3 wide. Leave undefined to let her talk on her own while speaking. */
  mouth?: 0 | 1 | 2 | 3;
  lookAt?: { x: number; y: number };
  /** 0 = line art, 1 = fully coloured. Animates between values. */
  form?: number;
  style?: AvatarStyle;
  /** Play this action continuously (used by the lab page and the Dance button). */
  action?: AvatarAction;
  /** Deterministic time in seconds: stops the loop and renders one frame (for screenshots). */
  freezeT?: number;
  className?: string;
  ref?: Ref<TwinAvatarHandle>;
}

const EASE = [0.2, 0.7, 0.2, 1] as const;
const clamp = (v: number, lo = -1, hi = 1) => Math.min(hi, Math.max(lo, v));
const easeInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

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

function Line({ d, order = 0, w, o = 1, reduce, pathRef, fill, fillOpacity }: {
  d: string;
  order?: number;
  w?: number;
  o?: number;
  reduce: boolean;
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

function Strand({ d, order, w = 1, o = 1, sway, dir = 1, dur = 9, rip = false }: {
  d: string;
  order: number;
  w?: number;
  o?: number;
  sway?: number;
  dir?: 1 | -1;
  dur?: number;
  rip?: boolean;
}) {
  const path = (
    <path d={d} pathLength={1} className="tf-strand" strokeWidth={w} style={{ ["--o" as string]: o, animationDelay: `${0.1 + order}s` }} />
  );
  if (sway === undefined) return path;
  return (
    <g className={`tf-sway${rip ? " rip" : ""}`} style={{ ["--dir" as string]: dir, ["--d" as string]: `${dur}s`, animationDelay: `${-sway * 0.73}s` }}>
      {path}
    </g>
  );
}

export default function TwinAvatar({
  state,
  level = 0,
  mouth,
  lookAt,
  form = 0,
  style = DEFAULT_STYLE,
  action,
  freezeT,
  className,
  ref,
}: Props) {
  const reduce = useReducedMotionState();
  const uid = useId().replace(/:/g, "");
  const id = (n: string) => `ta-${n}-${uid}`;
  const grad = id("line");

  const rootRef = useRef<HTMLDivElement>(null);
  const mindRef = useRef<SVGCircleElement>(null);
  const upperRef = useRef<SVGPathElement>(null);
  const lowerRef = useRef<SVGPathElement>(null);
  const gapRef = useRef<SVGPathElement>(null);
  const lipFillRef = useRef<SVGPathElement>(null);
  const gapFleshRef = useRef<SVGPathElement>(null);
  const bloomRef = useRef<SVGCircleElement>(null);
  const refs = useRef<RigRefs>({ body: null, headFront: null, headBack: null, armL: null, foreL: null, armR: null, foreR: null });
  const rig = useRef(new Rig());
  const openRef = useRef(0);
  const lookRef = useRef<{ x: number; y: number } | null>(null);
  const [flareKey, setFlareKey] = useState(0);
  const [blooming, setBlooming] = useState(false);

  // Live props for the animation loop (so it never restarts).
  const live = useRef({ state, level, action, form, freezeT, reduce });
  live.current = { state, level, action, form, freezeT, reduce };
  const tween = useRef({ from: form, to: form, start: 0, dur: 1700, cur: form });
  const act = useRef<{ type: AvatarAction; start: number; until: number; amt: number }>({ type: "none", start: 0, until: 0, amt: 0 });

  const react = (type: AvatarAction, ms = 2200) => {
    if (live.current.reduce) return;
    const now = performance.now();
    act.current = { type, start: now, until: now + ms, amt: act.current.amt };
  };
  const mindPoint = () => {
    const r = mindRef.current?.getBoundingClientRect();
    return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null;
  };
  const flare = () => {
    setFlareKey((k) => k + 1);
    if (tween.current.cur > 0.6) react("delighted", 2400);
  };
  useImperativeHandle(ref, () => ({ flare, mindPoint, react }), []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => registerMindPoint({ point: mindPoint, flare }), []); // eslint-disable-line react-hooks/exhaustive-deps

  // A continuous action prop (lab page, Dance button).
  useEffect(() => {
    if (!action || action === "none") {
      act.current.until = 0;
      return;
    }
    const now = performance.now();
    act.current = { type: action, start: now, until: now + 1e9, amt: act.current.amt };
  }, [action]);

  // Form: tween toward the requested value.
  useEffect(() => {
    const t = tween.current;
    if (live.current.freezeT !== undefined || live.current.reduce) {
      t.from = t.to = t.cur = form;
      return;
    }
    t.from = t.cur;
    t.to = form;
    t.start = performance.now();
    t.dur = Math.abs(form - t.cur) < 0.05 ? 1 : 1700;
  }, [form, freezeT, reduce]);

  // ---- The frame loop: form tween, action envelope, rig. ----
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let raf = 0;
    let last = performance.now();
    let wasBloom = false;

    const paintForm = (f: number) => {
      root.style.setProperty("--form", String(Math.round(f * 1000) / 1000));
      root.dataset.flat = f < 0.002 ? "true" : "false";
      const bloom = f > 0.002 && f < 0.995;
      if (bloom !== wasBloom) {
        wasBloom = bloom;
        setBlooming(bloom);
      }
      bloomRef.current?.setAttribute("r", String(Math.round(easeInOut(Math.min(1, f * 1.08)) * 1250)));
    };

    const frame = (now: number, snap: boolean) => {
      const L = live.current;
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      const tw = tween.current;
      if (snap) tw.cur = tw.to;
      else {
        const x = clamp((now - tw.start) / tw.dur, 0, 1);
        tw.cur = tw.from + (tw.to - tw.from) * easeInOut(x);
      }
      paintForm(tw.cur);

      const a = act.current;
      const active = now < a.until && a.type !== "none";
      const goal = active && (L.reduce ? 0 : 1) ? 1 : 0;
      a.amt += (goal - a.amt) * (snap ? 1 : 1 - Math.exp(-dt * 7));
      const t = L.freezeT ?? now / 1000;
      const actionT = L.freezeT !== undefined ? L.freezeT : (now - a.start) / 1000;
      // Flat line art keeps still apart from breathing: only full-colour she dances.
      const allow = tw.cur > 0.5 || L.freezeT !== undefined;
      rig.current.step(
        dt,
        t,
        {
          state: L.state,
          level: L.level,
          action: a.type,
          actionAmt: allow ? a.amt : 0,
          actionT,
        },
        refs.current,
        snap,
      );
    };

    if (freezeT !== undefined || reduce) {
      frame(performance.now(), true);
      return;
    }
    const tick = (now: number) => {
      frame(now, false);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [freezeT, reduce, state, action, form]);

  // ---- Eyes follow the cursor or look where told. ----
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
      ty = clamp((e.clientY - (r.top + r.height * 0.3)) / (window.innerHeight / 2));
      if (!raf) raf = requestAnimationFrame(apply);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
    };
  }, [reduce]);

  // ---- Blink. ----
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
      }, 2600 + Math.random() * 3000);
    };
    loop();
    return () => {
      clearTimeout(timer);
      clearTimeout(off);
      root.classList.remove("blinking");
    };
  }, [reduce]);

  // ---- Mouth: four shapes, she talks on her own when no shape is passed. ----
  useEffect(() => {
    const up = upperRef.current;
    const lo = lowerRef.current;
    const gp = gapRef.current;
    if (!up || !lo || !gp) return;
    const write = (h: number) => {
      const p = A.mouthPathsAv(h);
      up.setAttribute("d", p.upper);
      lo.setAttribute("d", p.lower);
      gp.setAttribute("d", p.gap);
      gapFleshRef.current?.setAttribute("d", p.gap);
      lipFillRef.current?.setAttribute("d", A.lipFillPath(p.upper, p.lower));
    };
    const talking = state === "speaking" && mouth === undefined;
    const base = mouth !== undefined ? G.MOUTH_OPEN[mouth] : 0;
    // A slight smile when she is at rest: the corners lift a hair by keeping the mouth barely open.
    if (reduce || freezeT !== undefined) {
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
        nextPick = now + 110 + Math.random() * 55;
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
  }, [state, mouth, reduce, freezeT]);

  const closed = A.mouthPathsAv(0);
  const swayDur = state === "thinking" ? 3.6 : 9;
  const amp = state === "speaking" ? Math.max(clamp(level, 0, 1), mouth === undefined ? 0.6 : mouth / 3) : clamp(level, 0, 1);
  const figureProps = { fill: "none", stroke: `url(#${grad})`, strokeLinecap: "round", strokeLinejoin: "round" } as const;
  const fm = blooming ? `url(#${id("bloom")})` : undefined; // bloom mask for colour layers

  const eye = (side: "left" | "right", c: { cx: number; cy: number }, order: number) => (
    <g key={side} transform={`translate(${c.cx} ${c.cy}) scale(1.16)`}>
      <g className="tf-eye">
        <g transform={`translate(${-c.cx} ${-c.cy})`}>
          <g className="ta-flesh" mask={fm}>
            <path d={G.EYE[side].crease} className="ta-lidshade" />
            <path d={G.EYE[side].clip} className="ta-sclera" />
          </g>
          <clipPath id={`${id("clip")}-${side}`}>
            <path d={G.EYE[side].clip} />
          </clipPath>
          <g clipPath={`url(#${id("clip")}-${side})`}>
            <g className="tf-pupil">
              <g transform={`translate(${c.cx} ${c.cy})`}>
                <circle r="11.8" fill={`url(#${id("iris")})`} className="ta-flesh" mask={fm} />
                <circle r="11.5" className="tf-iris" stroke={`url(#${grad})`} fill="none" strokeWidth="1.5" />
                <circle r="7.6" stroke={`url(#${grad})`} fill="none" strokeWidth="0.7" opacity="0.5" />
                <path d={G.IRIS_SPOKES} stroke={`url(#${grad})`} strokeWidth="0.7" opacity="0.6" />
                <g className="tf-pupil-dot">
                  <circle r="4.8" className="tf-pupil-fill ta-pupil-light" />
                  <circle r="5.4" className="ta-pupil-dark ta-flesh" mask={fm} />
                </g>
                <circle cx={side === "left" ? 4 : -4} cy="-3.4" r="1.7" className="tf-glint ta-glint-line" />
                <g className="ta-flesh" mask={fm}>
                  <circle cx={side === "left" ? 4.2 : -4.2} cy="-4" r="3" className="ta-catch" />
                  <circle cx={side === "left" ? -3.6 : 3.6} cy="3.6" r="1.3" className="ta-catch soft" />
                </g>
              </g>
            </g>
          </g>
          <g className="ta-flesh ta-ink" mask={fm}>
            <path d={G.EYE[side].upper} strokeWidth="2.7" />
            <path d={G.LASHES[side].split(/(?=M )/).slice(0, 9).join(" ")} strokeWidth="1.3" />
          </g>
          <g {...figureProps} strokeWidth="1.6" className="ta-lines">
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

  // Face line art (kept softly over the colour, it reads as rim light).
  const faceLines = (
    <g {...figureProps} strokeWidth="1.5" className="ta-lines">
      <g className="ta-hatch">
        <Strand d={G.JAW_HATCH.join(" ")} order={0.75} w={0.9} o={0.5} />
        <Strand d={G.CHEEK_LINES.join(" ")} order={0.8} w={0.9} o={0.4} />
        <Strand d={G.TEMPLE_LINES.join(" ")} order={0.7} w={0.9} o={0.4} />
        <Strand d={G.NOSE_SHADE.join(" ")} order={0.85} w={0.9} o={0.45} />
      </g>
      <Line d={A.CONTOUR_L} order={0.3} reduce={reduce} />
      <Line d={A.CONTOUR_R} order={0.3} reduce={reduce} />
      <Line d={G.BROWS.left} order={0.5} reduce={reduce} w={2.2} />
      <Line d={G.BROWS.right} order={0.5} reduce={reduce} w={2.2} />
      <Line d={G.NOSE_BRIDGE} order={0.6} reduce={reduce} />
      <Line d={G.NOSE_BASE} order={0.62} reduce={reduce} />
      {G.NOSE_NOSTRILS.map((d) => (
        <Line key={d} d={d} order={0.66} reduce={reduce} w={1.3} />
      ))}
      <Line d={G.CHIN_LINE} order={0.7} reduce={reduce} o={0.45} w={1.2} />
    </g>
  );

  // Body line art: fades out entirely once she is coloured (the garment takes over).
  const bodyLines = (
    <g {...figureProps} strokeWidth="1.5" className="ta-bodylines">
      <Strand d={G.NECK_SHADE.join(" ")} order={0.8} w={0.9} o={0.4} />
      <Strand d={G.THROAT} order={0.85} w={1} o={0.5} />
      <Strand d={G.SHOULDER_DETAIL.join(" ")} order={0.6} w={1} o={0.45} />
      <Line d={G.NECK_LEFT} order={0.35} reduce={reduce} />
      <Line d={G.NECK_RIGHT} order={0.35} reduce={reduce} />
      <Line d={G.SHOULDER_LEFT} order={0.45} reduce={reduce} />
      <Line d={G.SHOULDER_RIGHT} order={0.45} reduce={reduce} />
      <Line d={G.COLLAR} order={0.55} reduce={reduce} />
      <Line d={G.COLLARBONE_LEFT} order={0.6} reduce={reduce} o={0.55} w={1.2} />
      <Line d={G.COLLARBONE_RIGHT} order={0.6} reduce={reduce} o={0.55} w={1.2} />
    </g>
  );

  const arm = (side: "L" | "R") => (
    <g
      ref={(el) => {
        refs.current[side === "L" ? "armL" : "armR"] = el;
      }}
      key={side}
    >
      <g
        ref={(el) => {
          refs.current[side === "L" ? "foreL" : "foreR"] = el;
        }}
        transform={`translate(0 ${A.UPPER_LEN})`}
      >
        <g className="ta-flesh" mask={fm}>
          <path d={A.FOREARM} fill={`url(#${id("arm")})`} />
          <g transform="translate(0 158)">
            <path d={A.THUMB} className="ta-thumb" />
            <path d={A.HAND} fill={`url(#${id("arm")})`} />
            <path d={A.FINGER_LINES} className="ta-fingers" />
          </g>
          <path d={A.CUFF} fill={`url(#${id("sleeve")})`} />
        </g>
      </g>
      <g className="ta-flesh" mask={fm}>
        <path d={A.UPPER_ARM} fill={`url(#${id("sleeve")})`} />
        <path d="M -30 150 C -10 166, 10 166, 30 150" className="ta-sleeve-fold" />
      </g>
    </g>
  );

  return (
    <div
      ref={rootRef}
      className={`twin-face ta state-${state} ${style.look === "man" ? "look-man" : "look-woman"} ${className ?? ""}`}
      data-flat={form < 0.002 ? "true" : "false"}
      role="img"
      aria-label={`Illustrated twin, a young ${style.look === "man" ? "man" : "woman"}. ${state === "idle" ? "Resting" : state}.`}
      style={{
        ["--form" as string]: form,
        ["--lvl" as string]: clamp(level, 0, 1),
        ["--amp" as string]: amp,
        ...styleVars(style),
      }}
    >
      <svg viewBox={A.AV_VIEWBOX} aria-hidden="true">
        <defs>
          <linearGradient id={grad} gradientUnits="userSpaceOnUse" x1="120" y1="180" x2="480" y2="780">
            <stop offset="0" className="tf-stop a" />
            <stop offset="0.55" className="tf-stop b" />
            <stop offset="1" className="tf-stop c" />
          </linearGradient>

          <linearGradient id={id("skin")} gradientUnits="userSpaceOnUse" x1="250" y1="190" x2="360" y2="570">
            <stop offset="0" stopColor="var(--skin-hi)" />
            <stop offset="0.5" stopColor="var(--skin)" />
            <stop offset="1" stopColor="color-mix(in srgb, var(--skin) 72%, var(--skin-sh))" />
          </linearGradient>
          <linearGradient id={id("faceshade")} gradientUnits="userSpaceOnUse" x1="197" y1="0" x2="403" y2="0">
            <stop offset="0" stopColor="var(--skin-hi)" stopOpacity="0.18" />
            <stop offset="0.45" stopColor="var(--skin-sh)" stopOpacity="0" />
            <stop offset="1" stopColor="var(--skin-sh)" stopOpacity="0.55" />
          </linearGradient>
          <linearGradient id={id("neck")} gradientUnits="userSpaceOnUse" x1="0" y1="548" x2="0" y2="734">
            <stop offset="0" stopColor="color-mix(in srgb, var(--skin) 65%, var(--skin-sh))" />
            <stop offset="1" stopColor="var(--skin)" />
          </linearGradient>
          <linearGradient id={id("neckshadow")} gradientUnits="userSpaceOnUse" x1="0" y1="548" x2="0" y2="598">
            <stop offset="0" stopColor="var(--skin-sh)" stopOpacity="0.75" />
            <stop offset="1" stopColor="var(--skin-sh)" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={id("arm")} gradientUnits="objectBoundingBox" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="var(--skin-hi)" />
            <stop offset="0.55" stopColor="var(--skin)" />
            <stop offset="1" stopColor="color-mix(in srgb, var(--skin) 60%, var(--skin-sh))" />
          </linearGradient>
          <linearGradient id={id("hair")} gradientUnits="userSpaceOnUse" x1="170" y1="150" x2="430" y2="900">
            <stop offset="0" stopColor="color-mix(in srgb, var(--hair) 55%, var(--hair-hi))" />
            <stop offset="0.3" stopColor="var(--hair)" />
            <stop offset="1" stopColor="color-mix(in srgb, var(--hair) 55%, #000)" />
          </linearGradient>
          <linearGradient id={id("garment")} gradientUnits="userSpaceOnUse" x1="200" y1="690" x2="400" y2="1080">
            <stop offset="0" stopColor="color-mix(in srgb, var(--outfit) 70%, var(--outfit-hi))" />
            <stop offset="0.5" stopColor="var(--outfit)" />
            <stop offset="1" stopColor="color-mix(in srgb, var(--outfit) 60%, #000)" />
          </linearGradient>
          <linearGradient id={id("sleeve")} gradientUnits="objectBoundingBox" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="color-mix(in srgb, var(--outfit) 75%, var(--outfit-hi))" />
            <stop offset="1" stopColor="color-mix(in srgb, var(--outfit) 75%, #000)" />
          </linearGradient>
          <linearGradient id={id("lip")} gradientUnits="userSpaceOnUse" x1="0" y1="466" x2="0" y2="500">
            <stop offset="0" stopColor="color-mix(in srgb, var(--lip) 80%, #fff)" />
            <stop offset="1" stopColor="color-mix(in srgb, var(--lip) 88%, #000)" />
          </linearGradient>
          <radialGradient id={id("iris")} cx="0.5" cy="0.45" r="0.6">
            <stop offset="0" stopColor="#8be9d8" />
            <stop offset="0.55" stopColor="#3f7fc4" />
            <stop offset="1" stopColor="#3a2b82" />
          </radialGradient>
          <radialGradient id={id("blush")} cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#ff6f8d" stopOpacity="0.5" />
            <stop offset="1" stopColor="#ff6f8d" stopOpacity="0" />
          </radialGradient>
          <radialGradient id={id("glow")} cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#fff" stopOpacity="0.34" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
          <radialGradient id={id("bloomg")} cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#fff" />
            <stop offset="0.7" stopColor="#fff" />
            <stop offset="1" stopColor="#000" />
          </radialGradient>

          <mask id={id("bloom")} maskUnits="userSpaceOnUse" x="-300" y="-200" width="1300" height="1600">
            <rect x="-300" y="-200" width="1300" height="1600" fill="#000" />
            <circle ref={bloomRef} cx={G.MIND_POINT.x} cy={G.MIND_POINT.y} r="0" fill={`url(#${id("bloomg")})`} />
          </mask>

          {/* Fade at the bottom: line art fades early, colour runs further down. */}
          <linearGradient id={id("fadea")} gradientUnits="userSpaceOnUse" x1="0" y1="560" x2="0" y2="800">
            <stop offset="0" stopColor="#fff" />
            <stop offset="0.45" stopColor="#fff" stopOpacity="0.7" />
            <stop offset="1" stopColor="#000" />
          </linearGradient>
          <linearGradient id={id("fadeb")} gradientUnits="userSpaceOnUse" x1="0" y1="930" x2="0" y2="1070">
            <stop offset="0" stopColor="#fff" />
            <stop offset="1" stopColor="#000" />
          </linearGradient>
          <mask id={id("fade")} maskUnits="userSpaceOnUse" x="-300" y="-200" width="1300" height="1400">
            <rect x="-300" y="-200" width="1300" height="1400" fill={`url(#${id("fadea")})`} style={{ opacity: "calc(1 - var(--form))" }} />
            <rect x="-300" y="-200" width="1300" height="1400" fill={`url(#${id("fadeb")})`} style={{ opacity: "var(--form)" }} />
          </mask>
        </defs>

        {/* listening ring */}
        <g transform="translate(300 420)">
          <g className="tf-ring-level">
            <g className="tf-ring">
              <ellipse rx="262" ry="352" fill="none" stroke={`url(#${grad})`} strokeWidth="1.2" />
            </g>
          </g>
        </g>
        {/* voice rings */}
        <g transform="translate(300 420)" className="tf-voice">
          {[0, 1, 2, 3].map((i) => (
            <g key={i} className="tf-vring" style={{ animationDelay: `${i * 0.6}s` }}>
              <ellipse rx={268 + i * 6} ry={358 + i * 8} fill="none" stroke={`url(#${grad})`} strokeWidth="1.2" />
            </g>
          ))}
        </g>

        <g mask={`url(#${id("fade")})`}>
          <g
            ref={(el) => {
              refs.current.body = el;
            }}
          >
            {/* ---- Hair behind the head and shoulders ---- */}
            <g
              ref={(el) => {
                refs.current.headBack = el;
              }}
            >
              <g className="ta-flesh" mask={fm}>
                <path d={A.HAIR_BACK_FILL} fill={`url(#${id("hair")})`} />
                <path d="M 200 200 C 150 260, 130 380, 118 500 C 106 600, 84 690, 62 770" className="ta-sheen" />
                <path d="M 400 200 C 450 260, 470 380, 482 500 C 494 600, 516 690, 538 770" className="ta-sheen b" />
              </g>
              <g {...figureProps} strokeWidth="1.5">
                <g className="tf-hair back">
                  {G.HAIR_BACK.map((p, i) => (
                    <Strand key={p.id} d={p.d} order={p.order} w={1} o={0.42} sway={i} dir={i % 2 ? 1 : -1} dur={swayDur + (i % 5) * 1.3} rip />
                  ))}
                </g>
              </g>
            </g>

            {/* ---- Neck, garment, arms (shifted up a little so the neck is not too long) ---- */}
            {bodyLines}
            <g transform={`translate(0 ${A.BODY_SHIFT})`}>
              <g className="ta-flesh" mask={fm}>
                <path d={A.NECK_FILL} fill={`url(#${id("neck")})`} />
                <path d={A.GARMENT} fill={`url(#${id("garment")})`} />
                <path d={A.GARMENT_FOLD_L} className="ta-fold" />
                <path d={A.GARMENT_FOLD_R} className="ta-fold" />
                <path d={A.GARMENT_CENTRE} className="ta-fold soft" />
                <path d={A.GARMENT} fill="none" stroke={`url(#${grad})`} strokeWidth="1.5" opacity="0.5" />
                <path d={A.GARMENT_TRIM} className="ta-trim" />
              </g>
              {arm("L")}
              {arm("R")}
            </g>
            <g className="ta-flesh" mask={fm}>
              <path d={A.NECK_SHADOW} fill={`url(#${id("neckshadow")})`} />
            </g>

            {/* ---- Head ---- */}
            <g
              ref={(el) => {
                refs.current.headFront = el;
              }}
            >
              <g className="ta-flesh" mask={fm}>
                <path d={A.FACE_FILL} fill={`url(#${id("skin")})`} />
                <path d={A.FACE_FILL} fill={`url(#${id("faceshade")})`} />
                <ellipse cx="262" cy="292" rx="56" ry="34" fill={`url(#${id("glow")})`} />
                <ellipse cx="236" cy="430" rx="44" ry="34" fill={`url(#${id("blush")})`} />
                <ellipse cx="364" cy="430" rx="44" ry="34" fill={`url(#${id("blush")})`} />
                <ellipse cx="300" cy="438" rx="14" ry="8" fill={`url(#${id("glow")})`} />
                <path d={G.NOSE_BRIDGE} className="ta-nose" />
                <path d={G.BROWS.left} className="ta-brow" />
                <path d={G.BROWS.right} className="ta-brow" />
              </g>
              {eye("left", G.LEFT_EYE, 0.45)}
              {eye("right", G.RIGHT_EYE, 0.45)}
              <g className="ta-flesh" mask={fm}>
                <path ref={lipFillRef} d={A.lipFillPath(closed.upper, closed.lower)} fill={`url(#${id("lip")})`} />
                <path ref={gapFleshRef} d={closed.gap} className="ta-mouth-dark" />
                <path d="M 282 484 C 292 490, 308 490, 318 484" className="ta-lipshine" />
              </g>
              <g className="ta-flesh" mask={fm}>
                <path d={A.HAIR_CAP} fill={`url(#${id("hair")})`} />
                <path d={A.LOCK_LEFT} fill={`url(#${id("hair")})`} />
                <path d={A.LOCK_RIGHT} fill={`url(#${id("hair")})`} />
                <path d="M 296 160 C 250 170, 214 214, 200 280" className="ta-sheen b" />
                <path d="M 304 160 C 350 170, 386 214, 400 280" className="ta-sheen b" />
              </g>
              {faceLines}
              <g {...figureProps} strokeWidth="1.5">
                <g className="tf-hair front">
                  {G.HAIR_FRONT.map((p, i) => (
                    <Strand key={p.id} d={p.d} order={p.order} w={1.15} o={0.8} sway={i + 3} dir={i % 2 ? -1 : 1} dur={swayDur + (i % 4) * 1.1} rip />
                  ))}
                  {G.FRINGE.map((p, i) => (
                    <Strand key={p.id} d={p.d} order={p.order} w={1.3} o={0.9} sway={i} dir={i % 2 ? -1 : 1} dur={swayDur * 0.8} rip />
                  ))}
                </g>
                <g className="ta-lines">
                  <Line d={closed.upper} order={0.72} reduce={reduce} pathRef={upperRef} w={1.7} />
                  <Line d={closed.lower} order={0.72} reduce={reduce} pathRef={lowerRef} w={1.7} />
                  <Line d={closed.gap} order={0.76} reduce={reduce} pathRef={gapRef} w={1.3} fill="var(--teal)" fillOpacity={0.12} />
                </g>
              </g>

              <g className="tf-thought">
                {G.THOUGHT_DOTS.map((p, i) => (
                  <circle key={i} cx={p.x} cy={p.y} r={3 + i} style={{ animationDelay: `${i * 0.28}s` }} />
                ))}
              </g>
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
            </g>
          </g>
        </g>
      </svg>
    </div>
  );
}
