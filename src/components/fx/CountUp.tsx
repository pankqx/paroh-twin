"use client";

import { animate, useInView, useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";

/**
 * CountUp. Hand-written equivalent of the React Bits "Count Up" role, built on
 * `motion`. Counts from `from` to `to` once when scrolled into view. Writes to
 * the DOM directly, so the number never re-renders its parent.
 */
export default function CountUp({
  to,
  from = 0,
  duration = 1.2,
  delay = 0,
  decimals = 0,
  suffix = "",
  className,
}: {
  to: number;
  from?: number;
  duration?: number; // seconds
  delay?: number; // seconds
  decimals?: number;
  suffix?: string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -10% 0px" });
  const reduce = useReducedMotion();
  const format = (v: number) => `${v.toFixed(decimals)}${suffix}`;

  useEffect(() => {
    const el = ref.current;
    if (!el || !inView) return;
    if (reduce) {
      el.textContent = format(to);
      return;
    }
    const controls = animate(from, to, {
      duration,
      delay,
      ease: [0.2, 0.7, 0.2, 1],
      onUpdate: (v) => {
        el.textContent = format(v);
      },
    });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView, reduce, to, from, duration, delay, decimals, suffix]);

  return (
    <span ref={ref} className={className} aria-label={format(to)}>
      {format(reduce ? to : from)}
    </span>
  );
}
