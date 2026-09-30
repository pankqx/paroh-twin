"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { approveFact, editFact, rejectFact } from "@/app/factActions";
import { dataService } from "@/app/dataService";
import Doodle from "@/components/Doodle/Doodle";
import FactCard from "@/components/FactCard/FactCard";
import { notifyFactsChanged } from "@/components/shell/events";
import { setVoiceEnabled, useVoicePref } from "@/components/shell/useVoicePref";
import TwinFace, { type FaceState } from "@/components/TwinFace/TwinFace";
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
  { id: "twin-question-routines", text: "When do you usually focus best?", domain: "routines", quickReplies: ["Morning", "Afternoon", "Evening"] },
  { id: "twin-question-goals", text: "Which goal matters most to you this week?", domain: "goals", quickReplies: ["Exam preparation", "Project", "Steady routine"] },
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

const CONFIRMATIONS = ["Got it. I'll remember that.", "Noted. Thank you.", "That helps. Thank you."];

type Step = "start" | "ask" | "listening" | "thinking" | "review" | "done";

const noopSubscribe = () => () => {};

export default function TalkStage() {
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [qi, setQi] = useState(0);
  const [step, setStep] = useState<Step>("start");
  const [line, setLine] = useState(""); // what she is saying (also the caption)
  const [sentence, setSentence] = useState(""); // the sentence being spoken right now
  const [speaking, setSpeaking] = useState(false);
  const [heard, setHeard] = useState(""); // live transcript while listening
  const [typed, setTyped] = useState("");
  const [level, setLevel] = useState(0);
  const [cards, setCards] = useState<Array<{ fact: Fact; said: string }>>([]);
  const [notice, setNotice] = useState("");
  const [voiceOn] = useVoicePref();

  const canDictate = useSyncExternalStore(noopSubscribe, listen.isSupported, () => false);
  const canSpeak = useSyncExternalStore(noopSubscribe, speech.isSupported, () => false);

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

  // Speech synthesis state, and the live microphone result and level.
  useEffect(() => {
    const offSpeak = speech.subscribe((s) => {
      setSpeaking(s.isSpeaking);
      setSentence(s.currentSentence);
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
    setNotice("");

    const consent = await dataService.getConsent();
    if (!consent.journal) {
      setStep("ask");
      say("Journal is switched off, so I can't keep answers. You can change that in Sources.");
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
      setNotice("I couldn't turn that into a fact. A full sentence works best, like “I work best in the morning.”");
      say("I couldn't turn that into something to remember. Try a full sentence.");
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
    approved.current += 1;
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

  const faceState: FaceState = step === "listening" ? "listening" : step === "thinking" ? "thinking" : speaking ? "speaking" : "idle";
  const q = questions?.[qi];

  // Highlight the sentence she is saying right now inside the caption.
  const caption = (() => {
    if (!line) return null;
    const at = sentence ? line.indexOf(sentence) : -1;
    if (at < 0) return line;
    return (
      <>
        {line.slice(0, at)}
        <mark>{sentence}</mark>
        {line.slice(at + sentence.length)}
      </>
    );
  })();

  return (
    <main className="talk">
      <div className="talk-face">
        <TwinFace state={faceState} level={level} />
      </div>

      <AnimatePresence>
        {step === "review" && cards.length > 0 && (
          <motion.aside
            className="talk-cards"
            aria-label="Facts to approve"
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: [0.2, 0.7, 0.2, 1] }}
          >
            {cards.map(({ fact, said }) => (
              <FactCard
                key={fact.id}
                fact={fact}
                quote={said}
                onApprove={() => approveFact(fact)}
                onReject={() => rejectFact(fact)}
                onEdit={(text) => editFact(fact, text)}
                onArrive={arrived}
                onDone={() => dismissCard(fact.id)}
              />
            ))}
          </motion.aside>
        )}
      </AnimatePresence>

      <section className="glass talk-dock" aria-live="polite">
        {step === "start" ? (
          <div className="talk-start">
            <h1>Talk to your twin</h1>
            <p>
              She asks a few short questions. Answer by voice, a tap, or typing. Nothing joins her
              memory until you approve it.
            </p>
            <div className="talk-start-row">
              <button type="button" className="btn-primary" onClick={start} disabled={!questions}>
                Start talking
              </button>
              <Doodle text="tap to talk" arrow="up-left" tone="teal" className="talk-doodle" />
            </div>
            <p className="talk-fine">
              {canSpeak ? "She speaks aloud once you start. " : "This browser can't speak aloud, so you get captions only. "}
              Voice input uses your browser&rsquo;s speech service; Paroh never records or stores audio.
            </p>
          </div>
        ) : (
          <>
            <p className="talk-caption">{caption}</p>

            {step === "listening" && (
              <p className="talk-heard">{heard || "Go ahead, I'm listening…"}</p>
            )}
            {step === "thinking" && <p className="talk-heard">Reading “{heard}”…</p>}
            {notice && <p className="talk-notice">{notice}</p>}

            {(step === "ask" || step === "listening") && q && (
              <>
                <div className="talk-chips" role="group" aria-label="Quick replies">
                  {q.quickReplies.map((r) => (
                    <button key={r} type="button" className="chip" onClick={() => submit(r, true)} disabled={step === "listening"}>
                      {r}
                    </button>
                  ))}
                </div>
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
                    disabled={step === "listening"}
                  />
                  <button type="submit" className="btn-ghost btn-small" disabled={!typed.trim() || step === "listening"}>
                    Send
                  </button>
                  {canDictate && (
                    <button type="button" className={`btn-ghost btn-small talk-dictate ${step === "listening" ? "on" : ""}`} onClick={dictate}>
                      {step === "listening" ? "Stop dictating" : "Dictate"}
                    </button>
                  )}
                </form>
              </>
            )}

            {step === "done" && (
              <div className="talk-done">
                <Link href="/" className="btn-primary">
                  See your twin
                </Link>
                <button type="button" className="btn-ghost" onClick={() => questions && ask(0, questions)}>
                  Talk again
                </button>
              </div>
            )}

            <div className="talk-foot">
              <button type="button" className="talk-stop" onClick={stopAll}>
                <span aria-hidden="true" /> Stop
              </button>
              <span className="talk-voice">{voiceOn ? "voice on" : "voice off, captions only"}</span>
              <span className="talk-progress num">
                {questions ? `${Math.min(qi + 1, questions.length)} / ${questions.length}` : ""}
              </span>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
