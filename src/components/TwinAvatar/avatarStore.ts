"use client";

import { useSyncExternalStore } from "react";
import { setVoiceLook } from "@/lib/voice/speak";

// A tiny shared store so the one persistent avatar (mounted in the root layout) can be driven
// from any page: Talk pushes its live state here, anything can ask her to dance or wave.
// No data lives here, only what she is doing right now and how she looks.

export type AvatarState = "idle" | "listening" | "thinking" | "speaking" | "delighted";
export type AvatarAction = "dance" | "wave" | "nod" | "shake" | "delighted";
export type Mouth = 0 | 1 | 2 | 3;

export interface Live {
  state: AvatarState;
  mouth?: Mouth;
  level: number;
}

let live: Live = { state: "idle", level: 0 };
const liveListeners = new Set<() => void>();
let delightTimer: ReturnType<typeof setTimeout> | undefined;

export function setLive(patch: Partial<Live>) {
  const next = { ...live, ...patch };
  if (next.state === live.state && next.mouth === live.mouth && next.level === live.level) return;
  live = next;
  for (const l of liveListeners) l();
}

/** Her delighted state lasts about two seconds, then she settles back to idle. */
export function delight() {
  setLive({ state: "delighted" });
  clearTimeout(delightTimer);
  delightTimer = setTimeout(() => {
    if (live.state === "delighted") setLive({ state: "idle" });
  }, 2000);
}

export const getLive = () => live;
const subscribeLive = (cb: () => void) => {
  liveListeners.add(cb);
  return () => liveListeners.delete(cb);
};
const serverLive: Live = { state: "idle", level: 0 };
export function useLive(): Live {
  return useSyncExternalStore(subscribeLive, getLive, () => serverLive);
}

// ---- One-off actions (dance, wave, nod, shake) ----------------------------------------------

type ActionListener = (a: AvatarAction) => void;
const actionListeners = new Set<ActionListener>();
export function play(action: AvatarAction) {
  if (action === "delighted") delight();
  for (const l of actionListeners) l(action);
}
export function onAction(cb: ActionListener) {
  actionListeners.add(cb);
  return () => {
    actionListeners.delete(cb);
  };
}

// ---- Look: who she is. Persisted in localStorage. ---------------------------------------------

export type LookKind = "woman" | "man";
export interface Prefs {
  look: LookKind;
  skin: string;
  hair: string;
  outfit: string;
}

export const SKINS = [
  { id: "#f2d3bf", name: "Light" },
  { id: "#e0b08a", name: "Warm" },
  { id: "#b98560", name: "Tan" },
  { id: "#7d5038", name: "Deep" },
];
export const HAIRS = [
  { id: "#1d1a33", name: "Ink" },
  { id: "#5a3a2a", name: "Brown" },
  { id: "#c79a55", name: "Golden" },
  { id: "#b0492f", name: "Copper" },
  { id: "#7a64d6", name: "Violet" },
];
export const OUTFITS = [
  { id: "#2aa39a", name: "Teal" },
  { id: "#7c5fe0", name: "Violet" },
  { id: "#d9962b", name: "Amber" },
  { id: "#d2566f", name: "Rose" },
];

const DEFAULTS: Prefs = { look: "woman", skin: SKINS[1].id, hair: HAIRS[1].id, outfit: OUTFITS[1].id };
const KEY = "paroh-twin-look-v2";
let prefs: Prefs = DEFAULTS;
let loaded = false;
const prefListeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<Prefs>;
      prefs = {
        look: p.look === "man" ? "man" : "woman",
        skin: SKINS.some((s) => s.id === p.skin) ? p.skin! : DEFAULTS.skin,
        hair: HAIRS.some((h) => h.id === p.hair) ? p.hair! : DEFAULTS.hair,
        outfit: OUTFITS.some((o) => o.id === p.outfit) ? p.outfit! : DEFAULTS.outfit,
      };
    }
  } catch {
    /* storage may be unavailable */
  }
  setVoiceLook(prefs.look);
}

export function setPrefs(patch: Partial<Prefs>) {
  load();
  prefs = { ...prefs, ...patch };
  if (patch.look) setVoiceLook(prefs.look);
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    /* storage may be unavailable */
  }
  for (const l of prefListeners) l();
}

const subscribePrefs = (cb: () => void) => {
  prefListeners.add(cb);
  return () => prefListeners.delete(cb);
};
const getPrefs = () => {
  load();
  return prefs;
};

export function usePrefs(): Prefs {
  return useSyncExternalStore(subscribePrefs, getPrefs, () => DEFAULTS);
}
