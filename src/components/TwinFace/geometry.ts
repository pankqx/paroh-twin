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

// ---- Hair: 12 separate strands that sway slowly around the crown. -------------------------

const LEFT_HAIR = [
  // outer sweep, longest; the crown is wide and round, not a point
  "M 300 182 C 206 160, 146 226, 140 334 C 134 428, 110 506, 88 596 C 76 648, 84 724, 62 792",
  "M 298 186 C 232 178, 184 236, 176 332 C 170 414, 152 494, 132 574 C 120 634, 127 706, 108 784",
  "M 298 190 C 250 200, 208 250, 200 320 C 196 382, 184 452, 170 522 C 158 582, 167 652, 151 732",
  // hugs the face
  "M 298 194 C 260 214, 228 258, 214 324 C 208 384, 208 442, 200 502 C 194 544, 198 594, 189 644",
  // fringe sweeping across the forehead
  "M 300 192 C 268 214, 240 242, 222 286 C 215 302, 212 316, 210 334",
];

const RIGHT_HAIR = [
  "M 300 182 C 394 158, 456 228, 462 338 C 468 432, 490 514, 514 604 C 528 658, 516 734, 540 796",
  "M 302 186 C 368 180, 416 238, 424 336 C 430 416, 450 490, 466 568 C 478 628, 470 700, 492 778",
  "M 302 190 C 350 202, 392 252, 400 322 C 404 384, 416 450, 432 516 C 444 578, 434 646, 450 726",
  "M 302 194 C 340 216, 372 260, 386 326 C 392 384, 392 440, 400 500 C 406 542, 400 592, 411 642",
  "M 300 192 C 334 212, 362 238, 380 280 C 388 298, 390 316, 391 334",
];

export const HAIR: Part[] = [...LEFT_HAIR, ...RIGHT_HAIR].map((d, i) => ({ id: `hair-${i}`, d, order: 0.05 + (i % 6) * 0.06 }));

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
