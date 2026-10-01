"use client";

import VoiceButton from "@/components/VoiceButton/VoiceButton";
import { chime } from "@/components/VoiceButton/chime";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { dataService } from "@/app/dataService";
import type { FeedbackDelta } from "@/lib/twin/insights";
import type { FactConflict } from "@/lib/twin/memory";
import { predictChoice, recommend, recordChoice } from "@/lib/twin/scenarios";
import type { Decision, Fact, Scenario } from "@/lib/types";
import * as listen from "@/lib/voice/listen";
import * as speech from "@/lib/voice/speak";
import "./AskStage.css";

type Step = "idle" | "parsing" | "clarify" | "fork" | "answered";
const pct = (n: number) => `${Math.round(n * 100)}%`;
const EXAMPLES = ["What if I revise tonight and finish the assignment tomorrow?", "Should I study 3 hours or go to the gym?"];

export default function AskStage() {
  const [step, setStep] = useState<Step>("idle");
  const [prompt, setPrompt] = useState("");
  // A what-if handed over from Pulse (?q=...) is pre-filled, ready to send.
  const [typed, setTyped] = useState("");
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("q");
    if (q) setTyped(q); // eslint-disable-line react-hooks/set-state-in-effect
  }, []);
  const [clarify, setClarify] = useState("");
  const [chips, setChips] = useState<string[]>([]);
  const [degraded, setDegraded] = useState(false);
  const [decision, setDecision] = useState<Decision | null>(null);
  const [spoken, setSpoken] = useState("");
  const [caption, setCaption] = useState("");
  const [speaking, setSpeaking] = useState(false);
  const [listening, setListening] = useState(false);
  const [level, setLevel] = useState(0);
  const [heard, setHeard] = useState("");
  const [delta, setDelta] = useState<FeedbackDelta | null>(null);
  const [learned, setLearned] = useState<string[]>([]);
  const [conflicts, setConflicts] = useState<FactConflict[]>([]);
  const [stale, setStale] = useState<Fact[]>([]);
  const promptRef = useRef("");
  const submitRef = useRef<(text: string) => void>(() => {});
  const interimRef = useRef("");
  const handledRef = useRef(false);
  const canListen = typeof window !== "undefined" && listen.isSupported();

  const refreshMemory = useCallback(async () => {
    const [c, s] = await Promise.all([dataService.getConflicts(), dataService.getStale()]);
    setConflicts(c);
    setStale(s);
  }, []);

  useEffect(() => {
    refreshMemory();
    const offSpeak = speech.subscribe((s) => setSpeaking(s.isSpeaking));
    const offResult = listen.onResult(({ transcript, isFinal }) => {
      setHeard(transcript);
      interimRef.current = transcript;
      if (isFinal) {
        interimRef.current = "";
        handledRef.current = true;
        listen.stop();
        chime("stop");
        setListening(false);
        submitRef.current(transcript);
      }
    });
    const offLevel = listen.onLevel(setLevel);
    const offEnd = listen.onEnd(() => {
      setListening(false);
      setLevel(0);
      // Ended on a pause before a final result: use what was heard.
      const pending = interimRef.current.trim();
      interimRef.current = "";
      if (!handledRef.current && pending) {
        handledRef.current = true;
        submitRef.current(pending);
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
  }, [refreshMemory]);

  const say = useCallback((text: string) => {
    setCaption(text);
    speech.speak(text);
  }, []);

  const run = useCallback(
    async (text: string) => {
      const q = text.trim();
      if (!q) return;
      promptRef.current = q;
      setPrompt(q);
      setStep("parsing");
      setDecision(null);
      setDelta(null);
      setLearned([]);
      speech.stop();
      const parsed = await dataService.parseWhatIf(q);
      setDegraded(parsed.degraded);
      if (parsed.clarify || parsed.scenarios.length < 2) {
        const question = parsed.clarify ?? "Which two options should I compare, and how long for each?";
        const tasks = (await dataService.tasks.list()).filter((t) => !t.done).slice(0, 2);
        setChips(tasks.length === 2 ? [`${tasks[0].title} first`, `${tasks[1].title} first`, "Split the time evenly"] : ["Study first", "Rest first", "Split the time evenly"]);
        setClarify(question);
        setStep("clarify");
        say(question);
        return;
      }
      const scenarios = await dataService.proposeScenarios(q);
      if (scenarios.length < 2) {
        setClarify("I couldn't turn that into two options. Which two should I compare?");
        setStep("clarify");
        return;
      }
      const past = await dataService.decisions.list();
      const now = new Date().toISOString();
      const d: Decision = {
        id: `decision-${Date.now()}`,
        createdAt: now,
        updatedAt: now,
        prompt: q,
        scenarios,
        recommendedId: recommend(scenarios)?.id ?? scenarios[0].id,
        predictedChoiceId: predictChoice(scenarios, past),
      };
      await dataService.decisions.upsert(d);
      setDecision(d);
      setStep("fork");
      const ex = await dataService.explain(d.id);
      setSpoken(ex.text);
      say(ex.spoken);
    },
    [say],
  );

  // A clarifying answer is appended to the original question and parsed again.
  const submit = useCallback(
    (text: string) => {
      const t = text.trim();
      if (!t) return;
      setHeard("");
      setTyped("");
      run(step === "clarify" && promptRef.current ? `${promptRef.current}. ${t}` : t);
    },
    [run, step],
  );
  useEffect(() => {
    submitRef.current = submit;
  }, [submit]);

  const dictate = () => {
    if (listening) {
      handledRef.current = true;
      interimRef.current = "";
      listen.stop();
      chime("stop");
      setListening(false);
      return;
    }
    speech.stop();
    if (listen.getState() === "listening") listen.stop();
    handledRef.current = false;
    interimRef.current = "";
    setHeard("");
    if (listen.start({ measureLevel: true })) {
      chime("start");
      setListening(true);
    }
  };

  async function choose(kind: "accept" | "reject" | "modify", id?: string) {
    if (!decision) return;
    const all = await dataService.decisions.list();
    const chosen = kind === "accept" ? decision.recommendedId : id;
    const out = recordChoice(all, decision.id, kind, chosen);
    const updated = out.decisions.find((d) => d.id === decision.id);
    if (updated) {
      await dataService.decisions.upsert(updated);
      setDecision(updated);
    }
    setLearned(out.learned);
    setDelta(await dataService.feedbackDelta());
    setStep("answered");
    speech.stop();
  }

  async function keepFact(c: FactConflict, keep: Fact) {
    for (const f of c.facts) if (f.id !== keep.id) await dataService.setFactStatus?.(f.id, "edit", { data: { ...f.data, supersededBy: keep.id } });
    refreshMemory();
  }
  async function confirmFact(f: Fact) {
    await dataService.setFactStatus?.(f.id, "edit", { data: { ...f.data, lastConfirmedAt: new Date().toISOString() } });
    refreshMemory();
  }
  async function dropFact(f: Fact) {
    await dataService.setFactStatus?.(f.id, "reject");
    refreshMemory();
  }

  const rec = decision?.recommendedId;
  const showFork = decision && (step === "fork" || step === "answered");

  return (
    <main className="page ask">
      <header className="ask-head">
        <p className="ask-eyebrow">What-if</p>
        <h1>Ask your twin</h1>
        <p className="ask-lede">Two paths, with odds from your own history. An explainable estimate, not a prediction.</p>
      </header>

      {(conflicts.length > 0 || stale.length > 0) && (
        <section className="ask-memory" aria-label="Memory to check">
          {conflicts.map((c) => (
            <div key={`${c.kind}-${c.subject}`} className="ask-mchip conflict">
              <span>Two versions of “{c.subject}”. Keep:</span>
              {c.facts.map((f) => (
                <button key={f.id} type="button" className="chip" onClick={() => keepFact(c, f)} title={f.text}>
                  {f.text.length > 34 ? `${f.text.slice(0, 32)}…` : f.text}
                </button>
              ))}
            </div>
          ))}
          {stale.map((f) => (
            <div key={f.id} className="ask-mchip stale">
              <span>Still true? “{f.text.length > 40 ? `${f.text.slice(0, 38)}…` : f.text}”</span>
              <button type="button" className="chip" onClick={() => confirmFact(f)}>Yes</button>
              <button type="button" className="chip" onClick={() => dropFact(f)}>Not anymore</button>
            </div>
          ))}
        </section>
      )}

      <section className="glass ask-input" aria-label="Your what-if">
        {step === "clarify" && (
          <div className="ask-clarify" aria-live="polite">
            <p className="ask-q">{clarify}</p>
            <div className="ask-chips">
              {chips.map((c) => (
                <button key={c} type="button" className="chip" onClick={() => submit(c)}>{c}</button>
              ))}
            </div>
            <p className="ask-hint">Answer by voice, tap a chip, or type.</p>
          </div>
        )}
        <form
          className="ask-row"
          onSubmit={(e) => {
            e.preventDefault();
            submit(typed);
          }}
        >
          {canListen && (
<VoiceButton state={listening ? "listening" : speaking ? "speaking" : "idle"} level={level} onClick={dictate} size={52} />
          )}
          <input
            type="text"
            value={listening && heard ? heard : typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={step === "clarify" ? "Your answer…" : "What if I…"}
            aria-label={step === "clarify" ? "Your answer" : "Your what-if"}
            disabled={listening || step === "parsing"}
          />
          <button type="submit" className="btn-primary btn-small" disabled={!typed.trim() || step === "parsing"}>
            {step === "clarify" ? "Answer" : "Compare"}
          </button>
        </form>
        {step === "idle" && (
          <div className="ask-chips">
            {EXAMPLES.map((ex) => (
              <button key={ex} type="button" className="chip" onClick={() => submit(ex)}>{ex}</button>
            ))}
          </div>
        )}
        {step === "parsing" && <p className="ask-hint">Setting up the two paths…</p>}
      </section>

      <AnimatePresence>
        {showFork && decision && (
          <motion.section className="ask-fork" aria-label="Two paths" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.5, ease: [0.2, 0.7, 0.2, 1] }}>
            <div className="ask-prompt">{prompt}</div>
            <svg className="ask-forklines" viewBox="0 0 100 20" preserveAspectRatio="none" aria-hidden="true">
              <motion.path d="M50 0 V6 C50 12 25 10 25 20" fill="none" stroke="var(--teal)" strokeWidth="0.5" vectorEffect="non-scaling-stroke" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.9 }} />
              <motion.path d="M50 0 V6 C50 12 75 10 75 20" fill="none" stroke="var(--violet)" strokeWidth="0.5" vectorEffect="non-scaling-stroke" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.9 }} />
            </svg>
            <div className="ask-paths">
              {decision.scenarios.map((s: Scenario) => {
                const chosen = decision.chosenScenarioId === s.id;
                return (
                  <article key={s.id} className={`glass ask-path${s.id === rec ? " rec" : ""}${chosen ? " chosen" : ""}`}>
                    <header>
                      <h2>{s.label}</h2>
                      {s.id === rec && <span className="ask-badge">Suggested</span>}
                      {s.id === decision.predictedChoiceId && step === "answered" && <span className="ask-badge alt">She guessed this</span>}
                    </header>
                    <p className="ask-sum">{s.summary}</p>
                    <dl className="ask-stats">
                      <div><dt>On time</dt><dd className="num">{pct(s.onTimeProb)}</dd></div>
                      <div><dt>Peak load</dt><dd className="num">{pct(s.peakLoad)}</dd></div>
                      <div><dt>Goal fit</dt><dd className="num">{s.goalImpact >= 0 ? "+" : ""}{s.goalImpact.toFixed(1)}</dd></div>
                    </dl>
                    {step === "fork" && (
                      <button type="button" className="btn-ghost btn-small" onClick={() => choose("modify", s.id)}>
                        {s.id === rec ? "Pick this" : "Pick this instead"}
                      </button>
                    )}
                  </article>
                );
              })}
            </div>

            <div className="glass ask-say" aria-live="polite">
              <p className="ask-say-text">{spoken || caption}</p>
              <div className="ask-say-row">
                {speaking && (
                  <button type="button" className="btn-ghost btn-small" onClick={() => speech.stop()}>Stop</button>
                )}
                {step === "fork" && (
                  <>
                    <button type="button" className="btn-primary btn-small" onClick={() => choose("accept")}>Accept</button>
                    <button type="button" className="btn-ghost btn-small" onClick={() => choose("reject")}>Not for me</button>
                  </>
                )}
              </div>
              {degraded && <p className="ask-hint">Scenarios built from your saved tasks by Paroh's own rules; the numbers always come from the simulation.</p>}
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {step === "answered" && delta && (
        <motion.section className="glass ask-after" aria-label="After your feedback" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <h2>After your feedback</h2>
          {delta.answered === 0 ? (
            <p>Not enough answered choices yet to compare.</p>
          ) : (
            <p className="ask-delta">
              How often she guessed your choice: <b className="num">{pct(delta.fidelityBefore)}</b> → <b className="num">{pct(delta.fidelityAfter)}</b>
              <span className={`ask-deltachip${delta.delta < 0 ? " down" : ""}`}>{delta.delta >= 0 ? "+" : ""}{Math.round(delta.delta * 100)} pts</span>
            </p>
          )}
          <p className="ask-hint">Based on your latest {delta.answered} answered choice{delta.answered === 1 ? "" : "s"}. An approximation, not a guarantee.</p>
          {learned.map((l) => <p key={l} className="ask-learned">Noticed: {l}</p>)}
          <button type="button" className="btn-ghost btn-small" onClick={() => { setStep("idle"); setDecision(null); setPrompt(""); promptRef.current = ""; }}>Ask another</button>
        </motion.section>
      )}
    </main>
  );
}
