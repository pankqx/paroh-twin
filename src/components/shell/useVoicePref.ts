"use client";

import { useSyncExternalStore } from "react";
import { getEnabled, setEnabled } from "@/lib/voice/speak";

// The engine's speak.ts owns the real on/off flag (and stops speech when it goes off).
// This hook only re-renders the UI when it changes.
const EVENT = "paroh:voice-pref";

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  return () => window.removeEventListener(EVENT, onChange);
}

/** Call from a click: browsers only allow speech after a user gesture. */
export function setVoiceEnabled(on: boolean) {
  setEnabled(on);
  window.dispatchEvent(new Event(EVENT));
}

export function useVoicePref(): [boolean, (on: boolean) => void] {
  const on = useSyncExternalStore(subscribe, getEnabled, () => false);
  return [on, setVoiceEnabled];
}
