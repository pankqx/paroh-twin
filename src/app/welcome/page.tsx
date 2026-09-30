"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import LeafMark from "@/components/Navbar/LeafMark";
import "./welcome.css";

const CATEGORIES = [
  { key: "journal", label: "Journal" },
  { key: "tasks", label: "Tasks and habits" },
  { key: "mood", label: "Energy and mood" },
  { key: "planner", label: "Planner" },
] as const;

type Key = (typeof CATEGORIES)[number]["key"];

export default function WelcomePage() {
  const router = useRouter();
  const [on, setOn] = useState<Record<Key, boolean>>({
    journal: true,
    tasks: true,
    mood: true,
    planner: true,
  });

  return (
    <main className="welcome">
      <div className="card welcome-card">
        <LeafMark size="1.75rem" />
        <h1>Paroh</h1>
        <p className="welcome-line">Your personal twin. You decide what it knows.</p>

        <ul className="welcome-toggles">
          {CATEGORIES.map(({ key, label }) => (
            <li key={key}>
              <span id={`toggle-${key}`}>{label}</span>
              <button
                type="button"
                role="switch"
                aria-checked={on[key]}
                aria-labelledby={`toggle-${key}`}
                className="toggle"
                onClick={() => setOn((s) => ({ ...s, [key]: !s[key] }))}
              />
            </li>
          ))}
        </ul>

        <button
          type="button"
          className="btn-primary btn-block"
          onClick={() => router.push("/")}
        >
          Start with the sample student
        </button>

        <p className="welcome-note">
          This demo uses sample data about a made-up student. Nothing here is yours.
        </p>
      </div>
    </main>
  );
}
