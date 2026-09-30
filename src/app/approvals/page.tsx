"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { dataService } from "@/app/dataService";
import { recordGrowth } from "@/app/bloomGrowth";
import { notifyFactsChanged } from "@/components/shell/events";
import FactCard, { type CardPhase } from "@/components/FactCard/FactCard";
import LedgerList from "@/components/LedgerList/LedgerList";
import type { Fact, JournalEntry } from "@/lib/types";
import "./approvals.css";

const SHOW_ADDED_MS = 800; // "Added to your twin." stays readable before the card leaves
const LEAVE_MS = 500;

const shortDate = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

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
  return best.s.trim().toLowerCase() === fact.text.trim().toLowerCase() ? undefined : best.s;
}

export default function ApprovalsPage() {
  const [facts, setFacts] = useState<Fact[] | null>(null);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [phases, setPhases] = useState<Record<string, CardPhase>>({});
  const timers = useRef<number[]>([]);

  const refresh = useCallback(async () => {
    const [f, e] = await Promise.all([dataService.listFacts(), dataService.entries.list()]);
    notifyFactsChanged();
    setFacts(f);
    setEntries(e);
  }, []);

  useEffect(() => {
    let live = true;
    Promise.all([dataService.listFacts(), dataService.entries.list()]).then(([f, e]) => {
      if (!live) return;
      setFacts(f);
      setEntries(e);
    });
    const pending = timers.current;
    return () => {
      live = false;
      pending.forEach((t) => window.clearTimeout(t));
    };
  }, []);

  const later = (ms: number, fn: () => void) => {
    timers.current.push(window.setTimeout(fn, ms));
  };

  const setPhase = (id: string, phase: CardPhase) =>
    setPhases((p) => ({ ...p, [id]: phase }));

  async function approve(fact: Fact) {
    setPhase(fact.id, "added");
    const before = (await dataService.getTwinState()).confidenceByDomain;
    await dataService.setFactStatus(fact.id, "approve");
    const after = (await dataService.getTwinState()).confidenceByDomain;
    // Hand the change to the Living Core on /, which plays it once on arrival.
    recordGrowth(before, after);
    later(SHOW_ADDED_MS, () => setPhase(fact.id, "leaving"));
    later(SHOW_ADDED_MS + LEAVE_MS, refresh);
  }

  async function reject(fact: Fact) {
    setPhase(fact.id, "dismissing");
    await dataService.setFactStatus(fact.id, "reject");
    later(LEAVE_MS, refresh);
  }

  async function edit(fact: Fact, text: string) {
    await dataService.setFactStatus(fact.id, "edit", { text });
    await refresh();
  }

  if (!facts) return <main className="page approvals" aria-busy="true" />;

  const pending = facts
    .filter((f) => f.status === "pending")
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const decided = facts
    .filter((f) => f.status !== "pending")
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 8);
  const entryOf = (f: Fact) => entries.find((e) => e.id === f.sourceId);
  // Cards mid-exit still count as waiting until the list refreshes.
  const count = pending.length;

  return (
    <main className="page approvals">
      <h1>Approvals</h1>
      <p className="approvals-sub">
        {count === 0
          ? "Nothing is waiting on you."
          : `${count} thing${count === 1 ? "" : "s"} waiting on you. Only what you approve reaches your twin.`}
      </p>

      {count === 0 ? (
        <p className="empty-state">Nothing waiting for review. Take a breath.</p>
      ) : (
        <div className="approvals-list">
          {pending.map((fact) => (
            <FactCard
              key={fact.id}
              fact={fact}
              quote={sourceSentence(fact, entryOf(fact))}
              phase={phases[fact.id] ?? "idle"}
              onApprove={() => approve(fact)}
              onReject={() => reject(fact)}
              onEdit={(text) => edit(fact, text)}
            />
          ))}
        </div>
      )}

      <section className="panel approvals-decided rise" style={{ ["--i" as string]: 2 }}>
        <h2>Recently decided</h2>
        <LedgerList
          items={decided}
          keyOf={(f) => f.id}
          empty="Nothing decided yet."
          render={(f) => (
            <div className="decided">
              <span className={`status-pill ${f.status === "approved" ? "status-approved" : "status-rejected"}`}>
                {f.status}
              </span>
              <span className="decided-text">{f.text}</span>
              <time className="decided-date" dateTime={f.updatedAt}>
                {shortDate.format(new Date(f.updatedAt))}
              </time>
            </div>
          )}
        />
      </section>
    </main>
  );
}
