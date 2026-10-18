"use client";

import { useEffect, useState } from "react";
import "./VisitCounter.css";

const SEEN_KEY = "paroh-visit-counted";

/** Counts each browser once (a refresh does not add a visit). Shows nothing if the counter is unreachable. */
export default function VisitCounter() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    let seen = false;
    try { seen = localStorage.getItem(SEEN_KEY) === "1"; } catch { /* storage blocked: count as a new visit */ }

    fetch("/api/visits", { method: seen ? "GET" : "POST", cache: "no-store" })
      .then(res => res.json() as Promise<{ count: number | null }>)
      .then(({ count: next }) => {
        if (!alive || typeof next !== "number") return;
        setCount(next);
        if (!seen) { try { localStorage.setItem(SEEN_KEY, "1"); } catch { /* ignore */ } }
      })
      .catch(() => { /* counter is optional */ });

    return () => { alive = false; };
  }, []);

  if (count === null) return null;
  return (
    <div className="visit-counter" role="status" aria-label={`${count} visits to this site`} title="Anonymous visit counter: one number, nothing about you is stored">
      <span className="visit-dot" aria-hidden="true" />
      <span className="visit-num">{count.toLocaleString("en-IN")}</span>
      <span className="visit-label">{count === 1 ? "visit" : "visits"}</span>
    </div>
  );
}
