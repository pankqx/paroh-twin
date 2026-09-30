"use client";

import { useEffect, useRef, useState } from "react";

function typing(t: EventTarget | null) {
  const el = t as HTMLElement | null;
  return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);
}

/** Press D to hide/show the Atmosphere; press F to show a frame-rate readout. */
export function useDevKeys() {
  const [on, setOn] = useState(true);
  const [fps, setFps] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || typing(e.target)) return;
      if (e.key === "d" || e.key === "D") setOn((v) => !v);
      if (e.key === "f" || e.key === "F") setFps((v) => !v);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return { on, fps };
}

export function FpsMeter({ atmosphereOn }: { atmosphereOn: boolean }) {
  const [text, setText] = useState("measuring…");
  const ref = useRef({ frames: 0, start: 0, worst: 0, last: 0 });

  useEffect(() => {
    let raf = 0;
    const s = ref.current;
    s.frames = 0;
    s.start = s.last = performance.now();
    s.worst = 0;
    const tick = (now: number) => {
      s.frames += 1;
      s.worst = Math.max(s.worst, now - s.last);
      s.last = now;
      if (now - s.start >= 1000) {
        setText(`${Math.round((s.frames * 1000) / (now - s.start))} fps · worst frame ${s.worst.toFixed(1)}ms`);
        s.frames = 0;
        s.start = now;
        s.worst = 0;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="atmo-fps" role="status">
      {text} · atmosphere {atmosphereOn ? "on" : "off"} <span>(D toggles, F hides this)</span>
    </div>
  );
}
