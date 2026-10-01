import type { Decision, Scenario, ScenarioSpec, TwinData } from "../types";
import { estimationBias } from "./index";

export interface SimulationResult extends Scenario { needsInfo?: string }
const stableHash = (s: string) => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
function random(seed: number) { let state = seed || 1; return () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; }; }

/** Groups of words that point at one kind of open task, so a what-if can be matched to real tasks. */
const GROUPS: Array<{ key: string; words: RegExp; titles: RegExp; label: string; priority: ScenarioSpec["priority"] }> = [
  { key: "exam", words: /\b(exam|exams|test|revis\w*|study|studying|biology|formula\w*)\b/, titles: /revise|review exam|exam|formula|biology/i, label: "Prepare for the exam first", priority: "deadline" },
  { key: "project", words: /\b(project|assignment|assignments|report|research|discussion|proofread\w*|essay|homework)\b/, titles: /project|report|assignment|discussion|proofread|research/i, label: "Work on the assignment first", priority: "goal" },
  { key: "seminar", words: /\b(seminar|presentation|slides|notes)\b/, titles: /seminar|presentation|notes/i, label: "Prepare the seminar first", priority: "deadline" },
  { key: "portfolio", words: /\b(portfolio|cv|resume)\b/, titles: /portfolio/i, label: "Update the portfolio first", priority: "goal" },
];

/**
 * Turns a what-if into two scenarios using only the student's own open tasks (no invented hours):
 * the two kinds of work named in the sentence, or, if only one is named, that one against the
 * nearest other deadline. Asks for clarification only when no open task can be matched at all.
 */
export function parseWhatIfCanned(text: string, data?: TwinData): ScenarioSpec[] {
  const lower = text.toLowerCase();
  const open = (data?.tasks ?? []).filter(t => !t.done).sort((a, b) => (a.dueAt ?? "z").localeCompare(b.dueAt ?? "z"));
  const tasksFor = (g: (typeof GROUPS)[number]) => open.filter(t => g.titles.test(t.title));
  const named = GROUPS.filter(g => g.words.test(lower) && tasksFor(g).length)
    .sort((a, b) => lower.search(a.words) - lower.search(b.words));
  const others = GROUPS.filter(g => !named.includes(g) && tasksFor(g).length);
  const picked = [...named, ...others].slice(0, 2);
  const ask = "Which tasks and estimated hours should this scenario include?";
  if (picked.length < 2) return [{ id: "scenario-a", label: "First option", summary: text.trim(), tasks: [], priority: "neutral", needsInfo: ask },
    { id: "scenario-b", label: "Alternative", summary: "Compare with the alternative priority.", tasks: [], priority: "neutral", needsInfo: ask }];
  // Each scenario does its own work first; the other work still has to fit after it.
  return picked.map((g, n) => {
    const first = tasksFor(g);
    const rest = tasksFor(picked[1 - n]);
    const tasks = [...first, ...rest].map(t => ({ taskId: t.id, title: t.title, hours: t.estHours, dueAt: t.dueAt, goalId: t.goalId }));
    return { id: `${g.key}-first`, label: g.label, summary: `Do ${first.map(t => t.title).join(" and ")} first, then ${rest.map(t => t.title).join(" and ")}.`, tasks, priority: g.priority };
  });
}

export function simulate(spec: ScenarioSpec, data: TwinData, seed = 42, trials = 500): SimulationResult {
  if (spec.needsInfo) return { id: spec.id, label: spec.label, summary: spec.summary, onTimeProb: 0, peakLoad: 0, goalImpact: 0, assumptions: [], needsInfo: spec.needsInfo };
  const matched = spec.tasks.map(item => ({ item, task: item.taskId ? data.tasks.find(t => t.id === item.taskId) : undefined }));
  const missing = matched.find(({ item, task }) => !(item.hours ?? task?.estHours) || (item.taskId && !task));
  if (missing) return { id: spec.id, label: spec.label, summary: spec.summary, onTimeProb: 0, peakLoad: 0, goalImpact: 0, assumptions: [], needsInfo: `How many hours should I plan for ${missing.item.title}?` };
  if (!matched.length) return { id: spec.id, label: spec.label, summary: spec.summary, onTimeProb: 0, peakLoad: 0, goalImpact: 0, assumptions: [], needsInfo: "Which tasks and estimated hours should this scenario include?" };
  const ratios = data.tasks.filter(t => t.done && t.actualHours !== undefined && t.estHours > 0).map(t => t.actualHours! / t.estHours);
  const mean = ratios.length ? ratios.reduce((a,b) => a+b, 0) / ratios.length : 1;
  const rng = random(stableHash(`${seed}:${spec.id}:${matched.map(x => x.item.title).join(":")}`));
  let successes = 0, peak = 0;
  const referenceTime = data.now ? new Date(data.now).getTime() : Date.now();
  // Tasks are worked in the plan's order; each must be finished before its own deadline, using about
  // 4 free hours a day. So the order matters: doing one thing first eats time from the next.
  const capacity = (dueAt?: string) => {
    const days = dueAt ? Math.max(0.25, (new Date(dueAt).getTime() - referenceTime) / 86400000) : 1;
    return Math.max(1, Math.min(24, days * 4));
  };
  const caps = matched.map(({ item, task }) => capacity(item.dueAt ?? task?.dueAt));
  const lastCap = Math.max(...caps);
  for (let i = 0; i < trials; i++) {
    let total = 0, ok = true;
    matched.forEach(({ item, task }, k) => {
      const estimate = item.hours ?? task!.estHours;
      const ratio = ratios.length ? ratios[Math.floor(rng() * ratios.length)] : Math.exp(Math.log(mean) + (rng() - 0.5) * 0.7);
      total += estimate * ratio;
      if (total > caps[k]) ok = false;
    });
    peak += total / lastCap;
    if (ok) successes++;
  }
  const bias = estimationBias(data.tasks);
  const relevant = matched.map(x => x.task).filter(Boolean);
  const goalImpact = relevant.length ? relevant.filter(t => t!.goalId).length / relevant.length : 0;
  return { id: spec.id, label: spec.label, summary: spec.summary, onTimeProb: successes / trials,
    peakLoad: peak / trials, goalImpact: spec.priority === "goal" ? Math.max(goalImpact, 0.5) : goalImpact,
    assumptions: [`500 seeded trials resample ${ratios.length ? "Frank's completed actual/estimate ratios" : "a conservative estimate ratio centred on 1.0"}.`, `Study estimate multiplier: ${bias.study.toFixed(2)}x.`] };
}

export function recommend(scenarios: Scenario[]): Scenario | undefined {
  return [...scenarios].sort((a,b) => (b.onTimeProb + b.goalImpact * 0.12 - b.peakLoad * 0.08) - (a.onTimeProb + a.goalImpact * 0.12 - a.peakLoad * 0.08))[0];
}

export function predictChoice(scenarios: Scenario[], decisions: Decision[]): string {
  if (!scenarios.length) return "";
  const history = decisions.filter(d => d.chosenScenarioId).slice(-10);
  if (!history.length) return recommend(scenarios)?.id ?? scenarios[0].id;
  const rates = scenarios.map(s => ({ id: s.id, score: history.filter(d => d.chosenScenarioId === s.id || (d.userChoice === "accept" && d.recommendedId === s.id)).length }));
  return rates.sort((a,b) => b.score - a.score)[0]?.id ?? scenarios[0].id;
}

export function recordChoice(decisions: Decision[], decisionId: string, userChoice: Decision["userChoice"], chosenScenarioId?: string) {
  const next = decisions.map(d => d.id === decisionId ? { ...d, userChoice, chosenScenarioId, updatedAt: new Date().toISOString() } : d);
  const beforeObserved = decisions.filter(d => d.chosenScenarioId).slice(-10);
  const observed = next.filter(d => d.chosenScenarioId).slice(-10);
  const score = (items: Decision[]) => items.length ? items.filter(d => d.predictedChoiceId === d.chosenScenarioId).length / items.length : 0;
  const closeCalls = observed.filter(d => /exam|revision|revise/i.test(`${d.prompt} ${d.scenarios.map(s => `${s.label} ${s.summary}`).join(" ")}`));
  const examFirst = closeCalls.filter(d => {
    const chosen = d.scenarios.find(s => s.id === d.chosenScenarioId);
    return /exam|revision|revise/i.test(`${chosen?.label ?? ""} ${chosen?.summary ?? ""}`);
  });
  const learned = closeCalls.length >= 2 && examFirst.length / closeCalls.length >= 0.6 &&
    closeCalls.some(d => /tomorrow|today|48 ?hours?|under 2 days/i.test(d.prompt))
    ? ["You prefer exam-first when an exam is under 48h away."] : [];
  const counts = new Map<string, number>();
  for (const decision of observed) counts.set(decision.chosenScenarioId!, (counts.get(decision.chosenScenarioId!) ?? 0) + 1);
  const nextPrediction = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? "";
  const fidelityBefore = score(beforeObserved);
  const fidelityAfter = score(observed);
  return { decisions: next, fidelity: fidelityAfter, fidelityBefore, fidelityAfter, learned, nextPrediction };
}
