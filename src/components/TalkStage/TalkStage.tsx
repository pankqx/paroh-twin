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
import VoiceButton from "@/components/VoiceButton/VoiceButton";
import { chime } from "@/components/VoiceButton/chime";
import TwinAvatar, { type AvatarState, type TwinAvatarHandle } from "@/components/TwinAvatar/TwinAvatar";
import { onAction, usePrefs } from "@/components/TwinAvatar/avatarStore";
import Gauges from "@/components/TwinStage/Gauges";
import "@/components/TwinAvatar/TwinAvatar.css";
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
  // "guided" = she asks short questions; "free" = you talk freely, like a voice journal.
  const [mode, setMode] = useState<"guided" | "free">("guided");
  const freeNext = useRef(""); // what she asks next in free talk
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
  const interimRef = useRef(""); // the phrase being spoken right now
  const partsRef = useRef<string[]>([]); // finished phrases in this listening turn
  const handledRef = useRef(false); // this listening turn is already submitted or stopped

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
    // Continuous dictation: keep every finished phrase until you stop; show the live words.
    const offResult = listen.onResult(({ transcript, isFinal }) => {
      if (isFinal) {
        partsRef.current.push(transcript);
        interimRef.current = "";
      } else {
        interimRef.current = transcript;
      }
      setHeard([...partsRef.current, interimRef.current].join(" ").trim());
    });
    const offEnd = listen.onEnd(() => {
      setLevel(0);
      // Ended by the browser (not by you): use whatever was heard.
      const pending = [...partsRef.current, interimRef.current].join(" ").trim();
      partsRef.current = [];
      interimRef.current = "";
      if (!handledRef.current && pending) {
        handledRef.current = true;
        submitRef.current(pending, false);
        return;
      }
      setStep((s) => (s === "listening" ? "ask" : s));
    });
    const offError = listen.onError((_code, message) => {
      setNotice(`${message} You can type your answer below.`);
      setLine("Sorry, I couldn't hear that.");
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
      offError();
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
    faceRef.current?.react("wave", 2400); // hello
    if (mode === "free") {
      setCards([]);
      setNotice("");
      setStep("ask");
      say("I'm all ears. Tell me about your day, a plan, or anything on your mind. Press Space or tap the mic when you're done.");
      return;
    }
    ask(0, questions);
  }

  /** Free talk: save it like a journal entry, find what is worth remembering, and reply naturally. */
  async function submitFree(answer: string) {
    speech.stop();
    listen.stop();
    setStep("thinking");
    setHeard(answer);
    setNotice("");
    setHistory((h) => [...h.slice(-19), { who: "you" as const, text: answer }]);
    const consent = await dataService.getConsent();
    if (!consent.journal) {
      setStep("ask");
      say("Journal sharing is switched off, so I can listen but not keep anything. You can turn it on in Sources.");
      return;
    }
    const now = new Date().toISOString();
    const id = `voice-journal-${Date.now()}`;
    // Only the words are kept, as a journal entry. No audio is recorded or stored.
    await dataService.entries.upsert({ id, title: answer.split(/\s+/).slice(0, 6).join(" "), body: answer, tags: ["voice"], createdAt: now, updatedAt: now });
    const [facts, talk] = await Promise.all([
      dataService.extractFacts({ text: answer, source: "journal", sourceId: id }),
      dataService.converse({ utterance: answer, history: history.slice(-8).map((m) => ({ role: m.who === "you" ? ("user" as const) : ("twin" as const), text: m.text })) }).catch(() => null),
    ]);
    notifyFactsChanged();
    const next = (await dataService.nextQuestions().catch(() => []))[0]?.text ?? "What else is on your mind?";
    freeNext.current = talk?.followUp?.text ?? next;
    const natural = talk && !talk.degraded && talk.reply ? talk.reply : "Thanks for telling me.";
    if (talk?.intent === "whatif") setNotice("That sounds like a decision. Open Ask to compare both paths with your real numbers.");
    if (facts.length) {
      approved.current = 0;
      setCards(facts.map((fact) => ({ fact, said: `From what you said: “${answer.length > 90 ? `${answer.slice(0, 88)}…` : answer}”` })));
      setStep("review");
      say(`${natural} I noted ${facts.length === 1 ? "one thing" : `${facts.length} things`} worth remembering. Approve what's right.`);
    } else {
      setStep("ask");
      say(`${natural} ${freeNext.current}`);
    }
  }

  async function submit(raw: string, tapped: boolean) {
    if (!questions) return;
    const answer = raw.trim();
    if (!answer) return;
    handledRef.current = true;
    interimRef.current = "";
    if (mode === "free") {
      await submitFree(answer);
      return;
    }
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
    let facts = await dataService.extractFacts({
      text,
      source: "question",
      sourceId: `${q.id}-${Date.now()}`, // unique, so a repeat answer never overwrites an earlier fact
    });
    // Spoken answers are often short ("evening") or unpunctuated: retry as a full statement for
    // this question, then as a plain preference. It is still only a candidate you approve or edit.
    const short = answer.split(/\s+/).length <= 4 && q.quickReplies.length > 0;
    const tries = [short ? STATEMENT[q.domain]?.(answer.replace(/[.?!]+$/, "")) : undefined, `I prefer ${answer.replace(/^i\s+/i, "").replace(/[.?!]+$/, "")}.`];
    for (const retry of tries) {
      if (facts.length > 0 || !retry || retry === text) continue;
      facts = await dataService.extractFacts({ text: retry, source: "question", sourceId: `${q.id}-${Date.now()}-r` });
    }
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
    if (mode === "free") {
      window.setTimeout(() => {
        setStep("ask");
        say(freeNext.current || "What else is on your mind?");
      }, 900);
      return;
    }
    if (qi + 1 < questions.length) {
      window.setTimeout(() => ask(qi + 1, questions), 900);
    } else {
      setStep("done");
      say("That is enough for now. Thank you.");
      faceRef.current?.react("dance", 3200);
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

  /** Stop listening and send everything heard so far. */
  function finishListening() {
    const text = [...partsRef.current, interimRef.current].join(" ").trim();
    handledRef.current = true;
    partsRef.current = [];
    interimRef.current = "";
    listen.stop();
    chime("stop");
    setLevel(0);
    if (text) submit(text, false);
    else {
      setStep("ask");
      setNotice("I didn't catch anything. Try again, or type your answer.");
    }
  }

  function dictate() {
    if (step === "listening") {
      finishListening();
      return;
    }
    // Tapping while she talks interrupts her and starts listening straight away.
    speech.stop();
    // A recognition left hanging by the browser would block a new start: clear it first.
    if (listen.getState() === "listening") listen.stop();
    setHeard("");
    setNotice("");
    handledRef.current = false;
    interimRef.current = "";
    partsRef.current = [];
    if (listen.start({ measureLevel: true, continuous: true })) {
      chime("start");
      setStep("listening");
      setLine("Yes? I'm listening. Tap again or press Space when you're done.");
      faceRef.current?.react("nod", 700);
    } else {
      setNotice("Dictation isn't available here. Type your answer instead.");
    }
  }

  // Space starts and stops listening (when you are not typing); Esc stops everything.
  const dictateRef = useRef(dictate);
  const stopRef = useRef<() => void>(() => {});
  useEffect(() => {
    dictateRef.current = dictate;
    stopRef.current = stopAll;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      if (e.code === "Space" && !e.repeat) {
        e.preventDefault();
        dictateRef.current();
      } else if (e.key === "Escape") {
        stopRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function stopAll() {
    if (step === "listening" || speaking) chime("stop");
    handledRef.current = true;
    interimRef.current = "";
    partsRef.current = [];
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
  useEffect(() => {
    if (step !== "start" && step !== "ask" && step !== "done") return;
    const id = window.setInterval(() => {
      if (typeof window !== "undefined" && window.speechSynthesis?.speaking) return;
      faceRef.current?.react(step === "ask" ? "nod" : "wave", step === "ask" ? 900 : 2000);
    }, step === "ask" ? 9000 : 7000);
    return () => window.clearInterval(id);
  }, [step]);

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
  const asking = step === "ask" || listening || step === "thinking";

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
                drawn
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
              <div className="talk-mode" role="radiogroup" aria-label="How do you want to talk?">
                <button type="button" role="radio" aria-checked={mode === "guided"} className={mode === "guided" ? "on" : ""} onClick={() => setMode("guided")}>
                  Guided questions
                </button>
                <button type="button" role="radio" aria-checked={mode === "free"} className={mode === "free" ? "on" : ""} onClick={() => setMode("free")}>
                  Free talk · voice journal
                </button>
              </div>
              <p>
                {mode === "guided"
                  ? "She asks a few short questions. Answer by voice or typing."
                  : "Talk naturally for as long as you like, like a voice journal. She saves your words as a journal entry, replies, and picks out what is worth remembering."}{" "}
                Nothing joins her memory until you approve it.
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
                style={mode === "free" ? { display: "none" } : undefined}
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

              <p className="talk-eyebrow">{mode === "free" ? "Free talk · voice journal" : q ? q.domain : "Check-in"}</p>
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
                <button
                  type="button"
                  className="btn-text talk-switch"
                  onClick={() => {
                    stopAll();
                    setMode(mode === "free" ? "guided" : "free");
                    setStep("start");
                  }}
                >
                  {mode === "free" ? "Switch to guided questions" : "Switch to free talk"}
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
          <Gauges />
        </aside>

        {/* Bottom centre: quick replies, dictate, live waveform, typing. */}
        <div className="talk-dock-wrap">
          <AnimatePresence>
            {asking && (q || mode === "free") && (
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
                    <VoiceButton
                      state={listening ? "listening" : step === "thinking" ? "busy" : speaking ? "speaking" : "idle"}
                      level={level}
                      onClick={dictate}
                    />
                  )}
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
