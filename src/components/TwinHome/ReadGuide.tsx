"use client";

// "What am I looking at?": every visual on the Twin page, where its data comes from and what it
// means. Judges ask; this answers on screen.

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";

const ROWS: Array<[string, string, string]> = [
  ["The twin (line art)", "Everything below", "Frank's twin. Her mind point flares when a fact is approved."],
  ["Stars around her", "Approved facts only", "One star per fact Frank approved, grouped by kind: tasks, deadlines, goals, habits, routines, preferences. Hover a star to read it."],
  ["Weekly load", "Tasks (sample planner)", "Hours due per day for the next 7 days against 4 free hours a day. Over 85% is heavy."],
  ["Habit consistency", "Habit check-ins, 14 days", "Share of habits ticked each day. Feeds how the twin predicts routine."],
  ["Goal-linked work", "Finished tasks tied to a goal", "Hours per day that moved a goal forward. Shows whether effort matches goals."],
  ["Twin's guess vs your choice", "Ask decisions + feedback", "Before each what-if the twin guesses your pick. Matches raise the fidelity score."],
  ["Fidelity", "Feedback on decisions", "How often the twin predicted Frank's real choice. An estimate, not a promise."],
  ["Focus hours heatmap", "Completed task times", "When finished work usually happens, by weekday and hour. The twin uses it to suggest when to schedule work."],
  ["How well she knows you", "Confidence per domain", "Grows as approved facts and data arrive in each area; the twin asks about the weakest areas first."],
  ["Chips and bubble", "Same data", "Short spoken-style summaries of the numbers above."],
];

export default function ReadGuide() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="btn-ghost read-guide-btn" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        {open ? "Close guide" : "What am I looking at?"}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            className="glass read-guide"
            role="dialog"
            aria-label="How to read the Twin page"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.3, ease: [0.2, 0.7, 0.2, 1] }}
          >
            <p className="read-guide-lede">
              Every number here comes from data Frank allowed and facts he approved. Sample student data; the model is an explainable estimate.
            </p>
            <dl>
              {ROWS.map(([what, from, means]) => (
                <div key={what}>
                  <dt>
                    {what} <span>{from}</span>
                  </dt>
                  <dd>{means}</dd>
                </div>
              ))}
            </dl>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
