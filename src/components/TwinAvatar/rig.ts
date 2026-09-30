// A small procedural rig. Every frame it works out a target pose from the state (idle,
// listening, thinking, speaking) plus any action (dance, wave, nod, shake), eases the current
// pose toward it, and writes SVG transforms straight to the groups. No React renders per frame.

import { AV_X0, HIP, NECK_BASE, SHOULDER_L, SHOULDER_R, UPPER_LEN } from "./avatarGeometry";

export type AvatarState = "idle" | "listening" | "thinking" | "speaking";
export type AvatarAction = "none" | "dance" | "delighted" | "wave" | "nod" | "shake";

export interface RigRefs {
  body: SVGGElement | null;
  headFront: SVGGElement | null;
  headBack: SVGGElement | null;
  armL: SVGGElement | null;
  foreL: SVGGElement | null;
  armR: SVGGElement | null;
  foreR: SVGGElement | null;
}

export interface RigInput {
  state: AvatarState;
  level: number; // 0..1 mic level (listening) or voice energy (speaking)
  action: AvatarAction;
  /** 0..1 how strongly the action is blended in right now. */
  actionAmt: number;
  /** Seconds since the action began. */
  actionT: number;
}

interface Pose {
  bodyX: number;
  bodyY: number;
  bodyRot: number;
  headRot: number;
  headX: number;
  headY: number;
  sL: number; // upper arm, degrees, positive = outward then up
  eL: number; // forearm relative bend
  sR: number;
  eR: number;
}

const ZERO: Pose = { bodyX: 0, bodyY: 0, bodyRot: 0, headRot: 0, headX: 0, headY: 0, sL: 0, eL: 0, sR: 0, eR: 0 };
const s = Math.sin;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Target pose at time t (seconds). */
export function targetPose(t: number, inp: RigInput): Pose {
  const br = s(t * 1.3);
  const p: Pose = {
    ...ZERO,
    bodyY: br * 2.4,
    bodyRot: s(t * 0.45) * 0.6,
    headRot: s(t * 0.55) * 1.3,
    headX: s(t * 0.4) * 1.6,
    headY: -br * 1.3,
    sL: 7 + br * 0.9,
    eL: -8,
    sR: 7 - br * 0.9,
    eR: -8,
  };

  switch (inp.state) {
    case "listening": {
      const nod = s(t * 2.3) * (1.4 + inp.level * 3.2);
      p.headRot += 5.5;
      p.headY += -3 + nod;
      p.bodyY += -3;
      p.bodyRot += -1;
      p.sL += 4;
      p.sR += 2;
      break;
    }
    case "thinking": {
      p.headRot += -4.5;
      p.headX += 4;
      p.headY += -2;
      p.bodyRot += 1;
      p.sR = 20 + s(t * 1.7) * 3;
      p.eR = -118 + s(t * 2.1) * 6; // hand comes up towards the chin
      break;
    }
    case "speaking": {
      const beat = s(t * 5.2) * 0.5 + s(t * 3.1 + 1) * 0.5;
      p.headRot += beat * 2.6;
      p.headY += -Math.abs(s(t * 3.1)) * 2.4;
      p.headX += s(t * 2.2) * 2;
      p.bodyY += -Math.abs(s(t * 3.1)) * 1.5;
      p.bodyRot += s(t * 1.5) * 0.9;
      p.sR = 34 + beat * 12; // the right hand gestures as she speaks
      p.eR = -66 + s(t * 3.1 + 0.4) * 22;
      p.sL = 12 + s(t * 2.1 + 1) * 6;
      p.eL = -24 + s(t * 2.6) * 10;
      break;
    }
    default:
      break;
  }

  const a = inp.actionAmt;
  if (inp.action !== "none" && a > 0) {
    const w = inp.actionT * (inp.action === "delighted" ? 7.4 : 5.8); // beat phase
    switch (inp.action) {
      case "dance":
      case "delighted": {
        const big = inp.action === "delighted" ? 1.25 : 1;
        p.bodyY = lerp(p.bodyY, -Math.abs(s(w)) * 18 * big, a);
        p.bodyRot = lerp(p.bodyRot, s(w) * 3.4 * big, a);
        p.bodyX = lerp(p.bodyX, s(w) * 11 * big, a);
        p.headRot = lerp(p.headRot, s(w + 0.7) * 8 * big, a);
        p.headX = lerp(p.headX, s(w + 1.2) * 6, a);
        p.headY = lerp(p.headY, -Math.abs(s(w + 0.4)) * 6, a);
        p.sL = lerp(p.sL, 92 + 48 * s(w), a);
        p.eL = lerp(p.eL, 18 + 34 * s(w + 1.4), a);
        p.sR = lerp(p.sR, 92 + 48 * s(w + Math.PI), a);
        p.eR = lerp(p.eR, 18 + 34 * s(w + Math.PI + 1.4), a);
        break;
      }
      case "wave": {
        p.sR = lerp(p.sR, 138, a);
        p.eR = lerp(p.eR, 14 + 26 * s(inp.actionT * 11), a);
        p.headRot = lerp(p.headRot, 5, a);
        break;
      }
      case "nod": {
        p.headY = lerp(p.headY, s(inp.actionT * 9) * 7, a);
        p.headRot = lerp(p.headRot, 0, a * 0.5);
        break;
      }
      case "shake": {
        p.headX = lerp(p.headX, s(inp.actionT * 13) * 9, a);
        p.headRot = lerp(p.headRot, s(inp.actionT * 13) * 5, a);
        break;
      }
    }
  }
  return p;
}

export class Rig {
  pose: Pose = { ...ZERO };
  private started = false;

  step(dt: number, t: number, inp: RigInput, refs: RigRefs, snap = false) {
    const goal = targetPose(t, inp);
    const fast = inp.action === "dance" || inp.action === "delighted" ? 11 : 6;
    const k = snap || !this.started ? 1 : 1 - Math.exp(-dt * fast);
    this.started = true;
    (Object.keys(goal) as (keyof Pose)[]).forEach((key) => {
      this.pose[key] += (goal[key] - this.pose[key]) * k;
    });
    this.apply(refs);
  }

  apply(r: RigRefs) {
    const p = this.pose;
    const f = (n: number) => Math.round(n * 100) / 100;
    r.body?.setAttribute("transform", `translate(${f(p.bodyX)} ${f(p.bodyY)}) rotate(${f(p.bodyRot)} ${HIP.x} ${HIP.y})`);
    const head = `translate(${f(p.headX)} ${f(p.headY)}) rotate(${f(p.headRot)} ${NECK_BASE.x} ${NECK_BASE.y})`;
    r.headFront?.setAttribute("transform", head);
    r.headBack?.setAttribute("transform", head);
    r.armL?.setAttribute("transform", `translate(${SHOULDER_L.x} ${SHOULDER_L.y}) rotate(${f(p.sL)})`);
    r.foreL?.setAttribute("transform", `translate(0 ${UPPER_LEN}) rotate(${f(p.eL)})`);
    // The right arm is the left one mirrored, so positive still means outward.
    r.armR?.setAttribute("transform", `translate(${SHOULDER_R.x} ${SHOULDER_R.y}) scale(-1 1) rotate(${f(p.sR)})`);
    r.foreR?.setAttribute("transform", `translate(0 ${UPPER_LEN}) rotate(${f(p.eR)})`);
  }
}

export const VIEW_LEFT = AV_X0;
