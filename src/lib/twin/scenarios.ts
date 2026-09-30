import type { Decision, Scenario, ScenarioSpec, TwinData } from "../types";
import { estimationBias } from "./index";

export interface SimulationResult extends Scenario { needsInfo?: string }
const stableHash = (s: string) => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
function random(seed: number) { let state = seed || 1; return () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; }; }

/** Parses the two priorities in the hackathon demo using only named student data. */
export function parseWhatIfCanned(text: string, data?: TwinData): ScenarioSpec[] {
  const lower = text.toLowerCase();
  const project = lower.includes("project") ? data?.tasks.find(t => /project discussion|edit project/i.test(t.title) && !t.done) : undefined;
  const exam = lower.includes("exam") || lower.includes("revis") ? data?.tasks.find(t => /revise|review cell|exam/i.test(t.title) && !t.done) : undefined;
  const demo = lower.includes("project") && (lower.includes("exam") || lower.includes("revis"));
  if (!demo) return [{ id: "scenario-a", label: "First option", summary: text.trim(), tasks: [], priority: "neutral", needsInfo: "Which tasks and estimated hours should this scenario include?" },
    { id: "scenario-b", label: "Alternative", summary: "Compare with the alternative priority.", tasks: [], priority: "neutral", needsInfo: "Which tasks and estimated hours should this scenario include?" }];
  const spec = (id: string, label: string, task: typeof project, priority: ScenarioSpec["priority"]) => ({ id, label, summary: `Prioritise ${task?.title ?? (priority === "goal" ? "the project" : "exam revision")} tonight.`, tasks: task ? [{ taskId: task.id, title: task.title, hours: task.estHours, dueAt: task.dueAt, goalId: task.goalId }] : [], priority,
    needsInfo: task ? undefined : `I need an estimate or matching open task for ${priority === "goal" ? "the project" : "exam revision"}.` });
  return [spec("project-tonight", "Finish the project tonight", project, "goal"), spec("revise-exam", "Revise for tomorrow's exam", exam, "deadline")];
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
  const due = matched.map(({ item, task }) => item.dueAt ?? task?.dueAt).filter(Boolean).map(d => new Date(d!).getTime()).sort((a,b) => a-b)[0];
  const referenceTime = data.now ? new Date(data.now).getTime() : Date.now();
  const days = due ? Math.max(0.25, (due - referenceTime) / 86400000) : 1;
  const available = Math.max(1, Math.min(12, days * 4));
  for (let i = 0; i < trials; i++) {
    let total = 0;
    for (const { item, task } of matched) {
      const estimate = item.hours ?? task!.estHours;
      const ratio = ratios.length ? ratios[Math.floor(rng() * ratios.length)] : Math.exp(Math.log(mean) + (rng() - 0.5) * 0.7);
      total += estimate * ratio;
    }
    peak += total / available;
    if (total <= available) successes++;
  }
  const bias = estimationBias(data.tasks);
  const relevant = matched.map(x => x.task).filter(Boolean);
  const goalImpact = relevant.length ? relevant.filter(t => t!.goalId).length / relevant.length : 0;
  return { id: spec.id, label: spec.label, summary: spec.summary, onTimeProb: successes / trials,
    peakLoad: peak / trials, goalImpact: spec.priority === "goal" ? Math.max(goalImpact, 0.5) : goalImpact,
    assumptions: [`500 seeded trials resample ${ratios.length ? "Asha's completed actual/estimate ratios" : "a conservative estimate ratio centred on 1.0"}.`, `Study estimate multiplier: ${bias.study.toFixed(2)}x.`] };
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
  const observed = next.filter(d => d.chosenScenarioId).slice(-10);
  return { decisions: next, fidelity: observed.length ? observed.filter(d => d.predictedChoiceId === d.chosenScenarioId).length / observed.length : 0 };
}
