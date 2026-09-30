import { animate } from "motion/react";
import { brandPoint, mindTarget } from "./mindPoint";

/**
 * Fly an element into the twin's mind point (or, if no face is on screen, toward the brand
 * mark where the Twin lives), then flare the mind point. Resolves when it has arrived.
 * Under reduced motion it only fades.
 */
export async function flyToTwin(el: HTMLElement): Promise<void> {
  const target = mindTarget();
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const dest = target?.point() ?? brandPoint();

  if (reduce || !dest) {
    await animate(el, { opacity: 0 }, { duration: 0.25 }).finished;
    target?.flare();
    return;
  }

  const r = el.getBoundingClientRect();
  const dx = dest.x - (r.left + r.width / 2);
  const dy = dest.y - (r.top + r.height / 2);

  // Curve the path a little: ease x and y on different clocks so it arcs into the point.
  el.style.transformOrigin = "center";
  el.style.zIndex = "60";
  el.style.pointerEvents = "none";
  await Promise.all([
    animate(el, { x: dx }, { duration: 0.85, ease: [0.5, 0, 0.3, 1] }).finished,
    animate(el, { y: dy }, { duration: 0.85, ease: [0.2, 0.7, 0.2, 1] }).finished,
    animate(el, { scale: [1, 0.9, 0.06], opacity: [1, 1, 0.2] }, { duration: 0.85, times: [0, 0.5, 1], ease: "easeIn" }).finished,
  ]);
  target?.flare();
  await animate(el, { opacity: 0 }, { duration: 0.15 }).finished;
}
