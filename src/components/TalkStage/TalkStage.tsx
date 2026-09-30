"use client";

import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { approveFact, editFact, rejectFact } from "@/app/factActions";
import { dataService } from "@/app/dataService";
import FactCard from "@/components/FactCard/FactCard";
import { setVoiceEnabled, useVoicePref } from "@/components/shell/useVoicePref";
import AvatarAnchor from "@/components/TwinAvatar/AvatarAnchor";
import { play, setLive, type AvatarState } from "@/components/TwinAvatar/avatarStore";
import ChooseTwin from "@/components/TwinStage/ChooseTwin";
import Gauges from "@/components/TwinStage/Gauges";
import MemoryStream from "@/components/TwinStage/MemoryStream";
import Waveform from "@/components/Waveform/Waveform";
import * as listen from "@/lib/voice/listen";
import * as speech from "@/lib/voice/speak";
import type { Fact } from "@/lib/types";
import { converse, openingTurn, type ConverseTurn } from "./converse";
import Karaoke from "./Karaoke";
import "./TalkStage.css";

interface Turn {
  id: number;
  who: "you" | "twin";
  text: string; // what is shown (her spoken line, or what you said)
  reply?: string; // her written reply, when it differs from what she says
  offer?: { kind: "whatif" | "journal"; text: string };
}

interface Card {
  fact: Fact;
  said: string;
}

// A tapped reply becomes a first-person sentence, so the extractor can read it like a
// journal line. The transcript shows the label; the sentence is what is sent.
const STATEMENT: Record<string, (a: string) => string> = {
  tasks: (a) => `I will work on ${a.toLowerCase()} this week.`,
  habits: (a) => `I want to keep my ${a.toLowerCase()} habit.`,
  routines: (a) => `I work best in the ${a.toLowerCase()}.`,
  energy: (a) => `I work best in the ${a.toLowerCase()}.`,
  goals: (a) => `My goal this week is ${a.toLowerCase()}.`,
  planner: (a) => `I can study for ${a.toLowerCase()} tomorrow.`,
};

const CONFIRMATIONS = ["Got it. I'll remember that.", "Noted. Thank you.", "That helps. Thank you."];
const UNSUPPORTED = "Voice input isn't available in this browser.";
const FAILED = "Something went wrong on my side. Try again, or type it below.";

const noopSubscribe = () => () => {};
const entryId = () => `talk-${Date.now()}`;

export default function TalkStage() {
  const router = useRouter();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [learned, setLearned] = useState<string[]>([]);
  const [quick, setQuick] = useState<string[]>([]);
  const [listening, setListening] = useState(false);
  const [pending, setPending] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [sentence, setSentence] = useState("");
  const [mouth, setMouth] = useState<0 | 1 | 2 | 3>(0);
  const [interim, setInterim] = useState("");
  const [typed, setTyped] = useState("");
  const [level, setLevel] = useState(0);
  const [error, setError] = useState("");
  const [offline, setOffline] = useState(false);
  const [voiceConsent, setVoiceConsent] = useState(true); // "voice" consent category: may answers become facts?
  const [navTo, setNavTo] = useState(""); // what-if prompt we are about to open in Ask
  const [saved, setSaved] = useState<Record<number, string>>({}); // turn id -> note under a journal offer
  const [voiceOn] = useVoicePref();

  const canListen = useSyncExternalStore(noopSubscribe, listen.isSupported, () => true);

  const turnsRef = useRef<Turn[]>([]);
  const nextId = useRef(1);
  const reqId = useRef(0);
  const listeningRef = useRef(false);
  const pendingRef = useRef(false);
  const interimRef = useRef("");
  const domainRef = useRef<string | undefined>(undefined);
  const navRef = useRef("");
  const lastLevel = useRef(0);
  const confirmIdx = useRef(0);
  const logRef = useRef<HTMLOListElement>(null);
  const actions = useRef<{ send: (t: string, label?: string) => Promise<void>; toggleMic: () => void; stopAll: () => void }>({
    send: async () => {},
    toggleMic: () => {},
    stopAll: () => {},
  });

  const pushTurn = useCallback((t: Omit<Turn, "id">) => {
    const turn = { ...t, id: nextId.current++ };
    turnsRef.current = [...turnsRef.current, turn];
    setTurns(turnsRef.current);
    return turn;
  }, []);

  const setPendingBoth = useCallback((v: boolean) => {
    pendingRef.current = v;
    setPending(v);
  }, []);

  const setListeningBoth = useCallback((v: boolean) => {
    listeningRef.current = v;
    setListening(v);
    if (!v) {
      interimRef.current = "";
      setInterim("");
      setLevel(0);
    }
  }, []);

  // "Learned today": facts approved today, newest first.
  const refreshLearned = useCallback(() => {
    const today = new Date().toDateString();
    dataService.facts
      .list()
      .then((list) =>
        setLearned(
          list
            .filter((f) => f.status === "approved" && new Date(f.updatedAt).toDateString() === today)
            .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
            .map((f) => f.text),
        ),
      )
      .catch(() => {});
  }, []);

  // Her opening line. It is shown but not spoken: speech needs a tap first.
  useEffect(() => {
    let live = true;
    openingTurn()
      .then((o) => {
        if (!live || turnsRef.current.length > 0) return;
        pushTurn({ who: "twin", text: o.text });
        setQuick(o.quickReplies);
        domainRef.current = o.domain;
      })
      .catch(() => {
        if (live && turnsRef.current.length === 0) pushTurn({ who: "twin", text: "Hi, I'm your twin. Tell me about your week or ask me a what-if." });
      });
    refreshLearned();
    dataService
      .getConsent()
      .then((c) => live && setVoiceConsent(c.voice))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [pushTurn, refreshLearned]);

  const goAsk = useCallback(() => {
    const prompt = navRef.current;
    if (!prompt) return;
    navRef.current = "";
    setNavTo("");
    router.push(`/ask?q=${encodeURIComponent(prompt)}&run=1`);
  }, [router]);

  const cancelNav = useCallback(() => {
    navRef.current = "";
    setNavTo("");
  }, []);

  const scheduleNav = useCallback(
    (prompt: string, said: string) => {
      navRef.current = prompt;
      setNavTo(prompt);
      // With voice on, leave once she finishes speaking (see the speech subscription). The timer
      // is the backstop for a speech engine that never reports back, sized to what she says.
      const words = said.split(/\s+/).filter(Boolean).length;
      const wait = speech.isSupported() && speech.getEnabled() ? Math.min(20000, 3000 + words * 450) : 1800;
      window.setTimeout(() => {
        if (navRef.current === prompt) goAsk();
      }, wait);
    },
    [goAsk],
  );

  const stopAll = useCallback(() => {
    reqId.current++;
    speech.stop();
    listen.stop();
    navRef.current = "";
    setNavTo("");
    setPendingBoth(false);
    setListeningBoth(false);
  }, [setPendingBoth, setListeningBoth]);

  // Candidate facts must exist in the store before they can be approved. converse() returns
  // them without saving, so save any that are new (never overwrite one already decided).
  const storeCandidates = useCallback(async (facts: Fact[]): Promise<Fact[]> => {
    const fresh: Fact[] = [];
    try {
      // list() rather than get(): get() on an id that doesn't exist throws in LocalDataService.
      const stored = new Map((await dataService.facts.list()).map((f) => [f.id, f]));
      for (const fact of facts) {
        const existing = stored.get(fact.id);
        if (existing) {
          if (existing.status === "pending") fresh.push(existing);
          continue;
        }
        await dataService.facts.upsert({ ...fact, status: "pending" });
        fresh.push(fact);
      }
    } catch {
      /* cards that can't be stored are skipped rather than shown broken */
    }
    return fresh;
  }, []);

  // One turn: send the utterance, show and speak her answer, then her follow-up.
  const send = useCallback(
    async (raw: string, label?: string) => {
      const text = raw.trim();
      if (!text) return;
      speech.stop();
      listen.stop();
      setListeningBoth(false);
      setError("");
      setQuick([]);
      setTyped("");
      const me = reqId.current + 1;
      reqId.current = me;

      const history: ConverseTurn[] = turnsRef.current.slice(-8).map((t) => ({ role: t.who === "you" ? "user" : "twin", text: t.text }));
      pushTurn({ who: "you", text: label ?? text });
      setPendingBoth(true);

      try {
        const r = await converse(text, history);
        const facts = r.candidateFacts.length ? await storeCandidates(r.candidateFacts) : [];
        if (me !== reqId.current) return; // cancelled or superseded
        setPendingBoth(false);
        setOffline(Boolean(r.degraded));

        const main = r.spoken || r.reply;
        // Some replies already end with the follow-up question; don't say it twice.
        const follow = r.followUp?.text && !main.includes(r.followUp.text) ? r.followUp.text : "";
        const said = [main, follow].filter(Boolean).join(" ");
        const offer =
          r.intent === "whatif"
            ? { kind: "whatif" as const, text: r.whatIfPrompt || text }
            : r.intent === "journal"
              ? { kind: "journal" as const, text }
              : undefined;
        pushTurn({ who: "twin", text: said || r.reply, reply: r.reply && r.reply !== r.spoken && r.reply !== said ? r.reply : undefined, offer });

        if (facts.length) setCards((list) => [...list, ...facts.map((fact) => ({ fact, said: `You said: “${label ?? text}”` }))]);
        setQuick(r.followUp?.quickReplies ?? []);
        domainRef.current = r.followUp?.domain;
        if (said) speech.speak(said);
        if (r.intent === "whatif") scheduleNav(r.whatIfPrompt || text, said);
      } catch {
        if (me !== reqId.current) return;
        setPendingBoth(false);
        setOffline(true);
        pushTurn({ who: "twin", text: FAILED });
      }
    },
    [pushTurn, scheduleNav, setListeningBoth, setPendingBoth, storeCandidates],
  );

  const startListening = useCallback(() => {
    setVoiceEnabled(true); // the tap is the gesture that lets her speak
    setError("");
    listen.stop();
    if (!listen.start({ measureLevel: true })) {
      setError(UNSUPPORTED);
      return;
    }
    setListeningBoth(true);
  }, [setListeningBoth]);

  const toggleMic = useCallback(() => {
    if (pendingRef.current) {
      // Thinking: cancel and get the screen back.
      reqId.current++;
      setPendingBoth(false);
      return;
    }
    if (listeningRef.current) {
      // Tap to stop: send what was heard so far, if anything.
      const heard = interimRef.current;
      listen.stop();
      setListeningBoth(false);
      if (heard) void send(heard);
      return;
    }
    speech.stop(); // barge-in when she is speaking
    startListening();
  }, [send, startListening, setPendingBoth, setListeningBoth]);

  useEffect(() => {
    actions.current = { send, toggleMic, stopAll };
  });

  // Speech synthesis, microphone events, keyboard.
  useEffect(() => {
    const offSpeak = speech.subscribe((s) => {
      setSpeaking(s.isSpeaking);
      setSentence(s.currentSentence);
      setMouth(s.mouth);
      if (!s.isSpeaking && navRef.current) window.setTimeout(goAsk, 500);
    });
    const offInterim = listen.onInterim((t) => {
      if (!listeningRef.current) return;
      interimRef.current = t;
      setInterim(t);
    });
    const offFinal = listen.onFinal((t) => {
      if (!listeningRef.current) return;
      setListeningBoth(false);
      listen.stop();
      void actions.current.send(t);
    });
    const offEnd = listen.onEnd(() => {
      setLevel(0);
      if (!listeningRef.current) return;
      const heard = interimRef.current;
      setListeningBoth(false);
      if (heard) void actions.current.send(heard);
    });
    const offError = listen.onError((_code, friendly) => {
      setListeningBoth(false);
      setError(friendly);
    });
    const offLevel = listen.onLevel((l) => {
      const now = performance.now();
      if (now - lastLevel.current > 50) {
        lastLevel.current = now;
        setLevel(l);
      }
    });

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        actions.current.stopAll();
        return;
      }
      if (e.key !== " " || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      // Leave typing and any focused control alone (Space already activates buttons).
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || tag === "BUTTON" || tag === "A") return;
      e.preventDefault();
      actions.current.toggleMic();
    };
    window.addEventListener("keydown", onKey);

    return () => {
      offSpeak();
      offInterim();
      offFinal();
      offEnd();
      offError();
      offLevel();
      window.removeEventListener("keydown", onKey);
      reqId.current++;
      navRef.current = "";
      listen.stop();
      speech.stop();
    };
  }, [goAsk, setListeningBoth]);

  // Keep the newest turn in view (inside the transcript only).
  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [turns, pending]);

  function tapChip(label: string) {
    const domain = domainRef.current;
    const sentenceText = domain && STATEMENT[domain] ? STATEMENT[domain](label) : label;
    void send(sentenceText, label);
  }

  function dismissCard(id: string) {
    setCards((list) => list.filter((c) => c.fact.id !== id));
  }

  function arrived() {
    refreshLearned();
    play("delighted");
    speech.speak(CONFIRMATIONS[confirmIdx.current++ % CONFIRMATIONS.length]);
  }

  async function allowVoiceAnswers() {
    try {
      const c = await dataService.getConsent();
      await dataService.setConsent({ ...c, voice: true });
      setVoiceConsent(true);
    } catch {
      setError("I couldn't change that setting. You can switch it on in Sources.");
    }
  }

  async function saveJournal(turn: Turn) {
    if (!turn.offer) return;
    const note = (msg: string) => setSaved((s) => ({ ...s, [turn.id]: msg }));
    try {
      const consent = await dataService.getConsent();
      if (!consent.journal) return note("Journal is switched off in Sources, so I didn't save it.");
      const now = new Date().toISOString();
      const entry = { id: entryId(), title: turn.offer.text.slice(0, 40), body: turn.offer.text, tags: ["voice"], createdAt: now, updatedAt: now };
      if (dataService.saveEntry) await dataService.saveEntry(entry);
      else await dataService.entries.upsert(entry);
      note("Saved to your Journal.");
    } catch {
      note("I couldn't save that. Try again from the Journal page.");
    }
  }

  const faceState: AvatarState = listening ? "listening" : pending ? "thinking" : speaking ? "speaking" : "idle";
  const micState = listening ? "listening" : pending ? "thinking" : speaking ? "speaking" : "idle";
  const micLabel = { idle: "Tap to talk", listening: "Listening… tap to stop", thinking: "Thinking… tap to cancel", speaking: "Tap to interrupt" }[micState];
  const lastTwin = [...turns].reverse().find((t) => t.who === "twin");

  // The one persistent avatar (mounted in the layout) mirrors what this screen is doing.
  useEffect(() => {
    setLive({ state: faceState, mouth: speaking ? mouth : undefined, level });
  }, [faceState, speaking, mouth, level]);
  useEffect(() => () => setLive({ state: "idle", mouth: undefined, level: 0 }), []);

  return (
    <main className="talk">
      <div className="talk-stage">
        <div className="talk-face">
          <AvatarAnchor kind="talk" />
        </div>

        {/* Left: the conversation. */}
        <section className="talk-left" aria-label="Conversation">
          <header className="talk-log-head">
            <p className="talk-eyebrow">Conversation</p>
            {offline && (
              <span className="talk-offline" title="The language model didn't answer, so these are built-in replies.">
                offline mode
              </span>
            )}
            <button type="button" className="talk-voice" onClick={() => setVoiceEnabled(!voiceOn)} aria-pressed={voiceOn}>
              voice {voiceOn ? "on" : "off"}
            </button>
          </header>

          {!voiceConsent && (
            <p className="talk-consent">
              Voice answers are off, so nothing you say becomes a fact. I can still chat.{" "}
              <button type="button" className="btn-text" onClick={allowVoiceAnswers}>
                Turn on voice answers
              </button>
            </p>
          )}

          <ol className="talk-log" ref={logRef} aria-live="polite">
            <AnimatePresence initial={false}>
              {turns.map((t) => (
                <motion.li
                  key={t.id}
                  className={`turn ${t.who}`}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.45, ease: [0.2, 0.7, 0.2, 1] }}
                >
                  <span className="turn-who">{t.who === "you" ? "You" : "Twin"}</span>
                  <p className="turn-text">
                    {t.who === "twin" && t.id === lastTwin?.id ? <Karaoke line={t.text} sentence={sentence} speaking={speaking} /> : t.text}
                  </p>
                  {t.reply && <p className="turn-reply">{t.reply}</p>}
                  {t.offer?.kind === "whatif" && t.id === lastTwin?.id && navTo && (
                    <p className="turn-offer">
                      Opening Ask…{" "}
                      <button type="button" className="btn-text" onClick={cancelNav}>
                        Stay here
                      </button>
                      <button type="button" className="btn-text" onClick={goAsk}>
                        Go now
                      </button>
                    </p>
                  )}
                  {t.offer?.kind === "journal" && (
                    <p className="turn-offer">
                      {saved[t.id] ?? (
                        <button type="button" className="btn-ghost btn-small" onClick={() => saveJournal(t)}>
                          Save as a journal entry
                        </button>
                      )}
                    </p>
                  )}
                </motion.li>
              ))}
              {pending && (
                <motion.li key="pending" className="turn twin pending" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <span className="turn-who">Twin</span>
                  <p className="turn-text" aria-label="Thinking">
                    <span className="dots" aria-hidden="true">
                      <i />
                      <i />
                      <i />
                    </span>
                  </p>
                </motion.li>
              )}
            </AnimatePresence>
          </ol>
          <p className="talk-keys">Space to talk · Esc to stop</p>
          <MemoryStream />
        </section>

        {/* Right: candidate facts to approve, and what she learned today. */}
        <aside className="talk-right">
          <ChooseTwin />
          <Gauges />
          <div className="talk-cards" aria-label="Facts to approve">
            <AnimatePresence>
              {cards.map(({ fact, said }) => (
                <motion.div key={fact.id} layout="position" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.45, ease: [0.2, 0.7, 0.2, 1] }}>
                  <FactCard
                    fact={fact}
                    quote={said}
                    onApprove={async () => {
                      await approveFact(fact);
                      setLearned((l) => [fact.text, ...l.filter((x) => x !== fact.text)]); // counts straight away
                    }}
                    onReject={() => rejectFact(fact)}
                    onEdit={(text) => editFact(fact, text)}
                    onArrive={arrived}
                    onDone={() => dismissCard(fact.id)}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          <section className="glass talk-learned" aria-label="Learned today" style={{ ["--glass-accent" as string]: "var(--green)" }}>
            <header>
              <h2>Learned today</h2>
              <span className="talk-learned-count num">{learned.length}</span>
            </header>
            {learned.length === 0 ? (
              <p className="talk-learned-empty">Nothing yet. Approve a card and it lands here.</p>
            ) : (
              <ul>
                {learned.slice(0, 5).map((t, i) => (
                  <li key={`${i}-${t}`}>{t}</li>
                ))}
              </ul>
            )}
          </section>
        </aside>

        {/* Bottom centre: the mic, what she hears, typing, quick replies. */}
        <div className="talk-dock-wrap">
          <section className="glass glass-blur talk-dock" aria-label="Your answer">
            {error ? (
              <div className="talk-error" role="alert">
                <strong>{error}</strong> <span>Try Chrome, or type below.</span>
              </div>
            ) : !canListen ? (
              <div className="talk-error soft">
                <strong>{UNSUPPORTED}</strong> <span>Try Chrome, or type below.</span>
              </div>
            ) : null}

            <div className="talk-dock-main">
              <div className="talk-mic-col">
                <button type="button" className={`talk-mic ${micState}`} onClick={toggleMic} aria-label={micLabel}>
                  <span className="talk-mic-ring" aria-hidden="true" />
                  {micState === "speaking" ? (
                    <svg viewBox="0 0 24 24" width="30" height="30" fill="currentColor" aria-hidden="true">
                      <rect x="6" y="6" width="12" height="12" rx="2.5" />
                    </svg>
                  ) : micState === "thinking" ? (
                    <span className="dots" aria-hidden="true">
                      <i />
                      <i />
                      <i />
                    </span>
                  ) : (
                    <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <rect x="9" y="3" width="6" height="11" rx="3" />
                      <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3" />
                    </svg>
                  )}
                </button>
                <span className="talk-mic-label" aria-live="polite">
                  {micLabel}
                </span>
              </div>

              <div className="talk-dock-side">
                <div className="talk-heard-row">
                  <p className={`talk-interim${interim ? " live" : ""}`}>{listening ? interim || "Go ahead, I'm listening…" : pending ? "Working on it…" : ""}</p>
                  <Waveform level={level} live={listening} />
                </div>

                {quick.length > 0 && !listening && !pending && (
                  <div className="talk-chips" role="group" aria-label="Quick replies">
                    {quick.map((r) => (
                      <button key={r} type="button" className="chip" onClick={() => tapChip(r)}>
                        {r}
                      </button>
                    ))}
                  </div>
                )}

                <form
                  className="talk-type"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void send(typed);
                  }}
                >
                  <input
                    type="text"
                    value={typed}
                    onChange={(e) => setTyped(e.target.value)}
                    placeholder="Type to your twin…"
                    aria-label="Type to your twin"
                    autoComplete="off"
                  />
                  <button type="submit" className="btn-primary btn-small" disabled={!typed.trim()}>
                    Send
                  </button>
                </form>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
