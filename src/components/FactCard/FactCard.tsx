"use client";

import { useRef, useState } from "react";
import { flyToTwin } from "@/components/TwinAvatar/flyToTwin";
import type { Fact } from "@/lib/types";
import "./FactCard.css";

/** idle -> saving -> added -> flying -> gone ; idle -> dismissing -> gone */
type Phase = "idle" | "saving" | "added" | "flying" | "dismissing";

interface Props {
  fact: Fact;
  quote?: string; // what it came from
  onApprove: () => Promise<void>;
  onReject: () => Promise<void>;
  onEdit: (text: string) => Promise<void>;
  /** The card reached her mind point (it has flared). */
  onArrive?: () => void;
  /** The card has left the screen; drop it from the list. */
  onDone: () => void;
}

// Category colours are fixed across the app (design system section 4).
const CATEGORY_COLOUR: Record<string, string> = {
  study: "var(--teal)",
  health: "var(--green)",
  personal: "var(--lilac)",
  career: "var(--amber)",
  other: "var(--muted)",
};

const shortDate = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function FactCard({ fact, quote, onApprove, onReject, onEdit, onArrive, onDone }: Props) {
  const ref = useRef<HTMLElement>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(fact.text);
  const [saved, setSaved] = useState(fact.text);
  const locked = phase !== "idle";
  const confidence = Math.round(fact.confidence * 100);

  async function approve() {
    setPhase("saving");
    await onApprove();
    setPhase("added");
    await wait(650);
    setPhase("flying");
    if (ref.current) await flyToTwin(ref.current);
    onArrive?.();
    onDone();
  }

  async function reject() {
    setPhase("dismissing");
    await onReject();
    await wait(380);
    onDone();
  }

  async function saveEdit() {
    const text = draft.trim();
    if (!text) return;
    await onEdit(text);
    setSaved(text);
    setEditing(false);
  }

  return (
    <article
      ref={ref}
      className={`glass fact-card phase-${phase}`}
      style={{ ["--glass-accent" as string]: CATEGORY_COLOUR[fact.category] ?? "var(--violet)" }}
      aria-live="polite"
    >
      <div className="fact-top">
        <div className="fact-main">
          <span className="kind-pill">{fact.kind}</span>
          {editing ? (
            <input type="text" aria-label="Edit fact" value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus />
          ) : (
            <span className="fact-text">{saved}</span>
          )}
        </div>
        <time className="fact-date" dateTime={fact.createdAt}>
          {shortDate.format(new Date(fact.createdAt))}
        </time>
      </div>

      {quote && !editing && <blockquote className="fact-quote">{quote}</blockquote>}

      <div className="fact-conf" title="How sure the extractor is. Not a prediction.">
        <span className="fact-conf-label">confidence</span>
        <span className="fact-conf-track">
          <span className="fact-conf-fill" style={{ transform: `scaleX(${fact.confidence})` }} />
        </span>
        <span className="fact-conf-num num">{confidence}%</span>
      </div>

      {phase === "idle" || phase === "dismissing" ? (
        <div className="fact-actions">
          {editing ? (
            <>
              <button type="button" className="btn-primary btn-small" disabled={!draft.trim()} onClick={saveEdit}>
                Save
              </button>
              <button
                type="button"
                className="btn-text"
                onClick={() => {
                  setDraft(saved);
                  setEditing(false);
                }}
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button type="button" className="btn-primary btn-small" disabled={locked} onClick={approve}>
                Approve
              </button>
              <button type="button" className="btn-ghost btn-small not-me" disabled={locked} onClick={reject}>
                Not me
              </button>
              <button type="button" className="btn-text" disabled={locked} onClick={() => setEditing(true)}>
                Edit
              </button>
            </>
          )}
        </div>
      ) : (
        <p className="fact-added">{phase === "flying" ? "On its way to her memory…" : "Added to your twin."}</p>
      )}
    </article>
  );
}
