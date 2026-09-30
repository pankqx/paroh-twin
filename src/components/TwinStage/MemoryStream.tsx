"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef } from "react";
import { mindTarget } from "@/components/TwinAvatar/mindPoint";
import type { Fact } from "@/lib/types";
import { useStageData } from "./useStageData";
import "./MemoryStream.css";

const KIND_COLOUR: Record<string, string> = {
  task: "var(--teal)",
  deadline: "var(--rose)",
  goal: "var(--amber)",
  habit: "var(--green)",
  routine: "var(--violet)",
  preference: "var(--lilac)",
};
const MAX = 6;

/**
 * What she remembers, as glowing cards on the left. Approved facts are solid, waiting ones
 * dashed. Each card is tied to her mind point by a thin line that follows her as she moves.
 * New facts fly in when they are added.
 */
export default function MemoryStream() {
  const { facts } = useStageData(true);
  const shown: Fact[] = facts.slice(0, MAX);
  const svg = useRef<SVGSVGElement>(null);
  const cards = useRef(new Map<string, HTMLElement>());

  // Redraw the connectors every frame (she sways), cheaply: a few path `d` writes.
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    const draw = () => {
      raf = requestAnimationFrame(reduce ? () => {} : draw);
      const s = svg.current;
      if (!s) return;
      const mp = mindTarget()?.point();
      const wide = window.innerWidth >= 1100;
      s.style.display = wide && mp ? "block" : "none";
      if (!mp || !wide) return;
      for (const p of Array.from(s.querySelectorAll("path"))) {
        const el = cards.current.get(p.getAttribute("data-id") ?? "");
        if (!el) continue;
        const r = el.getBoundingClientRect();
        const x1 = r.right;
        const y1 = r.top + r.height / 2;
        p.setAttribute("d", `M ${x1} ${y1} C ${x1 + 70} ${y1}, ${mp.x - 90} ${mp.y}, ${mp.x} ${mp.y}`);
      }
    };
    draw();
    if (reduce) {
      const t = window.setTimeout(draw, 600);
      return () => clearTimeout(t);
    }
    return () => cancelAnimationFrame(raf);
  }, [shown.length]);

  return (
    <section className="memory" aria-label="What she remembers">
      <header>
        <h2>Memory</h2>
        <span className="memory-count num">{facts.filter((f) => f.status === "approved").length}</span>
      </header>
      {shown.length === 0 ? (
        <p className="memory-empty">Nothing yet. What you approve is remembered here.</p>
      ) : (
        <ul>
          <AnimatePresence initial={false}>
            {shown.map((f) => (
              <motion.li
                key={f.id}
                layout="position"
                ref={(el) => {
                  if (el) cards.current.set(f.id, el as HTMLElement);
                  else cards.current.delete(f.id);
                }}
                className={`mem ${f.status}`}
                style={{ ["--k" as string]: KIND_COLOUR[f.kind] ?? "var(--violet)" }}
                initial={{ opacity: 0, x: -30, scale: 0.92 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ type: "spring", stiffness: 160, damping: 20 }}
              >
                <span className="mem-kind">{f.kind}</span>
                <span className="mem-text">{f.text}</span>
                <span className="mem-status">{f.status === "approved" ? "remembered" : "waiting"}</span>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
      <svg ref={svg} className="memory-lines" aria-hidden="true">
        <defs>
          <linearGradient id="mem-line" x1="0" x2="1">
            <stop offset="0" stopColor="var(--teal)" stopOpacity="0.15" />
            <stop offset="1" stopColor="var(--amber)" stopOpacity="0.85" />
          </linearGradient>
        </defs>
        {shown.map((f) => (
          <path key={f.id} data-id={f.id} className={f.status === "approved" ? "" : "pending"} stroke="url(#mem-line)" />
        ))}
      </svg>
    </section>
  );
}
