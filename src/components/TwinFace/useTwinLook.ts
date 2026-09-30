"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import type { AvatarLook } from "./geometry";
import { setVoiceLook } from "../../lib/voice/speak";

const KEY = "paroh-twin-look-v1";
const isLook = (value: string | null): value is AvatarLook => value === "woman" || value === "man" || value === "spirit";
let currentLook: AvatarLook = "woman";
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => { listeners.add(listener); return () => listeners.delete(listener); };
const getSnapshot = () => currentLook;
const updateLook = (next: AvatarLook) => {
  currentLook = next;
  setVoiceLook(next);
  for (const listener of listeners) listener();
};

/** Read and persist the chosen face appearance. Defaults to woman during SSR and hydration. */
export function useTwinLook(): [AvatarLook, (look: AvatarLook) => void] {
  const look = useSyncExternalStore(subscribe, getSnapshot, (): AvatarLook => "woman");
  useEffect(() => {
    try { const saved = localStorage.getItem(KEY); if (isLook(saved)) updateLook(saved); } catch { /* storage may be disabled */ }
  }, []);
  const setLook = useCallback((next: AvatarLook) => {
    updateLook(next);
    try { localStorage.setItem(KEY, next); } catch { /* storage may be disabled */ }
  }, []);
  return [look, setLook];
}
