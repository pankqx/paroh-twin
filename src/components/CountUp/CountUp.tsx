"use client";

import { useEffect, useState } from "react";

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

/** Counts from 0 to `to` once on mount (skipped under reduced motion). */
export default function CountUp({
  to,
  suffix = "",
  duration = 600,
}: {
  to: number;
  suffix?: string;
  duration?: number;
}) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    // Under reduced motion the first frame jumps straight to the final value.
    const span = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : duration;
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = span ? Math.min((now - start) / span, 1) : 1;
      setValue(Math.round(to * easeOut(t)));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [to, duration]);

  return (
    <>
      {value}
      {suffix}
    </>
  );
}
