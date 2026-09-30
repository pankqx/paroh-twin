import type { AvatarAction, AvatarState } from "./avatarStore";

// The pose engine. Every frame it asks "where should each joint be right now?" (target), eases
// the real pose towards that, and writes plain CSS transforms to a few joint groups. React is
// not involved per frame. Angles are degrees; for arms, positive means "swung outward".

export interface Pose {
  hr: number; // head tilt
  hx: number; // head sideways, units
  hy: number; // head up/down, units
  lean: number; // whole upper body sway around the waist
  bx: number;
  by: number;
  zoom: number; // 0.03 = leans towards the viewer
  sh: number; // shoulder lift
  br: number; // breathing 0..1
  lu: number; // left upper arm
  lf: number; // left forearm
  ru: number;
  rf: number;
  brow: number; // brow raise, units
}

export const CHANNELS = ["hr", "hx", "hy", "lean", "bx", "by", "zoom", "sh", "br", "lu", "lf", "ru", "rf", "brow"] as const;
export type Channel = (typeof CHANNELS)[number];

export const REST: Pose = { hr: 0, hx: 0, hy: 0, lean: 0, bx: 0, by: 0, zoom: 0, sh: 0, br: 0.5, lu: 3, lf: 2, ru: 3, rf: 2, brow: 0 };

export const ACTION_LENGTH: Record<AvatarAction, number> = { dance: 4, wave: 1.9, nod: 1.3, shake: 1.3, delighted: 2 };

export interface Ctx {
  t: number;
  state: AvatarState;
  level: number;
  /** Decaying pulses set on each word boundary (1 right at the boundary). */
  beat: number;
  beat2: number;
  beatIdx: number;
  action?: { name: AvatarAction; u: number };
}

const S = Math.sin;
const C = Math.cos;
const PI = Math.PI;

function idle(t: number): Pose {
  const br = 0.5 + 0.5 * S(t * 1.37);
  return {
    hr: S(t * 0.42) * 1.0,
    hx: S(t * 0.31) * 1.5,
    hy: -br * 0.8,
    lean: S(t * 0.27) * 0.5,
    bx: 0,
    by: -br * 1.2,
    zoom: 0,
    sh: -br * 1.6,
    br,
    lu: 3 + S(t * 0.9 + 1) * 1.1,
    lf: 2 + S(t * 0.7) * 1.5,
    ru: 3 + S(t * 0.9) * 1.1,
    rf: 2 + S(t * 0.7 + 2) * 1.5,
    brow: 0,
  };
}

function withState(p: Pose, c: Ctx): Pose {
  const t = c.t;
  switch (c.state) {
    case "listening": {
      // Leans in, tilts her head, and nods a little now and then.
      const nod = Math.max(0, S(t * 2.4)) ** 6;
      p.zoom = 0.028 + c.level * 0.012;
      p.by -= 5;
      p.hr += -5;
      p.hy += nod * 4;
      p.brow = 1.5;
      p.lu += 3;
      p.ru += 3;
      break;
    }
    case "thinking": {
      // Head tilted, eyes up (handled by the eyes), one hand raised to her chin.
      p.hr += 7;
      p.hx += 5;
      p.brow = 3;
      p.ru = 4;
      p.rf = -146 + S(t * 1.8) * 3;
      p.lean += 1.2;
      break;
    }
    case "speaking": {
      // Small beat on every word: head dips, one hand lifts (the other on the next word).
      p.hy += c.beat * 3.2;
      p.hr += (c.beatIdx % 2 ? 1 : -1) * c.beat * 2.2;
      p.brow = c.beat * 1.6;
      p.by -= c.beat * 1.2;
      const left = c.beatIdx % 2 === 0;
      const g = c.beat2;
      if (left) {
        p.lu += g * 14;
        p.lf += -g * 62;
      } else {
        p.ru += g * 14;
        p.rf += -g * 62;
      }
      break;
    }
    case "delighted":
      // handled as an action below
      break;
    default:
      break;
  }
  return p;
}

/** The pose an action wants at its local time u (seconds). Missing channels stay as they were. */
function actionPose(name: AvatarAction, u: number, base: Pose): Pose {
  const p = { ...base };
  switch (name) {
    case "delighted": {
      const w = u * 9;
      p.by = -Math.abs(S(w)) * 7;
      p.sh = S(w) * 2.5;
      p.lu = 138 + S(w) * 12;
      p.ru = 138 - S(w) * 12;
      p.lf = 14 + S(w + 1) * 12;
      p.rf = 14 - S(w + 1) * 12;
      p.hr = S(u * 11) * 6;
      p.zoom = 0.03;
      p.brow = 3;
      break;
    }
    case "dance": {
      const w = u * PI * 2; // one beat per second, two sway cycles per second of arms
      p.lean = S(w) * 4;
      p.bx = S(w) * 10;
      p.by = -Math.abs(S(w * 2)) * 5;
      p.hr = -S(w) * 5 + S(w * 2) * 2;
      p.hx = S(w) * 5;
      p.sh = S(w * 2) * 2;
      p.lu = 64 + S(w) * 46;
      p.ru = 64 - S(w) * 46;
      p.lf = -34 + C(w * 2) * 26;
      p.rf = -34 - C(w * 2) * 26;
      p.zoom = 0.012;
      p.brow = 2;
      break;
    }
    case "wave": {
      // Right arm up and out, forearm waving.
      p.ru = 132;
      p.rf = S(u * 13) * 26;
      p.hr = -4;
      p.brow = 2.5;
      p.lean = -1.5;
      break;
    }
    case "nod": {
      p.hy = 9 * Math.max(0, S(u * PI * 3.3)) + base.hy;
      p.brow = 1.5;
      break;
    }
    case "shake": {
      p.hx = S(u * PI * 6) * 7;
      p.hr = S(u * PI * 6) * 6;
      break;
    }
  }
  return p;
}

export function target(c: Ctx): Pose {
  const base = withState(idle(c.t), c);
  const name = c.action?.name ?? (c.state === "delighted" ? "delighted" : undefined);
  if (!name) return base;
  const u = c.action ? c.action.u : c.t;
  const dur = ACTION_LENGTH[name];
  // Ease in and out so actions never snap.
  const w = c.action ? Math.max(0, Math.min(1, u / 0.25, (dur - u) / 0.3)) : 1;
  const a = actionPose(name, u, base);
  const out = { ...base };
  for (const k of CHANNELS) out[k] = base[k] + (a[k] - base[k]) * w;
  return out;
}

/** Ease `pose` towards `goal`; fast joints (head) settle quicker than arms. */
export function ease(pose: Pose, goal: Pose, dt: number): void {
  const fast = 1 - Math.exp(-dt / 0.09);
  const slow = 1 - Math.exp(-dt / 0.16);
  for (const k of CHANNELS) {
    const a = k === "lu" || k === "lf" || k === "ru" || k === "rf" || k === "lean" || k === "bx" ? slow : fast;
    pose[k] += (goal[k] - pose[k]) * a;
  }
}
