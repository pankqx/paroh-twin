"use client";

import { motion, useReducedMotion } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { dataService } from "@/app/dataService";
import BlurText from "@/components/fx/BlurText";
import Orb from "@/components/fx/Orb";
import SpotlightCard from "@/components/fx/SpotlightCard";
import type { ConsentCategory } from "@/lib/types";
import "./welcome.css";

const CATEGORIES: Array<{ key: ConsentCategory; label: string; hint: string }> = [
  { key: "journal", label: "Journal", hint: "entries you write or dictate" },
  { key: "tasks", label: "Tasks and habits", hint: "what you plan and finish" },
  { key: "mood", label: "Energy and mood", hint: "a 1-5 check-in for planning" },
  { key: "planner", label: "Planner", hint: "deadlines and goals" },
];

type Choices = Record<string, boolean>;

export default function WelcomePage() {
  const router = useRouter();
  const reduce = useReducedMotion();
  const [on, setOn] = useState<Choices>({ journal: true, tasks: true, mood: true, planner: true });
  const [busy, setBusy] = useState(false);

  // Start from whatever the student already chose.
  useEffect(() => {
    let live = true;
    dataService.getConsent().then((c) => {
      if (live) setOn(Object.fromEntries(CATEGORIES.map(({ key }) => [key, c[key]])));
    });
    return () => {
      live = false;
    };
  }, []);

  async function start() {
    setBusy(true);
    const current = await dataService.getConsent();
    await dataService.setConsent({ ...current, ...on });
    router.push("/");
  }

  return (
    <main className="welcome">
      <SpotlightCard className="welcome-card">
        <div className="welcome-orb" aria-hidden="true">
          <Orb spin={18} breathe={5} glow={0.8} />
        </div>
        <BlurText text="Paroh" className="welcome-title" />
        <p className="welcome-line">Your personal twin. You decide what it knows.</p>

        <ul className="welcome-toggles">
          {CATEGORIES.map(({ key, label, hint }, i) => (
            <motion.li
              key={key}
              initial={reduce ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 + i * 0.06, duration: 0.5, ease: [0.2, 0.7, 0.2, 1] }}
            >
              <span>
                <span className="welcome-toggle-label" id={`toggle-${key}`}>
                  {label}
                </span>
                <span className="welcome-toggle-hint">{hint}</span>
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={on[key]}
                aria-labelledby={`toggle-${key}`}
                className="toggle"
                onClick={() => setOn((s) => ({ ...s, [key]: !s[key] }))}
              >
                <span className="toggle-knob" />
              </button>
            </motion.li>
          ))}
        </ul>

        <button type="button" className="btn-primary btn-block" onClick={start} disabled={busy}>
          Start with the sample student
        </button>

        <p className="welcome-note">
          This demo runs on sample data about a made-up student, Asha. When you ask the twin to
          read or explain something, the text you allow is sent to a hosted language model. You
          approve every fact before the twin learns it.
        </p>
      </SpotlightCard>
    </main>
  );
}
