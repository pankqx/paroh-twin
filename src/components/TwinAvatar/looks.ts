// Character looks. The woman and the man are one rig; a look is just a set of colours and a
// few shape switches. Everything is exposed to the SVG as CSS variables on the root element.

export type LookId = "woman" | "man";

export interface SkinTone {
  id: string;
  label: string;
  base: string;
  light: string;
  shade: string;
}

export interface HairColour {
  id: string;
  label: string;
  base: string;
  light: string;
}

export interface Outfit {
  id: string;
  label: string;
  base: string;
  light: string;
}

export const SKIN_TONES: SkinTone[] = [
  { id: "fair", label: "Fair", base: "#efc4ab", light: "#fbe1d0", shade: "#b9788a" },
  { id: "warm", label: "Warm", base: "#dea482", light: "#f3c6a6", shade: "#a8687a" },
  { id: "brown", label: "Brown", base: "#b27752", light: "#d39a72", shade: "#7d4a62" },
  { id: "deep", label: "Deep", base: "#7a4a33", light: "#a06a4a", shade: "#553048" },
];

export const HAIR_COLOURS: HairColour[] = [
  { id: "ink", label: "Ink", base: "#1b1438", light: "#5b43b8" },
  { id: "plum", label: "Plum", base: "#3a1446", light: "#a23cb4" },
  { id: "chestnut", label: "Chestnut", base: "#3a2015", light: "#b2683a" },
  { id: "teal", label: "Teal", base: "#0d3340", light: "#2fc2b4" },
  { id: "silver", label: "Silver", base: "#59566f", light: "#e2e0f4" },
];

export const OUTFITS: Outfit[] = [
  { id: "teal", label: "Teal", base: "#16636f", light: "#3fc0c0" },
  { id: "violet", label: "Violet", base: "#4d3b9a", light: "#9c86f0" },
  { id: "amber", label: "Amber", base: "#9a6420", light: "#f0b84e" },
  { id: "rose", label: "Rose", base: "#993b5a", light: "#f08aa2" },
];

export interface AvatarStyle {
  look: LookId;
  skin: string; // SkinTone id
  hair: string; // HairColour id
  outfit: string; // Outfit id
}

export const DEFAULT_STYLE: AvatarStyle = { look: "woman", skin: "warm", hair: "ink", outfit: "teal" };

const find = <T extends { id: string }>(list: T[], id: string): T => list.find((x) => x.id === id) ?? list[0];

/** CSS variables for a style. */
export function styleVars(s: AvatarStyle): Record<string, string> {
  const skin = find(SKIN_TONES, s.skin);
  const hair = find(HAIR_COLOURS, s.hair);
  const outfit = find(OUTFITS, s.outfit);
  return {
    "--skin": skin.base,
    "--skin-hi": skin.light,
    "--skin-sh": skin.shade,
    "--hair": hair.base,
    "--hair-hi": hair.light,
    "--outfit": outfit.base,
    "--outfit-hi": outfit.light,
    "--lip": s.look === "man" ? "#b56670" : "#d2627c",
  };
}
