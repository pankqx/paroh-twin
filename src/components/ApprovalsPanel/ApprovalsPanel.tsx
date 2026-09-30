"use client";

import { useCallback, useEffect, useState } from "react";
import { dataService } from "@/app/dataService";
import { approveFact, editFact, rejectFact } from "@/app/factActions";
import FactCard from "@/components/FactCard/FactCard";
import LedgerList from "@/components/LedgerList/LedgerList";
import { FACTS_CHANGED } from "@/components/shell/events";
import type { Fact, JournalEntry } from "@/lib/types";
import "./ApprovalsPanel.css";

const shortDate = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const words = (s: string) => s.toLowerCase().match(/[a-z0-9']+/g) ?? [];

/** The sentence of the entry a fact came from, if it differs from the fact text. */
function sourceSentence(fact: Fact, entry?: JournalEntry): string | undefined {
  if (!entry) return undefined;
  const sentences = entry.body.split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim()).filter(Boolean);
  const factWords = new Set(words(fact.text));
  let best: { s: string; score: number } | undefined;
  for (const s of sentences) {
    const overlap = words(s).filter((w) => factWords.has(w)).length;
    if (!best || overlap > best.score) best = { s, score: overlap };
  }
  if (!best || best.score < 2) return undefined;
  return best.s.trim().toLowerCase() === fact.text.trim().toLowerCase() ? undefined : `“${best.s}”`;
}

/**
 * Everything waiting for approval, plus recent decisions. Used by the /approvals page and
 * by the slide-over tray. Approving flies the card into her mind point (or toward the
 * top-left when no face is on screen).
 */
export default function ApprovalsPanel({ variant = "page" }: { variant?: "page" | "tray" }) {
  const [facts, setFacts] = useState<Fact[] | null>(null);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [gone, setGone] = useState<Set<string>>(new Set());

  const load = useCallback(() => {
    return Promise.all([dataService.listFacts(), dataService.entries.list()]).then(([f, e]) => {
      setFacts(f);
      setEntries(e);
    });
  }, []);

  useEffect(() => {
    let live = true;
    const run = () => {
      if (live) load();
    };
    run();
    // Pick up facts added elsewhere (Journal, Talk) while this is open.
    window.addEventListener(FACTS_CHANGED, run);
    return () => {
      live = false;
      window.removeEventListener(FACTS_CHANGED, run);
    };
  }, [load]);

  if (!facts) return <div className="approvals-panel" aria-busy="true" />;

  const pending = facts
    .filter((f) => f.status === "pending" && !gone.has(f.id))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const decided = facts
    .filter((f) => f.status !== "pending")
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, variant === "tray" ? 4 : 8);
  const entryOf = (f: Fact) => entries.find((e) => e.id === f.sourceId);

  return (
    <div className={`approvals-panel ${variant}`}>
      <p className="approvals-count">
        {pending.length === 0
          ? "Nothing is waiting on you."
          : `${pending.length} thing${pending.length === 1 ? "" : "s"} waiting on you. Only what you approve reaches your twin.`}
      </p>

      {pending.length === 0 ? (
        <p className="empty-state">Nothing waiting for review. Take a breath.</p>
      ) : (
        <div className="approvals-list">
          {pending.map((fact) => (
            <FactCard
              key={fact.id}
              fact={fact}
              quote={sourceSentence(fact, entryOf(fact))}
              onApprove={() => approveFact(fact)}
              onReject={() => rejectFact(fact)}
              onEdit={(text) => editFact(fact, text)}
              onDone={() => setGone((g) => new Set(g).add(fact.id))}
            />
          ))}
        </div>
      )}

      <section className="approvals-decided">
        <h2>Recently decided</h2>
        <LedgerList
          items={decided}
          keyOf={(f) => f.id}
          empty="Nothing decided yet."
          render={(f) => (
            <div className="decided">
              <span className={`status-pill ${f.status === "approved" ? "status-approved" : "status-rejected"}`}>{f.status}</span>
              <span className="decided-text">{f.text}</span>
              <time className="decided-date" dateTime={f.updatedAt}>
                {shortDate.format(new Date(f.updatedAt))}
              </time>
            </div>
          )}
        />
      </section>
    </div>
  );
}
