export type AtmosphereVariant = "twin" | "talk" | "journal" | "ask" | "sources" | "plan" | "rhythm" | "pulse";

export interface VariantConfig {
  /** Accent colours (CSS variables) for ring dots, dust and grid. */
  accent: [string, string];
  /** Which orbit rings to draw (indexes into RINGS). Fewer for Talk so the face stays the hero. */
  rings: number[];
  /** Overall strength of the decorative layers, 0-1 (multiplies every layer's opacity). */
  strength: number;
  /** Dust: canvas particle count (0 = none), or SVG motes on the Twin page. */
  dust: { kind: "canvas" | "svg" | "none"; count: number; flow?: "inward" };
  grid: boolean;
  hud: boolean;
  marquee: boolean;
}

export const VARIANTS: Record<AtmosphereVariant, VariantConfig> = {
  twin: { accent: ["var(--violet)", "var(--teal)"], rings: [], strength: 1, dust: { kind: "svg", count: 18 }, grid: false, hud: false, marquee: true },
  talk: { accent: ["var(--teal)", "var(--violet)"], rings: [], strength: 0.8, dust: { kind: "svg", count: 18 }, grid: false, hud: false, marquee: true },
  journal: { accent: ["var(--violet)", "var(--lilac)"], rings: [0, 1, 3], strength: 0.9, dust: { kind: "canvas", count: 36 }, grid: true, hud: true, marquee: true },
  ask: { accent: ["var(--amber)", "var(--rose)"], rings: [0, 1, 2, 5], strength: 1, dust: { kind: "canvas", count: 40 }, grid: true, hud: true, marquee: true },
  sources: { accent: ["var(--teal)", "var(--violet)"], rings: [1, 3, 4], strength: 1, dust: { kind: "canvas", count: 54, flow: "inward" }, grid: true, hud: true, marquee: true },
  plan: { accent: ["var(--teal)", "var(--amber)"], rings: [0, 2, 3, 4], strength: 0.9, dust: { kind: "canvas", count: 34 }, grid: true, hud: true, marquee: true },
  rhythm: { accent: ["var(--green)", "var(--teal)"], rings: [1, 2, 5], strength: 0.9, dust: { kind: "canvas", count: 34 }, grid: true, hud: true, marquee: true },
  pulse: { accent: ["var(--rose)", "var(--violet)"], rings: [0, 3, 5], strength: 0.9, dust: { kind: "canvas", count: 30 }, grid: true, hud: true, marquee: true },
};

export function variantForPath(pathname: string): AtmosphereVariant {
  if (pathname === "/") return "twin";
  const seg = pathname.split("/")[1];
  switch (seg) {
    case "talk":
    case "welcome":
      return "talk";
    case "journal":
    case "memory":
    case "approvals":
      return "journal";
    case "ask":
    case "sources":
    case "plan":
    case "rhythm":
    case "pulse":
      return seg;
    default:
      return "journal";
  }
}

// Orbit rings in a 1600 x 1000 space (drawn with "slice", so partly off-screen on purpose).
export interface Ring {
  cx: number;
  cy: number;
  r: number;
  squish: number; // 1 = circle, <1 = ellipse
  tilt: number; // degrees
  dur: number; // seconds per turn
  reverse?: boolean;
  dots: number;
}

export const RINGS: Ring[] = [
  { cx: 1250, cy: 300, r: 520, squish: 1, tilt: 0, dur: 110, dots: 1 },
  { cx: 1250, cy: 300, r: 340, squish: 0.5, tilt: -18, dur: 70, reverse: true, dots: 1 },
  { cx: 250, cy: 820, r: 600, squish: 0.55, tilt: 12, dur: 95, dots: 1 },
  { cx: 250, cy: 820, r: 380, squish: 1, tilt: 0, dur: 60, reverse: true, dots: 2 },
  { cx: 800, cy: 1120, r: 700, squish: 0.32, tilt: 0, dur: 120, dots: 1 },
  { cx: 1480, cy: 900, r: 260, squish: 1, tilt: 0, dur: 45, reverse: true, dots: 1 },
];

export const MARQUEE =
  "Consent first · You approve what it learns · Hosted model, payload previewed · No audio stored · Sample student data · An estimate, not a promise · Not a therapist";
