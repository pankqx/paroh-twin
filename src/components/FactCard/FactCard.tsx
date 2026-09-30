"use client";

import { useState } from "react";
import type { Fact } from "@/lib/types";
import "./FactCard.css";

/** idle -> (approve) added -> leaving ; idle -> (reject) dismissing */
export type CardPhase = "idle" | "added" | "leaving" | "dismissing";

interface Props {
  fact: Fact;
  quote?: string; // the sentence it came from
  phase: CardPhase;
  onApprove: () => void;
  onReject: () => void;
  onEdit: (text: string) => void;
}

const shortDate = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

export default function FactCard({ fact, quote, phase, onApprove, onReject, onEdit }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(fact.text);
  const locked = phase !== "idle";

  return (
    <article className={`card fact-card phase-${phase}`} aria-live="polite">
      <div className="fact-top">
        <div className="fact-main">
          <span className="kind-pill">{fact.kind}</span>
          {editing ? (
            <input
              type="text"
              aria-label="Edit fact"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              autoFocus
            />
          ) : (
            <span className="fact-text">{fact.text}</span>
          )}
        </div>
        <time className="fact-date" dateTime={fact.createdAt}>
          {shortDate.format(new Date(fact.createdAt))}
        </time>
      </div>

      {quote && !editing && <blockquote className="fact-quote">&ldquo;{quote}&rdquo;</blockquote>}

      {phase === "idle" || phase === "dismissing" ? (
        <div className="fact-actions">
          {editing ? (
            <>
              <button
                type="button"
                className="btn-primary btn-small"
                disabled={!draft.trim()}
                onClick={() => {
                  onEdit(draft.trim());
                  setEditing(false);
                }}
              >
                Save
              </button>
              <button
                type="button"
                className="btn-text"
                onClick={() => {
                  setDraft(fact.text);
                  setEditing(false);
                }}
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="btn-primary btn-small"
                disabled={locked}
                onClick={onApprove}
              >
                Approve
              </button>
              <button
                type="button"
                className="btn-secondary btn-small not-me"
                disabled={locked}
                onClick={onReject}
              >
                Not me
              </button>
              <button
                type="button"
                className="btn-text"
                disabled={locked}
                onClick={() => setEditing(true)}
              >
                Edit
              </button>
            </>
          )}
        </div>
      ) : (
        <p className="fact-added">Added to your twin.</p>
      )}
    </article>
  );
}
