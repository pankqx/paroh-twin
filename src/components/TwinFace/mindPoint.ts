// A tiny registry so anything on screen (an approval card, the tray) can fly to the twin's
// mind point, wherever the face is mounted. Falls back to the brand mark in the top bar.

export interface MindTarget {
  /** Centre of the mind point in viewport coordinates, or null if not visible. */
  point(): { x: number; y: number } | null;
  flare(): void;
}

let current: MindTarget | null = null;

export function registerMindPoint(target: MindTarget) {
  current = target;
  return () => {
    if (current === target) current = null;
  };
}

export function mindTarget(): MindTarget | null {
  return current;
}

export function brandPoint(): { x: number; y: number } | null {
  if (typeof document === "undefined") return null;
  const el = document.querySelector(".topbar-brand");
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}
