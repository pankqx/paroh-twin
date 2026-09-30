"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { approveFact, editFact, rejectFact } from "@/app/factActions";
import { dataService } from "@/app/dataService";
import Doodle from "@/components/Doodle/Doodle";
import FactCard from "@/components/FactCard/FactCard";
import { notifyFactsChanged } from "@/components/shell/events";
import { setVoiceEnabled, useVoicePref } from "@/components/shell/useVoicePref";
import { ViewTransition } from "react";
import TwinAvatar, { type AvatarState, type TwinAvatarHandle } from "@/components/TwinAvatar/TwinAvatar";
import { onAction, usePrefs } from "@/components/TwinAvatar/avatarStore";
import ChooseTwin from "@/components/TwinStage/ChooseTwin";
import Gauges from "@/components/TwinStage/Gauges";
import "@/components/TwinAvatar/TwinAvatar.css";
import Waveform from "@/components/Waveform/Waveform";
import Karaoke from "./Karaoke";
import Aurora from "@/components/fx/Aurora";
import { mindTarget } from "@/components/TwinAvatar/mindPoint";
import { useMorphEnd, useTypedWords } from "./useMorphEnd";
import * as listen from "@/lib/voice/listen";
import * as speech from "@/lib/voice/speak";
import type { Fact } from "@/lib/types";
import "./TalkStage.css";

interface Question {
  id: string;
  text: string;
  domain: string;
  quickReplies: string[];
}

// Used only if the engine returns no questions (nothing to ask, or it is unavailable).
// TODO: drop once nextQuestions() is always populated.
const FALLBACK: Question[] = [
  {
    id: "twin-question-routines",
    text: "When do you usually focus best?",
    domain: "routines",
    quickReplies: ["Morning", "Afternoon", "Evening"],
  },
  {
    id: "twin-question-goals",
    text: "Which goal matters most to you this week?",
    domain: "goals",
    quickReplies: ["Exam preparation", "Project", "Steady routine"],
  },
];

// A tapped reply becomes a first-person sentence, so the extractor can read it like a
// journal line. The card shows exactly that sentence; you approve or change it.
const STATEMENT: Record<string, (a: string) => string> = {
  tasks: (a) => `I will work on ${a.toLowerCase()} this week.`,
  habits: (a) => `I want to keep my ${a.toLowerCase()} habit.`,
  routines: (a) => `I work best in the ${a.toLowerCase()}.`,
  energy: (a) => `I work best in the ${a.toLowerCase()}.`,
  goals: (a) => `My goal this week is ${a.toLowerCase()}.`,
  planner: (a) => `I can study for ${a.toLowerCase()} tomorrow.`,
};

const CONFIRMATIONS = [
  "Got it. I'll remember that.",
  "Noted. Thank you.",
  "That helps. Thank you.",
];

type Step = "start" | "ask" | "listening" | "thinking" | "review" | "done";

const noopSubscribe = () => () => {};

const PARTICLES = Array.from({ length: 26 }, (_, i) => {
  const s = (i * 9301 + 49297) % 233280;
  const u = (i * 7411 + 12345) % 233280;
  return { x: 3 + (s / 233280) * 94, y: 5 + (u / 233280) * 90, s: 2 + (i % 3), d: 14 + (i % 7) * 3, l: -(i * 1.3), dx: (i % 2 ? 1 : -1) * (12 + (i % 5) * 7), dy: -(20 + (i % 4) * 12) };
});

export default function TalkStage() {
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [qi, setQi] = useState(0);
  const [step, setStep] = useState<Step>("start");
  const [line, setLine] = useState(""); // what she is saying (also the caption)
  const [sentence, setSentence] = useState(""); // the sentence being spoken right now
  const [speaking, setSpeaking] = useState(false);
  const [mouth, setMouth] = useState<0 | 1 | 2 | 3>(0);
  const [learned, setLearned] = useState<string[]>([]); // facts approved today
  const [heard, setHeard] = useState(""); // live transcript while listening
  const [typed, setTyped] = useState("");
  const [level, setLevel] = useState(0);
  const [cards, setCards] = useState<Array<{ fact: Fact; said: string }>>([]);
  const [notice, setNotice] = useState("");
  const [history, setHistory] = useState<Array<{ who: "twin" | "you"; text: string }>>([]);
  const histRef = useRef<HTMLOListElement>(null);
  const [voiceOn] = useVoicePref();

  const canDictate = useSyncExternalStore(
    noopSubscribe,
    listen.isSupported,
    () => false,
  );
  const canSpeak = useSyncExternalStore(
    noopSubscribe,
    speech.isSupported,
    () => false,
  );

  const approved = useRef(0); // approvals in this round
  const confirmIdx = useRef(0);
  const lastLevel = useRef(0);
  const submitRef = useRef<(raw: string, tapped: boolean) => void>(() => {});

  // Questions come from the engine, lowest-confidence domain first.
  useEffect(() => {
    let live = true;
    dataService
      .nextQuestions()
      .then((q) => live && setQuestions(q.length ? q : FALLBACK))
      .catch(() => live && setQuestions(FALLBACK));
    return () => {
      live = false;
    };
  }, []);

  // "Learned today": facts approved today, newest first.
  const refreshLearned = useCallback(() => {
    const today = new Date().toDateString();
    dataService.facts
      .list()
      .then((list) =>
        setLearned(
          list
            .filter(
              (f) =>
                f.status === "approved" &&
                new Date(f.updatedAt).toDateString() === today,
            )
            .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
            .map((f) => f.text),
        ),
      )
      .catch(() => {});
  }, []);
  useEffect(() => {
    refreshLearned();
  }, [refreshLearned]);

  // Speech synthesis state, and the live microphone result and level.
  useEffect(() => {
    const offSpeak = speech.subscribe((s) => {
      setSpeaking(s.isSpeaking);
      setSentence(s.currentSentence);
      setMouth(s.mouth);
    });
    const offResult = listen.onResult(({ transcript, isFinal }) => {
      setHeard(transcript);
      if (isFinal) {
        listen.stop();
        setLevel(0);
        submitRef.current(transcript, false);
      }
    });
    const offEnd = listen.onEnd(() => {
      setLevel(0);
      setStep((s) => (s === "listening" ? "ask" : s));
    });
    const offLevel = listen.onLevel((l) => {
      const now = performance.now();
      if (now - lastLevel.current > 50) {
        lastLevel.current = now;
        setLevel(l);
      }
    });
    return () => {
      offSpeak();
      offResult();
      offEnd();
      offLevel();
      listen.stop();
      speech.stop();
    };
  }, []);

  const say = useCallback((text: string) => {
    setLine(text);
    setHistory((h) => [...h.slice(-19), { who: "twin" as const, text }]);
    speech.speak(text);
  }, []);

  const ask = useCallback(
    (i: number, list: Question[]) => {
      setQi(i);
      setCards([]);
      setNotice("");
      setHeard("");
      setTyped("");
      approved.current = 0;
      setStep("ask");
      say(list[i].text);
    },
    [say],
  );

  function start() {
    if (!questions) return;
    // A click is the gesture that lets her speak. Captions always show either way.
    setVoiceEnabled(true);
    ask(0, questions);
  }

  async function submit(raw: string, tapped: boolean) {
    if (!questions) return;
    const answer = raw.trim();
    if (!answer) return;
    const q = questions[qi];
    speech.stop();
    listen.stop();
    setStep("thinking");
    setHeard(answer);
    setHistory((h) => [...h.slice(-19), { who: "you" as const, text: answer }]);
    setNotice("");

    const consent = await dataService.getConsent();
    if (!consent.journal) {
      setStep("ask");
      say(
        "Journal is switched off, so I can't keep answers. You can change that in Sources.",
      );
      return;
    }

    const text = tapped ? (STATEMENT[q.domain]?.(answer) ?? answer) : answer;
    const facts = await dataService.extractFacts({
      text,
      source: "question",
      sourceId: `${q.id}-${Date.now()}`, // unique, so a repeat answer never overwrites an earlier fact
    });
    notifyFactsChanged();

    if (facts.length === 0) {
      setStep("ask");
      setNotice(
        "I couldn't turn that into a fact. A full sentence works best, like “I work best in the morning.”",
      );
      say(
        "I couldn't turn that into something to remember. Try a full sentence.",
      );
      return;
    }
    approved.current = 0;
    setCards(facts.map((fact) => ({ fact, said: `You said: “${answer}”` })));
    setStep("review");
    say("Here is what I understood. Approve what is right.");
  }
  useEffect(() => {
    submitRef.current = submit;
  });

  function afterRound() {
    if (!questions) return;
    if (qi + 1 < questions.length) {
      window.setTimeout(() => ask(qi + 1, questions), 900);
    } else {
      setStep("done");
      say("That is enough for now. Thank you.");
    }
  }

  function dismissCard(id: string) {
    setCards((list) => {
      const next = list.filter((c) => c.fact.id !== id);
      if (next.length === 0) afterRound();
      return next;
    });
  }

  function arrived() {
    const p = mindTarget()?.point();
    if (p && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setBurst({ x: p.x, y: p.y, key: Date.now() });
      window.setTimeout(() => setBurst(null), 900);
    }
    approved.current += 1;
    refreshLearned();
    speech.speak(CONFIRMATIONS[confirmIdx.current++ % CONFIRMATIONS.length]);
  }

  function dictate() {
    if (step === "listening") {
      listen.stop();
      setLevel(0);
      setStep("ask");
      return;
    }
    speech.stop();
    setHeard("");
    setNotice("");
    if (listen.start({ measureLevel: true })) {
      setStep("listening");
      setLine("I'm listening.");
    } else {
      setNotice("Dictation isn't available here. Tap a reply or type instead.");
    }
  }

  function stopAll() {
    speech.stop();
    listen.stop();
    setLevel(0);
    setHeard("");
    if (step === "listening" || step === "thinking") setStep("ask");
  }

  const faceState: AvatarState =
    step === "listening"
      ? "listening"
      : step === "thinking"
        ? "thinking"
        : speaking
          ? "speaking"
          : "idle";
  const q = questions?.[qi];

  const prefs = usePrefs();
  const faceRef = useRef<TwinAvatarHandle>(null);
  useEffect(() => onAction((a) => faceRef.current?.react(a)), []);

  // Everything waits for the Home to Talk morph: the colour bloom starts when it ends, then
  // the panels fade in 300 ms later, 80 ms apart.
  const ready = useMorphEnd();
  const bloom = ready;
  const typedLine = useTypedWords(line);
  const [burst, setBurst] = useState<{ x: number; y: number; key: number } | null>(null);
  const glow = speaking ? 0.35 + (mouth / 3) * 0.65 : step === "listening" ? Math.min(1, level * 1.6) : 0;

  useEffect(() => {
    histRef.current?.scrollTo({ top: histRef.current.scrollHeight, behavior: "smooth" });
  }, [history.length]);
  // Everything said before the line she is on right now (that one is shown large).
  const past = history.length && history[history.length - 1].who === "twin" ? history.slice(0, -1) : history;

  const listening = step === "listening";
  const asking = step === "ask" || listening;

  return (
    <main className={`talk${ready ? " ready" : ""}`}>
      <Aurora amplitude={0.7} speed={0.6} />
      <div className="talk-particles" aria-hidden="true">
        {PARTICLES.map((p, i) => (
          <span key={i} style={{ left: `${p.x}%`, top: `${p.y}%`, width: p.s, height: p.s, animationDuration: `${p.d}s`, animationDelay: `${p.l}s`, ["--dx" as string]: `${p.dx}px`, ["--dy" as string]: `${p.dy}px` }} />
        ))}
      </div>
      <div className="talk-stage">
        <div className="talk-face">
          <div className="talk-glow" aria-hidden="true" style={{ transform: `translateX(-50%) scale(${0.8 + glow * 0.5})`, opacity: 0.25 + glow * 0.55 }} />
          <ViewTransition name="twin" share="morph" default="none">
            <div className="twin-morph">
              <TwinAvatar
                ref={faceRef}
                style={prefs}
                state={faceState}
                level={level}
                mouth={speaking ? mouth : undefined}
                form={bloom ? 1 : 0}
              />
            </div>
          </ViewTransition>
        </div>

        {/* Left: her question, big, with the word being spoken lit. */}
        <section className="talk-left" aria-live="polite">
          {past.length > 0 && (
            <ol className="talk-history" ref={histRef} aria-label="Conversation so far">
              {past.map((m, i) => (
                <motion.li key={i} className={m.who} initial={{ opacity: 0, x: m.who === "you" ? 24 : -24 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.45, ease: [0.2, 0.7, 0.2, 1] }}>
                  <span>{m.who === "twin" ? "Twin" : "You"}</span>
                  {m.text}
                </motion.li>
              ))}
            </ol>
          )}
          {step === "start" ? (
            <div className="talk-start">
              <p className="talk-eyebrow">Voice check-in</p>
              <h1>Talk to your twin</h1>
              <p>
                She asks a few short questions. Answer by voice, a tap, or
                typing. Nothing joins her memory until you approve it.
              </p>
              <div className="talk-start-row">
                <button
                  type="button"
                  className="btn-primary"
                  onClick={start}
                  disabled={!questions}
                >
                  Start talking
                </button>
                <Doodle
                  text="tap to talk"
                  arrow="up-left"
                  tone="teal"
                  className="talk-doodle"
                />
              </div>
              <p className="talk-fine">
                {canSpeak
                  ? "She speaks aloud once you start. "
                  : "This browser can't speak aloud, so you get captions only. "}
                Voice input uses your browser&rsquo;s speech service; Paroh
                never records or stores audio.
              </p>
            </div>
          ) : (
            <>
              <div
                className="talk-steps"
                role="img"
                aria-label={
                  questions
                    ? `Question ${Math.min(qi + 1, questions.length)} of ${questions.length}`
                    : "Questions"
                }
              >
                {(questions ?? []).map((_, i) => (
                  <span
                    key={i}
                    className={
                      i < qi || (i === qi && step === "done")
                        ? "done"
                        : i === qi
                          ? "now"
                          : ""
                    }
                  />
                ))}
                <span className="talk-steps-num num">
                  {questions
                    ? `${Math.min(qi + 1, questions.length)} / ${questions.length}`
                    : ""}
                </span>
              </div>

              <p className="talk-eyebrow">{q ? q.domain : "Check-in"}</p>
              <p className="talk-caption">
                <Karaoke line={typedLine} sentence={sentence} speaking={speaking} />
              </p>

              {listening && (
                <p className="talk-heard">
                  {heard || "Go ahead, I'm listening…"}
                </p>
              )}
              {step === "thinking" && (
                <p className="talk-heard">Reading “{heard}”…</p>
              )}
              {notice && <p className="talk-notice">{notice}</p>}

              {step === "done" && (
                <div className="talk-done">
                  <Link href="/" className="btn-primary">
                    See your twin
                  </Link>
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => questions && ask(0, questions)}
                  >
                    Talk again
                  </button>
                </div>
              )}

              <div className="talk-foot">
                <button type="button" className="talk-stop" onClick={stopAll}>
                  <span aria-hidden="true" /> Stop
                </button>
                <span className="talk-voice">
                  {voiceOn ? "voice on" : "voice off, captions only"}
                </span>
              </div>
            </>
          )}
        </section>

        {/* Right: candidate facts to approve, and what she learned today. */}
        <aside className="talk-right">
          <AnimatePresence>
            {step === "review" && cards.length > 0 && (
              <motion.div
                className="talk-cards"
                aria-label="Facts to approve"
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5, ease: [0.2, 0.7, 0.2, 1] }}
              >
                {cards.map(({ fact, said }) => (
                  <motion.div key={fact.id} initial={{ opacity: 0, scale: 0.88, y: 24 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ type: "spring", stiffness: 300, damping: 13, mass: 0.9 }}>
                  <FactCard
                    fact={fact}
                    quote={said}
                    onApprove={() => approveFact(fact)}
                    onReject={() => rejectFact(fact)}
                    onEdit={(text) => editFact(fact, text)}
                    onArrive={arrived}
                    onDone={() => dismissCard(fact.id)}
                  />
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          <section
            className="glass talk-learned"
            aria-label="Learned today"
            style={{ ["--glass-accent" as string]: "var(--green)" }}
          >
            <header>
              <h2>Learned today</h2>
              <span className="talk-learned-count num">{learned.length}</span>
            </header>
            {learned.length === 0 ? (
              <p className="talk-learned-empty">
                Nothing yet. Approve a card and it lands here.
              </p>
            ) : (
              <ul>
                {learned.slice(0, 5).map((t, i) => (
                  <li key={`${i}-${t}`}>{t}</li>
                ))}
              </ul>
            )}
          </section>
          <ChooseTwin />
          <Gauges />
        </aside>

        {/* Bottom centre: quick replies, dictate, live waveform, typing. */}
        <div className="talk-dock-wrap">
          <AnimatePresence>
            {asking && q && (
              <motion.section
                className="glass glass-blur talk-dock"
                aria-label="Your answer"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.4, ease: [0.2, 0.7, 0.2, 1] }}
              >
                <div className={`talk-input-row${canDictate ? "" : " no-mic"}`}>
                  {canDictate && (
                    <button
                      type="button"
                      className={`talk-mic${listening ? " on" : ""}`}
                      onClick={dictate}
                      aria-pressed={listening}
                      aria-label={
                        listening ? "Stop dictating" : "Dictate your answer"
                      }
                    >
                      <svg
                        viewBox="0 0 24 24"
                        width="22"
                        height="22"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <rect x="9" y="3" width="6" height="11" rx="3" />
                        <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3" />
                      </svg>
                    </button>
                  )}
                  <Waveform level={level} live={listening} />
                  <form
                    className="talk-type"
                    onSubmit={(e) => {
                      e.preventDefault();
                      submit(typed, false);
                      setTyped("");
                    }}
                  >
                    <input
                      type="text"
                      value={typed}
                      onChange={(e) => setTyped(e.target.value)}
                      placeholder="or type a sentence…"
                      aria-label="Type your answer"
                      disabled={listening}
                    />
                    <button
                      type="submit"
                      className="btn-ghost btn-small"
                      disabled={!typed.trim() || listening}
                    >
                      Send
                    </button>
                  </form>
                </div>
              </motion.section>
            )}
          </AnimatePresence>
        </div>
      </div>
      {burst && (
        <div className="talk-burst" style={{ left: burst.x, top: burst.y }} aria-hidden="true">
          {Array.from({ length: 12 }, (_, i) => {
            const a = (i / 12) * Math.PI * 2;
            const r = 46 + (i % 3) * 14;
            return <motion.i key={`${burst.key}-${i}`} initial={{ x: 0, y: 0, opacity: 1, scale: 1 }} animate={{ x: Math.cos(a) * r, y: Math.sin(a) * r, opacity: 0, scale: 0.2 }} transition={{ duration: 0.75, ease: [0.2, 0.7, 0.2, 1] }} />;
          })}
        </div>
      )}
    </main>
  );
}
