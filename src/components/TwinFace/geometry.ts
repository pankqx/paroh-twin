// Geometry for TwinFace: one young woman, front-facing, drawn as open line art.
// Pure data and path generators (no React), in a 600 x 800 viewBox centred on x = 300.

export const VIEW_W = 600;
export const VIEW_H = 800;
export const CX = 300;

/** Mirror an absolute path ("M x y C x y x y x y ...") across the face's centre line. */
export function mirror(d: string): string {
  return d.replace(/(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g, (_, x, y) => `${VIEW_W - Number(x)} ${y}`);
}

export interface Part {
  id: string;
  d: string;
  /** Extra weight in the draw-on order (seconds of delay, before the stagger is scaled). */
  order: number;
}

// ---- Hair: 50 strands in two layers (back, front) ----------------------------------------
// Each layer is a blend between two hand-placed guide curves on the left, mirrored for the
// right. All guides share one command structure, so a strand is a plain number-wise lerp.

const nums = (d: string) => (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
const rebuild = (v: number[]) => {
  const r = v.map((x) => Math.round(x * 10) / 10);
  let out = `M ${r[0]} ${r[1]}`;
  for (let i = 2; i < r.length; i += 6) out += ` C ${r[i]} ${r[i + 1]}, ${r[i + 2]} ${r[i + 3]}, ${r[i + 4]} ${r[i + 5]}`;
  return out;
};
const blend = (a: number[], b: number[], t: number, wobble: number) =>
  a.map((x, i) => x + (b[i] - x) * t + (i > 1 ? Math.sin(i * 1.7 + t * 9) * wobble : 0));

// back layer: falls behind the shoulders, wide and long
const BACK_A = nums("M 300 180 C 196 154, 132 226, 122 340 C 114 440, 84 520, 58 612 C 44 664, 52 736, 30 800");
const BACK_B = nums("M 298 186 C 226 176, 170 240, 160 338 C 152 424, 132 500, 110 586 C 98 642, 104 712, 88 796");
// front layer: frames the face and falls in front of the neck
const FRONT_A = nums("M 298 188 C 244 196, 204 250, 196 322 C 190 386, 180 456, 164 530 C 152 590, 160 660, 144 740");
const FRONT_B = nums("M 300 194 C 262 214, 230 258, 216 326 C 210 384, 210 442, 202 500 C 196 544, 200 594, 191 650");

const BACK_N = 26;
const FRONT_N = 24;

function layer(a: number[], b: number[], n: number, prefix: string, baseOrder: number): { left: Part[]; right: Part[] } {
  const left: Part[] = [];
  const right: Part[] = [];
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0 : i / (n - 1);
    const d = rebuild(blend(a, b, t, 1.6));
    const order = baseOrder + (i % 9) * 0.05;
    left.push({ id: `${prefix}-l${i}`, d, order });
    right.push({ id: `${prefix}-r${i}`, d: mirror(d), order });
  }
  return { left, right };
}

const back = layer(BACK_A, BACK_B, BACK_N / 2, "hb", 0.02);
const front = layer(FRONT_A, FRONT_B, FRONT_N / 2, "hf", 0.1);

/** Strands behind the head and shoulders (drawn first, fainter). */
export const HAIR_BACK: Part[] = [...back.left, ...back.right];
/** Strands framing the face (drawn last, brighter). */
export const HAIR_FRONT: Part[] = [...front.left, ...front.right];
/** Fringe: short strands sweeping across the forehead. */
export const FRINGE: Part[] = [
  "M 300 192 C 268 214, 240 242, 222 286 C 215 302, 212 316, 210 334",
  "M 300 192 C 272 210, 250 232, 234 262 C 228 274, 224 286, 222 300",
  "M 300 192 C 262 222, 236 258, 226 300",
].flatMap((d, i) => [
  { id: `fr-l${i}`, d, order: 0.3 + i * 0.05 },
  { id: `fr-r${i}`, d: mirror(d), order: 0.3 + i * 0.05 },
]);
export const HAIR: Part[] = [...HAIR_BACK, ...HAIR_FRONT, ...FRINGE];

// ---- Face ---------------------------------------------------------------------------------

export const CONTOUR_LEFT = "M 197 290 C 187 350, 194 426, 228 490 C 250 534, 276 560, 300 567";
export const CONTOUR_RIGHT = "M 300 567 C 324 560, 350 534, 372 490 C 406 426, 413 350, 403 290";

export const EYE_Y = 353;
export const LEFT_EYE = { cx: 250, cy: EYE_Y };
export const RIGHT_EYE = { cx: VIEW_W - 250, cy: EYE_Y };

const EYE_UPPER = "M 224 356 C 236 338, 262 336, 276 352";
const EYE_LOWER = "M 224 356 C 240 368, 262 368, 276 352";
const EYE_CREASE = "M 230 344 C 244 330, 264 328, 278 342";
const EYE_FLICK = "M 225 355 C 219 355, 215 352, 212 347";
const EYE_CLIP = `${EYE_UPPER} C 262 368, 240 368, 224 356 Z`;

export const EYE = {
  left: { upper: EYE_UPPER, lower: EYE_LOWER, crease: EYE_CREASE, flick: EYE_FLICK, clip: EYE_CLIP },
  right: {
    upper: mirror(EYE_UPPER),
    lower: mirror(EYE_LOWER),
    crease: mirror(EYE_CREASE),
    flick: mirror(EYE_FLICK),
    clip: mirror(EYE_CLIP),
  },
};

const BROW = "M 216 324 C 232 308, 262 304, 284 314";
export const BROWS = { left: BROW, right: mirror(BROW) };

export const NOSE_BRIDGE = "M 292 372 C 290 398, 284 414, 278 431";
export const NOSE_BASE = "M 278 434 C 290 445, 310 445, 322 434";
export const NOSE_NOSTRILS = ["M 279 433 C 274 436, 275 441, 282 441", "M 321 433 C 326 436, 325 441, 318 441"];
export const CHIN_LINE = "M 286 524 C 295 529, 305 529, 314 524";

export const NECK_LEFT = "M 262 552 C 264 600, 258 636, 232 664";
export const NECK_RIGHT = mirror(NECK_LEFT);
export const SHOULDER_LEFT = "M 232 664 C 180 680, 110 704, 40 760";
export const SHOULDER_RIGHT = mirror(SHOULDER_LEFT);
export const COLLAR = "M 240 672 C 270 702, 330 702, 360 672";
export const COLLARBONE_LEFT = "M 250 694 C 268 706, 284 708, 296 704";
export const COLLARBONE_RIGHT = mirror(COLLARBONE_LEFT);

// ---- Mind point (her right temple, on screen left of centre would hide behind hair) ------

export const MIND_POINT = { x: 416, y: 274 };
export const THOUGHT_DOTS = [
  { x: 432, y: 252 },
  { x: 450, y: 230 },
  { x: 470, y: 206 },
];

// ---- Fine detail: contour hatching, cheekbones, neck shading, lashes, iris, collarbones ----

type Pt = { x: number; y: number };
const bez = (p0: Pt, p1: Pt, p2: Pt, p3: Pt, t: number): Pt => {
  const u = 1 - t;
  return {
    x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
    y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
  };
};
const pt = (v: number[], o: number): Pt => ({ x: v[o], y: v[o + 1] });
/** Point and unit tangent at t (0..1) along a single-segment "M C" path. */
function sample(d: string, t: number): { p: Pt; tan: Pt } {
  const v = nums(d);
  const a = pt(v, 0);
  const b = pt(v, 2);
  const c = pt(v, 4);
  const e = pt(v, 6);
  const p = bez(a, b, c, e, t);
  const q = bez(a, b, c, e, Math.min(1, t + 0.01));
  const r = bez(a, b, c, e, Math.max(0, t - 0.01));
  const len = Math.hypot(q.x - r.x, q.y - r.y) || 1;
  return { p, tan: { x: (q.x - r.x) / len, y: (q.y - r.y) / len } };
}
const f1 = (x: number) => Math.round(x * 10) / 10;
const seg = (a: Pt, b: Pt) => `M ${f1(a.x)} ${f1(a.y)} L ${f1(b.x)} ${f1(b.y)}`;

// Jaw hatch: short strokes stepping in from the jaw line, like a pen sketch.
const JAW_LEFT = "M 204 420 C 214 470, 244 514, 300 567";
function jawHatch(): string[] {
  const out: string[] = [];
  for (let i = 0; i < 9; i++) {
    const { p, tan } = sample(JAW_LEFT, 0.12 + i * 0.1);
    const nx = -tan.y; // normal pointing inward (towards x = 300)
    const ny = tan.x;
    const sign = nx > 0 ? 1 : -1;
    const len = 9 + (i % 3) * 3.5;
    out.push(seg({ x: p.x + sign * nx * 2, y: p.y + sign * ny * 2 }, { x: p.x + sign * nx * len + 2, y: p.y + sign * ny * len + 5 }));
  }
  return out;
}
const JAW_L = jawHatch();
export const JAW_HATCH: string[] = [...JAW_L, ...JAW_L.map(mirror)];

// Cheekbone arcs and temple lines.
const CHEEK_L = [
  "M 208 396 C 216 408, 230 418, 250 424",
  "M 204 410 C 212 424, 228 436, 248 442",
  "M 214 384 C 224 392, 236 396, 250 398",
];
export const CHEEK_LINES: string[] = [...CHEEK_L, ...CHEEK_L.map(mirror)];

const TEMPLE_L = ["M 206 300 C 204 318, 204 330, 207 344", "M 212 296 C 210 312, 210 322, 212 334"];
export const TEMPLE_LINES: string[] = [...TEMPLE_L, ...TEMPLE_L.map(mirror)];

// Neck shading under the jaw plus the hollow at the throat.
const NECK_SHADE_L = [
  "M 268 570 C 268 590, 266 608, 260 626",
  "M 276 574 C 276 594, 274 612, 270 632",
  "M 284 576 C 284 596, 283 614, 281 634",
  "M 258 566 C 258 588, 254 608, 246 630",
];
export const NECK_SHADE: string[] = [...NECK_SHADE_L, ...NECK_SHADE_L.map(mirror)];
export const THROAT = "M 292 640 C 296 648, 304 648, 308 640";

// Nose wing shading and philtrum.
export const NOSE_SHADE: string[] = [
  "M 274 424 C 270 430, 268 436, 272 440",
  mirror("M 274 424 C 270 430, 268 436, 272 440"),
  "M 293 446 C 296 456, 304 456, 307 446",
];

// Eyelashes: short strokes fanning out from the upper lid (and a few on the lower lid).
// `dir` is the direction of the outer corner on screen: -1 for the left eye, +1 for the right.
function lashes(upper: string, lower: string, dir: 1 | -1): string {
  const parts: string[] = [];
  const n = 9;
  for (let i = 0; i < n; i++) {
    // t runs inner corner -> outer corner for the left eye; flip for the mirrored path
    const t = 0.12 + (i / (n - 1)) * 0.8;
    const { p, tan } = sample(upper, t);
    let nx = tan.y;
    let ny = -tan.x;
    if (ny > 0) {
      nx = -nx;
      ny = -ny;
    }
    const len = 5 + Math.sin(t * Math.PI) * 5 + (i % 2) * 1.4;
    const outer = dir === -1 ? 1 - t : t; // 1 at the outer corner
    parts.push(seg(p, { x: p.x + nx * len + dir * outer * 3.2, y: p.y + ny * len }));
  }
  for (let i = 0; i < 4; i++) {
    const { p } = sample(lower, 0.25 + i * 0.17);
    parts.push(seg(p, { x: p.x + dir * 0.8, y: p.y + 3.4 }));
  }
  return parts.join(" ");
}
export const LASHES = {
  left: lashes(EYE_UPPER, EYE_LOWER, -1),
  right: lashes(mirror(EYE_UPPER), mirror(EYE_LOWER), 1),
};

// Iris radial lines, in iris-local coordinates (centre at 0,0).
function irisSpokes(): string {
  const parts: string[] = [];
  const n = 18;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + 0.1;
    const r0 = 6.2;
    const r1 = 10.4 + (i % 2) * 0.6;
    parts.push(seg({ x: Math.cos(a) * r0, y: Math.sin(a) * r0 }, { x: Math.cos(a) * r1, y: Math.sin(a) * r1 }));
  }
  return parts.join(" ");
}
export const IRIS_SPOKES = irisSpokes();

// Trapezius, a second shoulder contour and the notch between the collarbones.
const SHOULDER_DETAIL_L = [
  "M 232 676 C 214 686, 196 690, 176 696",
  "M 244 658 C 214 668, 176 684, 132 708",
  "M 226 690 C 190 706, 140 726, 96 756",
  "M 268 640 C 262 660, 250 672, 236 680",
];
export const SHOULDER_DETAIL: string[] = [...SHOULDER_DETAIL_L, ...SHOULDER_DETAIL_L.map(mirror), "M 300 704 C 301 722, 301 738, 300 752"];

// ---- Mouth: four shapes, one continuous parameter ------------------------------------------

/** Opening height in user units for mouth shapes 0 (closed) .. 3 (wide). */
export const MOUTH_OPEN = [0, 4.5, 12, 21] as const;

const n = (v: number) => Math.round(v * 100) / 100;

/**
 * Lip paths for an opening `h` (0 = closed). All three paths keep an identical command
 * structure, so any h between shapes is a valid in-between.
 *   upper: outer top edge of the upper lip, with its cupid's bow
 *   lower: outer bottom edge of the lower lip
 *   gap:   the dark opening (degenerates to the closed mouth line)
 */
export function mouthPaths(h: number) {
  const cy = 482;
  const lx = 264;
  const rx = 336;
  const lift = h * 0.22;
  const up = cy - 11 - lift; // bow centre
  const gapTop = cy - 1.5 - lift * 0.6;
  const gapBottom = cy + 1.5 + h * 0.78;
  const lowerBottom = cy + 17 + h * 0.9;
  const pinch = h * 0.04; // corners draw in slightly as the mouth opens

  const upper = `M ${n(lx + pinch)} ${cy} C ${n(278)} ${n(cy - 6 - lift)}, ${n(290)} ${n(up - 1)}, 300 ${n(up)} C ${n(310)} ${n(up - 1)}, ${n(322)} ${n(cy - 6 - lift)}, ${n(rx - pinch)} ${cy}`;
  const lower = `M ${n(lx + pinch)} ${cy} C ${n(282)} ${n(lowerBottom)}, ${n(318)} ${n(lowerBottom)}, ${n(rx - pinch)} ${cy}`;
  const gap = `M ${n(lx + pinch)} ${cy} C ${n(282)} ${n(gapTop)}, ${n(318)} ${n(gapTop)}, ${n(rx - pinch)} ${cy} C ${n(318)} ${n(gapBottom)}, ${n(282)} ${n(gapBottom)}, ${n(lx + pinch)} ${cy}`;
  return { upper, lower, gap };
}
