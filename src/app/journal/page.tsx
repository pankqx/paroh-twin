"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { dataService } from "@/app/dataService";
import { notifyFactsChanged } from "@/components/shell/events";
import { demoEntry } from "@/mock/demoEntry";
import type { JournalEntry, Level } from "@/lib/types";
import "./journal.css";

const LEVELS = ["Low", "Meh", "Ok", "Good", "Great"] as const;

// Minimal typing for the (prefixed) browser SpeechRecognition API.
interface RecognitionResult {
  isFinal: boolean;
  0: { transcript: string };
}
interface RecognitionEvent {
  resultIndex: number;
  results: ArrayLike<RecognitionResult>;
}
interface Recognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((e: RecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start(): void;
  stop(): void;
}
type RecognitionCtor = new () => Recognition;

function getRecognition(): RecognitionCtor | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

type Outcome =
  | { kind: "found"; count: number }
  | { kind: "none" }
  | { kind: "off" }
  | { kind: "error" };

export default function JournalPage() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [level, setLevel] = useState<Level | undefined>();
  const [tags, setTags] = useState("");
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const canDictate = useSyncExternalStore(
    () => () => {},
    () => Boolean(getRecognition()),
    () => false,
  );
  const [listening, setListening] = useState(false);
  const recogRef = useRef<Recognition | null>(null);
  const usedDemo = useRef(false);

  useEffect(() => {
    return () => recogRef.current?.stop();
  }, []);

  function useDemo() {
    setTitle(demoEntry.title);
    setBody(demoEntry.body);
    setTags(demoEntry.tags.join(", "));
    setLevel(4);
    usedDemo.current = true;
    setOutcome(null);
  }

  function toggleDictation() {
    if (listening) {
      recogRef.current?.stop();
      return;
    }
    const Ctor = getRecognition();
    if (!Ctor) return;
    const recog = new Ctor();
    recog.continuous = true;
    recog.interimResults = false;
    recog.lang = "en-IN";
    recog.onresult = (e) => {
      let heard = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) heard += e.results[i][0].transcript;
      }
      if (heard.trim()) setBody((b) => (b && !/\s$/.test(b) ? `${b} ` : b) + heard.trim());
    };
    recog.onend = () => setListening(false);
    recog.onerror = () => setListening(false);
    recogRef.current = recog;
    setListening(true);
    recog.start();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim() || busy) return;
    recogRef.current?.stop();
    setBusy(true);
    setOutcome(null);
    try {
      // The demo entry keeps its fixed id so its canned facts link back to it.
      const isDemo = usedDemo.current && body.trim() === demoEntry.body.trim();
      const now = new Date().toISOString();
      const entry: JournalEntry = {
        id: isDemo ? demoEntry.id : `entry-${Date.now()}`,
        title: title.trim() || "Untitled",
        body: body.trim(),
        tags: tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        mood: level,
        energy: level,
        createdAt: now,
        updatedAt: now,
      };
      await dataService.saveEntry(entry);
      const consent = await dataService.getConsent();
      if (!consent.journal) {
        setOutcome({ kind: "off" });
        return;
      }
      const facts = await dataService.extractFacts({
        text: entry.body,
        source: "journal",
        sourceId: entry.id,
      });
      notifyFactsChanged();
      setOutcome(facts.length ? { kind: "found", count: facts.length } : { kind: "none" });
    } catch {
      setOutcome({ kind: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="page journal">
      <h1>Journal</h1>
      <p className="journal-sub">
        Write it down however it comes. Paroh will suggest what to remember, and you decide.
      </p>

      <form className="card journal-form" onSubmit={submit}>
        <div className="field-block">
          <label htmlFor="j-title">Title</label>
          <input
            id="j-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="A focused study week"
          />
        </div>

        <div className="field-block">
          <label htmlFor="j-body">What is on your mind?</label>
          <textarea
            id="j-body"
            className="journal-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Deadlines, plans, what worked today…"
          />
        </div>

        <div className="field-block">
          <span className="label-like" id="j-level">
            Energy and mood
          </span>
          <div className="chip-row" role="group" aria-labelledby="j-level">
            {LEVELS.map((name, i) => {
              const value = (i + 1) as Level;
              return (
                <button
                  key={name}
                  type="button"
                  className="chip"
                  aria-pressed={level === value}
                  onClick={() => setLevel(level === value ? undefined : value)}
                >
                  {name}
                </button>
              );
            })}
          </div>
        </div>

        <div className="field-block">
          <label htmlFor="j-tags">Tags</label>
          <input
            id="j-tags"
            type="text"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="study, project (comma separated)"
          />
        </div>

        <div className="journal-aids">
        <div className="journal-tools">
          {canDictate && (
            <button type="button" className="btn-text" onClick={toggleDictation}>
              {listening ? "Stop dictating" : "Dictate"}
            </button>
          )}
          <button type="button" className="btn-text" onClick={useDemo}>
            Use demo entry
          </button>
        </div>
        {canDictate && (
          <p className="journal-hint">
            {listening
              ? "Listening… your browser turns speech into text. Nothing is recorded by Paroh."
              : "Dictation uses your browser’s speech service. Paroh never stores audio."}
          </p>
        )}
        </div>

        <button type="submit" className="btn-primary btn-block" disabled={busy || !body.trim()}>
          {busy ? "Reading your entry…" : "Find what to remember"}
        </button>

        {outcome && (
          <p className={`journal-result ${outcome.kind === "error" ? "error-text" : ""}`} role="status">
            {outcome.kind === "found" && (
              <>
                {outcome.count} thing{outcome.count === 1 ? "" : "s"} to review.{" "}
                <Link href="/approvals">Go to Approvals</Link>
              </>
            )}
            {outcome.kind === "none" && "Saved. Nothing to remember in that entry this time."}
            {outcome.kind === "off" && (
              <>
                Saved. Journal is switched off, so nothing was read.{" "}
                <Link href="/privacy">Privacy</Link>
              </>
            )}
            {outcome.kind === "error" && "Something went wrong. Please try again."}
          </p>
        )}
      </form>
    </main>
  );
}
