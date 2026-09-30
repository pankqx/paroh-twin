"use client";

import { useSyncExternalStore } from "react";

// UI preference only. The speech module can read the same key when it lands.
const KEY = "paroh-voice-on";
const EVENT = "paroh:voice-pref";

function read(): boolean {
  try {
    return window.localStorage.getItem(KEY) !== "false";
  } catch {
    return true;
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function useVoicePref(): [boolean, (on: boolean) => void] {
  const on = useSyncExternalStore(subscribe, read, () => true);
  const set = (value: boolean) => {
    try {
      window.localStorage.setItem(KEY, String(value));
    } catch {
      /* storage unavailable */
    }
    window.dispatchEvent(new Event(EVENT));
  };
  return [on, set];
}
