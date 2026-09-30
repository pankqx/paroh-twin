// Fill geometry for TwinAvatar. It sits exactly under the line art in ../TwinFace/geometry.ts
// (same 600-wide face coordinates), and adds a body, arms and the colour layers.
// The avatar viewBox is wider and taller than the face's so arms have room to move:
//   x from -150 to 750, y from 0 to 1080.

import { mirror } from "../TwinFace/geometry";

export const AV_X0 = -150;
export const AV_W = 900;
export const AV_H = 1080;
export const AV_VIEWBOX = `${AV_X0} 0 ${AV_W} ${AV_H}`;

/** Where the classic 600x800 face box sits inside the avatar box, as fractions. */
export const SLOT_FRAC = {
  left: (0 - AV_X0) / AV_W, // 1/6
  width: 600 / AV_W, // 2/3
  height: 800 / AV_H,
};

export const NECK_BASE = { x: 300, y: 600 }; // the head pivots here
export const HIP = { x: 300, y: 1080 }; // the body pivots here
export const SHOULDER_L = { x: 150, y: 730 };
export const SHOULDER_R = { x: 450, y: 730 };
export const UPPER_LEN = 172;
/** The torso and arms sit this much higher than their drawn coordinates. */
export const BODY_SHIFT = -44;

// ---- Head ----------------------------------------------------------------------------------

export const CONTOUR_L = "M 198 290 C 184 350, 186 420, 206 470 C 226 522, 264 558, 300 562";
export const CONTOUR_R = mirror(CONTOUR_L);
/** Face fill: follows the avatar contour (a touch wider and rounder than the line-art face). */
export const FACE_FILL =
  "M 198 290 C 184 350, 186 420, 206 470 C 226 522, 264 558, 300 562 C 336 558, 374 522, 394 470 C 414 420, 416 350, 402 290 C 398 226, 352 186, 300 184 C 248 186, 202 226, 198 290 Z";

/** Skin of the neck and the open neckline. */
export const NECK_FILL =
  "M 254 536 C 256 596, 250 636, 224 672 C 248 712, 272 734, 300 738 C 328 734, 352 712, 376 672 C 350 636, 344 596, 346 536 Z";

/** Shadow the chin throws on the neck. */
export const NECK_SHADOW = "M 262 548 C 264 572, 270 588, 300 596 C 330 588, 336 572, 338 548 Z";

/** Hair that frames the forehead: everything outside the two fringe curves, above the temples. */
export const HAIR_CAP =
  "M 300 236 C 258 238, 226 262, 208 304 C 200 324, 196 344, 194 366 C 184 356, 176 340, 172 322 C 162 246, 206 156, 300 144 C 394 156, 438 246, 428 322 C 424 340, 416 356, 406 366 C 404 344, 400 324, 392 304 C 374 262, 342 238, 300 236 Z";

/** The large mass of hair behind the head and shoulders. */
export const HAIR_BACK_FILL =
  "M 300 146 C 196 142, 120 210, 110 340 C 100 450, 70 540, 44 622 C 26 684, 40 764, 30 812 C 54 800, 76 820, 104 800 C 132 812, 160 792, 196 772 L 404 772 C 440 792, 468 812, 496 800 C 524 820, 546 800, 570 812 C 560 764, 574 684, 556 622 C 530 540, 500 450, 490 340 C 480 210, 404 142, 300 146 Z";

/** Locks that fall in front of each shoulder (outer guide to inner guide of the front strands). */
const LOCK_L =
  "M 298 150 C 230 156, 176 226, 170 318 C 164 400, 156 470, 142 540 C 130 600, 138 700, 126 800 C 152 764, 172 704, 180 634 C 186 570, 186 520, 184 470 C 182 430, 182 380, 192 330 C 190 290, 198 268, 210 250 Z";
export const LOCK_LEFT = LOCK_L;
export const LOCK_RIGHT = mirror(LOCK_L);

// ---- Body ----------------------------------------------------------------------------------

/** The garment: soft shoulders, a scooped neckline, straight to the bottom of the frame. */
export const GARMENT =
  "M 232 664 C 200 670, 168 680, 136 698 C 108 716, 100 760, 106 820 C 112 900, 124 990, 124 1080 L 476 1080 C 476 990, 488 900, 494 820 C 500 760, 492 716, 464 698 C 432 680, 400 670, 368 664 C 348 708, 328 728, 300 732 C 272 728, 252 708, 232 664 Z";

/** The neckline trim (a line that follows the scoop). */
export const GARMENT_TRIM = "M 232 666 C 252 708, 272 730, 300 734 C 328 730, 348 708, 368 666";

/** Collar shading on the garment, just under the neckline. */
export const GARMENT_FOLD_L = "M 210 700 C 196 780, 190 880, 196 1000";
export const GARMENT_FOLD_R = mirror(GARMENT_FOLD_L);
export const GARMENT_CENTRE = "M 300 736 C 301 820, 301 940, 300 1080";

// ---- Arms (local coordinates; the origin is the joint, the arm hangs down +y) ---------------

/** Upper arm, garment sleeve. */
export const UPPER_ARM =
  "M -44 6 C -46 -22, -24 -38, 4 -38 C 30 -38, 48 -22, 46 6 C 44 64, 38 122, 30 178 C 10 190, -10 190, -30 178 C -38 122, -44 64, -44 6 Z";
/** Forearm skin, origin at the elbow. */
export const FOREARM =
  "M -25 -2 C -27 56, -22 112, -16 156 C -6 162, 6 162, 16 156 C 22 112, 27 56, 25 -2 C 10 -10, -10 -10, -25 -2 Z";
/** Sleeve cuff over the top of the forearm. */
export const CUFF = "M -28 -6 C -30 14, -28 26, -26 34 C -8 42, 8 42, 26 34 C 28 26, 30 14, 28 -6 C 10 -14, -10 -14, -28 -6 Z";
/** Hand, origin at the wrist (forearm end). */
export const HAND =
  "M -17 -4 C -24 22, -24 50, -13 64 C -7 71, 7 71, 13 64 C 24 50, 24 22, 17 -4 C 6 -10, -6 -10, -17 -4 Z";
export const THUMB = "M 15 6 C 29 16, 35 34, 28 48 C 24 54, 18 50, 17 44";
export const FINGER_LINES = "M -6 44 L -6 66 M 0 46 L 0 69 M 6 44 L 6 66";

// ---- Mouth fill ----------------------------------------------------------------------------

/** Turn the outer lip paths from mouthPaths() into one closed fill. */
export function lipFillPath(upper: string, lower: string): string {
  const v = (lower.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number); // M x y C a b c d x y
  if (v.length < 8) return "";
  const [lx, ly, c1x, c1y, c2x, c2y] = v;
  return `${upper} C ${c2x} ${c2y}, ${c1x} ${c1y}, ${lx} ${ly} Z`;
}

/** Mouth paths with fuller lips than the line-art version (same structure, so any opening works). */
const rnd = (v: number) => Math.round(v * 100) / 100;
export function mouthPathsAv(h: number) {
  const cy = 494;
  const cyc = cy - 5; // corners lifted: a small smile
  const lx = 268;
  const rx = 332;
  const lift = h * 0.22;
  const up = cy - 15 - lift;
  const gapTop = cy - 1.5 - lift * 0.6;
  const gapBottom = cy + 1.5 + h * 0.78;
  const lowerBottom = cy + 23 + h * 0.9;
  const pinch = h * 0.04;
  const upper = `M ${rnd(lx + pinch)} ${cyc} C ${rnd(282)} ${rnd(cy - 6 - lift)}, ${rnd(292)} ${rnd(up - 1)}, 300 ${rnd(up)} C ${rnd(308)} ${rnd(up - 1)}, ${rnd(318)} ${rnd(cy - 6 - lift)}, ${rnd(rx - pinch)} ${cyc}`;
  const lower = `M ${rnd(lx + pinch)} ${cyc} C ${rnd(287)} ${rnd(lowerBottom)}, ${rnd(313)} ${rnd(lowerBottom)}, ${rnd(rx - pinch)} ${cyc}`;
  const gap = `M ${rnd(lx + pinch)} ${cyc} C ${rnd(287)} ${rnd(gapTop)}, ${rnd(313)} ${rnd(gapTop)}, ${rnd(rx - pinch)} ${cyc} C ${rnd(313)} ${rnd(gapBottom)}, ${rnd(287)} ${rnd(gapBottom)}, ${rnd(lx + pinch)} ${cyc}`;
  return { upper, lower, gap };
}
