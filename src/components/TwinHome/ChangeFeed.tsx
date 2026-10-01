"use client";

// Shows how the student's latest approvals moved the dashboard: the answer to
// "how does what I tell the twin change this page?"

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { clearChanges, readChanges, type Change } from "@/app/lastChange";

export default function ChangeFeed() {
  const [changes, setChanges] = useState<Change[]>([]);
  useEffect(() => {
    setChanges(readChanges()); // eslint-disable-line react-hooks/set-state-in-effect
  }, []);
  const latest = changes[0];
  return (
    <AnimatePresence>
      {latest && (
        <motion.div
          className="glass change-feed"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ delay: 1.2, duration: 0.5, ease: [0.2, 0.7, 0.2, 1] }}
          role="status"
        >
          <p className="change-eyebrow">What changed since you last taught her</p>
          <p className="change-fact">&ldquo;{latest.fact}&rdquo;</p>
          <ul>
            {latest.lines.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
          {changes.length > 1 && <p className="change-more">+{changes.length - 1} earlier change{changes.length > 2 ? "s" : ""} also reflected below.</p>}
          <button
            type="button"
            className="btn-ghost btn-small"
            onClick={() => {
              clearChanges();
              setChanges([]);
            }}
          >
            Got it
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
