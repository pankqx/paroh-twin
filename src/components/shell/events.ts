// Tiny UI-level signals between screens (no data lives here).

/** Fired after facts are extracted, approved, rejected or edited. */
export const FACTS_CHANGED = "paroh:facts-changed";

export function notifyFactsChanged() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(FACTS_CHANGED));
}
