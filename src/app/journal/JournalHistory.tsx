"use client";

// Previous journals, newest first: written entries and voice journals from Talk's free-talk mode.
// Click one to read it and see which facts came from it.

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { dataService } from "@/app/dataService";
import type { Fact, JournalEntry } from "@/lib/types";

const MOOD = ["", "Low", "Meh", "Ok", "Good", "Great"];
type Tab = "all" | "voice" | "written";

export default function JournalHistory({ refreshKey, onUse }: { refreshKey: number; onUse?: (e: JournalEntry) => void }) {
  const [entries, setEntries] = useState<JournalEntry[] | null>(null);
  const [facts, setFacts] = useState<Fact[]>([]);
  const [tab, setTab] = useState<Tab>("all");
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    Promise.all([dataService.entries.list(), dataService.facts.list()]).then(([e, f]) => {
      if (!live) return;
      setEntries(e.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      setFacts(f);
    });
    return () => {
      live = false;
    };
  }, [refreshKey]);

  const isVoice = (e: JournalEntry) => e.tags.includes("voice") || e.id.startsWith("voice-");
  const list = (entries ?? []).filter((e) => (tab === "all" ? true : tab === "voice" ? isVoice(e) : !isVoice(e)));
  const count = (t: Tab) => (entries ?? []).filter((e) => (t === "all" ? true : t === "voice" ? isVoice(e) : !isVoice(e))).length;

  return (
    <aside className="glass journal-history" aria-label="Previous journals">
      <header>
        <h2>Your journal</h2>
        <span className="num">{entries?.length ?? 0}</span>
      </header>
      <div className="jh-tabs" role="tablist">
        {(["all", "voice", "written"] as Tab[]).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? "on" : ""} onClick={() => setTab(t)}>
            {t === "all" ? "All" : t === "voice" ? "Voice" : "Written"} <em>{count(t)}</em>
          </button>
        ))}
      </div>
      {entries === null ? (
        <p className="jh-empty">Loading…</p>
      ) : list.length === 0 ? (
        <p className="jh-empty">{tab === "voice" ? "No voice journals yet. Try Free talk on the Talk page." : "No entries yet."}</p>
      ) : (
        <ul className="jh-list">
          {list.map((e, i) => {
            const mine = facts.filter((f) => f.sourceId === e.id);
            const approved = mine.filter((f) => f.status === "approved").length;
            const pending = mine.filter((f) => f.status === "pending").length;
            const expanded = open === e.id;
            return (
              <motion.li key={e.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 8) * 0.04 }}>
                <button type="button" className={`jh-item${expanded ? " open" : ""}`} onClick={() => setOpen(expanded ? null : e.id)} aria-expanded={expanded}>
                  <span className="jh-top">
                    <span className={`jh-kind ${isVoice(e) ? "voice" : "written"}`}>{isVoice(e) ? "🎙 voice" : "✎ written"}</span>
                    <time>{new Date(e.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</time>
                  </span>
                  <b>{e.title}</b>
                  {!expanded && <span className="jh-snip">{e.body.length > 110 ? `${e.body.slice(0, 108)}…` : e.body}</span>}
                </button>
                <AnimatePresence>
                  {expanded && (
                    <motion.div className="jh-read" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
                      <p>{e.body}</p>
                      <p className="jh-meta">
                        {[e.mood ? `Mood: ${MOOD[e.mood]}` : "", e.tags.filter((t) => t !== "voice").map((t) => `#${t}`).join(" ")].filter(Boolean).join(" · ")}
                      </p>
                      {mine.length > 0 && (
                        <div className="jh-facts">
                          <span>From this entry:</span>
                          <ul>
                            {mine.map((f) => (
                              <li key={f.id} className={f.status}>
                                <i>{f.kind}</i> {f.text}
                                <em>{f.status === "approved" ? "learned" : f.status === "pending" ? "waiting for you" : "not me"}</em>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {onUse && (
                        <button type="button" className="btn-text" onClick={() => onUse(e)}>
                          Open in the editor
                        </button>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
                {(approved > 0 || pending > 0) && !expanded && (
                  <span className="jh-badges">
                    {approved > 0 && <span className="ok">{approved} learned</span>}
                    {pending > 0 && <span className="wait">{pending} to review</span>}
                  </span>
                )}
              </motion.li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}
