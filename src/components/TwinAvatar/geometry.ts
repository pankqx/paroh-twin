// Geometry for TwinAvatar: a half-body adult student, front-facing. The HEAD is drawn in the
// original 600 x 800 head space (centred on x = 300) and placed on the body with HEAD_T; the
// BODY is drawn directly in the 600 x 900 avatar viewBox. Pure data, no React.

export const VIEW_W = 600;
export const VIEW_H = 900; // avatar viewBox height (the head space is 800 tall)
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

// ---- Hair: 140+ strands in three layers (back, mid, front) plus a fringe --------------------
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

/** Reverse an "M C C C" chain so a closed shape can be built from two curves. */
function reverseChain(d: string): string {
  const v = nums(d);
  const pts: Array<[number, number]> = [];
  for (let i = 0; i < v.length; i += 2) pts.push([v[i], v[i + 1]]);
  const rev = pts.reverse();
  let out = `M ${rev[0][0]} ${rev[0][1]}`;
  for (let i = 1; i < rev.length; i += 3) out += ` C ${rev[i][0]} ${rev[i][1]}, ${rev[i + 1][0]} ${rev[i + 1][1]}, ${rev[i + 2][0]} ${rev[i + 2][1]}`;
  return out;
}
const dropMove = (d: string) => d.replace(/^M\s*-?[\d.]+\s+-?[\d.]+\s*/, "");

// back layer: falls behind the shoulders, wide and long
const BACK_A_D = "M 300 180 C 196 154, 132 226, 122 340 C 114 440, 84 520, 58 612 C 44 664, 52 736, 30 800";
const BACK_B_D = "M 298 186 C 226 176, 170 240, 160 338 C 152 424, 132 500, 110 586 C 98 642, 104 712, 88 796";
// mid layer: between the two, sits over the back layer
const MID_A_D = "M 299 184 C 238 184, 190 244, 182 332 C 176 418, 158 498, 136 582 C 124 640, 132 710, 114 790";
const MID_B_D = "M 299 188 C 246 198, 204 252, 196 324 C 190 392, 172 466, 154 548 C 142 608, 150 680, 132 764";
// front layer: frames the face and falls in front of the neck
const FRONT_A_D = "M 298 188 C 244 196, 204 250, 196 322 C 190 386, 180 456, 164 530 C 152 590, 160 660, 144 740";
const FRONT_B_D = "M 300 194 C 262 214, 230 258, 216 326 C 210 384, 210 442, 202 500 C 196 544, 200 594, 191 650";

const BACK_N = 56;
const MID_N = 44;
const FRONT_N = 36;

function layer(a: string, b: string, n: number, prefix: string, baseOrder: number): { left: Part[]; right: Part[] } {
  const an = nums(a);
  const bn = nums(b);
  const left: Part[] = [];
  const right: Part[] = [];
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0 : i / (n - 1);
    const d = rebuild(blend(an, bn, t, 1.6));
    const order = baseOrder + (i % 11) * 0.04;
    left.push({ id: `${prefix}-l${i}`, d, order });
    right.push({ id: `${prefix}-r${i}`, d: mirror(d), order });
  }
  return { left, right };
}

const back = layer(BACK_A_D, BACK_B_D, BACK_N / 2, "hb", 0.02);
const mid = layer(MID_A_D, MID_B_D, MID_N / 2, "hm", 0.06);
const front = layer(FRONT_A_D, FRONT_B_D, FRONT_N / 2, "hf", 0.1);

/** Strands behind the head and shoulders (drawn first, faintest). */
export const HAIR_BACK: Part[] = [...back.left, ...back.right];
/** Strands between the back layer and the face. */
export const HAIR_MID: Part[] = [...mid.left, ...mid.right];
/** Strands framing the face (drawn last, brightest). */
export const HAIR_FRONT: Part[] = [...front.left, ...front.right];
const FRINGE_D = [
  "M 300 192 C 268 214, 240 242, 222 286 C 215 302, 212 316, 210 334",
  "M 300 192 C 272 210, 250 232, 234 262 C 228 274, 224 286, 222 300",
  "M 300 192 C 262 222, 236 258, 226 300",
];
/** Fringe: short strands sweeping across the forehead. */
export const FRINGE: Part[] = FRINGE_D.flatMap((d, i) => [
  { id: `fr-l${i}`, d, order: 0.3 + i * 0.05 },
  { id: `fr-r${i}`, d: mirror(d), order: 0.3 + i * 0.05 },
]);
export const HAIR: Part[] = [...HAIR_BACK, ...HAIR_MID, ...HAIR_FRONT, ...FRINGE];

/** Filled hair volumes, in head space: the big back mass, two side locks and the fringe. */
function closedBand(outer: string, inner: string): string {
  return `${outer} L ${nums(inner).slice(-2).join(" ")} ${reverseChain(inner).replace(/^M\s*-?[\d.]+\s+-?[\d.]+\s*/, "")} Z`;
}
export const HAIR_FILL_BACK = (() => {
  const l = BACK_A_D;
  const r = mirror(BACK_A_D);
  const ln = nums(l);
  const rn = nums(r);
  return `${l} C ${ln[ln.length - 2] + 130} 842, ${rn[rn.length - 2] - 130} 842, ${rn[rn.length - 2]} ${rn[rn.length - 1]} ${reverseChain(r).replace(/^M\s*-?[\d.]+\s+-?[\d.]+\s*/, "C ").replace(/^C\s*C/, "C")} Z`;
})();
export const HAIR_FILL_SIDES: string[] = [closedBand(FRONT_A_D, FRONT_B_D), closedBand(mirror(FRONT_A_D), mirror(FRONT_B_D))];
export const HAIR_FILL_FRINGE = "M 300 184 C 236 180, 196 228, 196 300 L 210 334 C 212 316, 215 302, 222 286 C 240 242, 268 214, 300 194 C 332 214, 360 242, 378 286 C 385 302, 388 316, 390 334 L 404 300 C 404 228, 364 180, 300 184 Z";
void dropMove;

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

export const MIND_POINT = { x: 184, y: 274 };
export const THOUGHT_DOTS = [
  { x: 168, y: 252 },
  { x: 150, y: 230 },
  { x: 130, y: 206 },
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
export function mouthPaths(h: number, smile = 0.3) {
  const cy = 482;
  const lx = 264;
  const rx = 336;
  const cc = cy - smile * 4; // corner height: a smile lifts both corners
  const lift = h * 0.22;
  const up = cy - 11 - lift; // bow centre
  const gapTop = cy - 1.5 - lift * 0.6;
  const gapBottom = cy + 1.5 + h * 0.78;
  const lowerBottom = cy + 17 + h * 0.9 - smile * 2;
  const pinch = h * 0.04; // corners draw in slightly as the mouth opens
  const L = n(lx + pinch);
  const R = n(rx - pinch);

  const upper = `M ${L} ${n(cc)} C ${n(278)} ${n(cy - 6 - lift)}, ${n(290)} ${n(up - 1)}, 300 ${n(up)} C ${n(310)} ${n(up - 1)}, ${n(322)} ${n(cy - 6 - lift)}, ${R} ${n(cc)}`;
  const lower = `M ${L} ${n(cc)} C ${n(282)} ${n(lowerBottom)}, ${n(318)} ${n(lowerBottom)}, ${R} ${n(cc)}`;
  const gap = `M ${L} ${n(cc)} C ${n(282)} ${n(gapTop)}, ${n(318)} ${n(gapTop)}, ${R} ${n(cc)} C ${n(318)} ${n(gapBottom)}, ${n(282)} ${n(gapBottom)}, ${L} ${n(cc)}`;
  // Closed lip shape: the upper edge there, the lower edge back.
  const lips = `${upper} C ${n(318)} ${n(lowerBottom)}, ${n(282)} ${n(lowerBottom)}, ${L} ${n(cc)} Z`;
  return { upper, lower, gap, lips };
}

// ---- Face fills (head space) -----------------------------------------------------------------

export const FACE_FILL = `M 300 188 C 246 188, 197 226, 197 290 ${CONTOUR_LEFT.replace(/^M\s*[\d.]+\s+[\d.]+\s*/, "").replace(/^C/, "C")} ${CONTOUR_RIGHT.replace(/^M\s*[\d.]+\s+[\d.]+\s*/, "")} C 403 226, 354 188, 300 188 Z`;
export const CHEEKS = [
  { cx: 238, cy: 432, r: 30 },
  { cx: 362, cy: 432, r: 30 },
];

// ---- Body (avatar space, 600 x 900) ---------------------------------------------------------------

/** Head space -> avatar space: the head is scaled to 0.72, its crown near the top. */
export const HEAD_SCALE = 0.72;
export const HEAD_T = `translate(300 34) scale(${HEAD_SCALE}) translate(-300 -160)`;
/** A head-space point in avatar space. */
export const toAvatar = (x: number, y: number) => ({ x: 300 + (x - 300) * HEAD_SCALE, y: 34 + (y - 160) * HEAD_SCALE });
/** Where the head turns: the base of the neck. */
export const NECK_BASE = { x: 300, y: 400 };
export const WAIST = { x: 300, y: 900 };

export const NECK_CHEST = "M 269 290 L 268 398 C 262 414, 250 420, 236 428 L 236 470 L 364 470 L 364 428 C 350 420, 338 414, 332 398 L 331 290 Z";
export const NECK_SHADOW = "M 269 290 L 331 290 L 331 372 C 316 360, 284 360, 269 372 Z";
export const COLLARBONES = ["M 262 420 C 276 426, 290 426, 298 423", "M 338 420 C 324 426, 310 426, 302 423"];
export const GARMENT =
  "M 138 446 C 172 420, 232 408, 262 406 C 272 434, 288 448, 300 448 C 312 448, 328 434, 338 406 C 368 408, 428 420, 462 446 C 478 460, 478 492, 470 520 L 452 640 C 444 700, 438 800, 442 900 L 158 900 C 162 800, 156 700, 148 640 L 130 520 C 122 492, 122 460, 138 446 Z";
export const COLLAR_BAND = "M 262 406 C 272 434, 288 448, 300 448 C 312 448, 328 434, 338 406";
export const GARMENT_FOLDS = ["M 240 560 C 236 650, 234 760, 238 880", "M 360 560 C 364 650, 366 760, 362 880", "M 176 660 C 182 740, 184 820, 180 890", "M 424 660 C 418 740, 416 820, 420 890"];

// Arms hang from the shoulder pivots; each is an upper arm (sleeve), forearm (sleeve) and hand.
export const ARM = {
  shoulder: { x: 138, y: 462 },
  elbow: { x: 117, y: 616 },
  upper: "M 130 440 C 108 452, 98 500, 94 556 C 91 584, 91 604, 93 618 L 141 622 C 143 598, 154 560, 166 526 C 176 496, 182 470, 178 448 C 168 432, 148 434, 130 440 Z",
  fore: "M 92 612 C 88 660, 87 712, 89 750 L 127 752 C 130 712, 136 660, 141 618 Z",
  cuff: "M 88 740 C 100 744, 114 746, 128 742",
  hand: "M 88 746 C 82 772, 84 800, 95 818 C 104 830, 120 830, 127 818 C 136 800, 136 772, 127 748 Z",
  thumb: "M 127 758 C 142 770, 146 790, 138 804 C 133 794, 131 780, 127 776 Z",
  fingers: ["M 99 802 C 98 812, 99 820, 101 826", "M 108 806 C 108 815, 109 823, 110 829", "M 118 803 C 119 811, 119 818, 118 823"],
};
export const ARM_R = {
  shoulder: { x: VIEW_W - ARM.shoulder.x, y: ARM.shoulder.y },
  elbow: { x: VIEW_W - ARM.elbow.x, y: ARM.elbow.y },
  upper: mirror(ARM.upper),
  fore: mirror(ARM.fore),
  cuff: mirror(ARM.cuff),
  hand: mirror(ARM.hand),
  thumb: mirror(ARM.thumb),
  fingers: ARM.fingers.map(mirror),
};

export const NECK_EDGES = "M 269 290 L 268 398 C 262 414, 250 420, 236 428 M 331 290 L 332 398 C 338 414, 350 420, 364 428";

// ---- The man: the same rig with a squarer jaw, heavier brows and short hair -----------------------

export const MAN_CONTOUR_LEFT = "M 195 290 C 188 356, 196 440, 212 492 C 224 530, 262 562, 300 568";
export const MAN_CONTOUR_RIGHT = "M 300 568 C 338 562, 376 530, 388 492 C 404 440, 412 356, 405 290";
export const MAN_FACE_FILL = `M 300 186 C 244 186, 195 226, 195 290 C 188 356, 196 440, 212 492 C 224 530, 262 562, 300 568 C 338 562, 376 530, 388 492 C 404 440, 412 356, 405 290 C 405 226, 356 186, 300 186 Z`;
export const MAN_HAIR_FILL = "M 184 346 C 152 224, 212 132, 300 132 C 388 132, 448 224, 416 346 L 386 308 L 214 308 Z";
export const MAN_HAIR_TOP = "M 190 330 C 158 216, 214 138, 300 138 C 386 138, 442 216, 410 330 C 400 286, 376 250, 340 238 C 314 230, 286 230, 260 238 C 224 250, 200 286, 190 330 Z";
export const MAN_STRANDS: Part[] = Array.from({ length: 40 }, (_, i) => {
  const t = i / 39;
  const a = (t - 0.5) * 2.5;
  const sx = 300 + (t - 0.5) * 120;
  const ex = 300 + 104 * Math.sin(a);
  const ey = 308 - 78 * Math.cos(a) + 7 * Math.abs(a);
  const sy = 144 + 16 * Math.pow((sx - 300) / 60, 2);
  const d = `M ${f1(sx)} ${f1(sy)} C ${f1(sx + (ex - sx) * 0.2)} ${f1(sy + 20)}, ${f1(ex + (sx - ex) * 0.1)} ${f1(ey - 52)}, ${f1(ex)} ${f1(ey)}`;
  return { id: `mh-${i}`, d, order: 0.1 + (i % 9) * 0.04 };
});
