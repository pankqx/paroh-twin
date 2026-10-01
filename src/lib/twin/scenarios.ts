import type { Decision, Scenario, ScenarioSpec, Task, TwinData } from "../types";
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

/** Things that take time away from the plan, with a typical length when none is stated. */
const ACTIVITIES: Array<{ words: RegExp; hours: number; priority: ScenarioSpec["priority"] }> = [
  { words: /\b(fest|festival|party|concert|wedding|function|event|trip|outing|movie|film|match|game|gaming|hang ?out|friends|shopping|date)\b/, hours: 4, priority: "rest" },
  { words: /\b(sleep|nap|rest|break|day off|relax|chill)\b/, hours: 3, priority: "rest" },
  { words: /\b(gym|workout|run|walk|sport|football|cricket|swim|yoga)\b/, hours: 1.5, priority: "health" },
  { words: /\b(part[- ]time|job|shift|work at|internship|family|home|travel)\b/, hours: 4, priority: "neutral" },
];

const WORDNUM: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, a: 1, an: 1 };
/** Hours mentioned or implied by the sentence ("3 hours", "next two days", "tonight"). */
function statedHours(lower: string): number | undefined {
  const h = lower.match(/(\d+(?:\.\d+)?|one|two|three|four|five|six|an?)\s*(?:hours?|hrs?|h)\b/);
  if (h) return WORDNUM[h[1]] ?? Number(h[1]);
  const d = lower.match(/(\d+|one|two|three|four|five|six|a)\s*(?:whole\s+|full\s+)?days?\b/);
  if (d) return (WORDNUM[d[1]] ?? Number(d[1])) * 4; // about 4 free hours a day
  if (/\b(weekend)\b/.test(lower)) return 8;
  if (/\b(all day|whole day|full day)\b/.test(lower)) return 6;
  if (/\b(tonight|this evening|evening)\b/.test(lower)) return undefined; // use the activity's usual length
  return undefined;
}

/** The activity as a short label: "What if I go to the fest tonight?" -> "Go to the fest tonight". */
function activityLabel(text: string): string {
  const m = text.match(/(?:what (?:will happen |happens )?if|should|can|could)\s+i\s+([^?.!]+?)(?:\s+instead\b[^?.!]*)?[?.!]*$/i);
  const raw = (m?.[1] ?? text).replace(/[?.!]+$/, "").trim();
  const short = raw.length > 48 ? `${raw.slice(0, 46).trim()}…` : raw;
  return short.charAt(0).toUpperCase() + short.slice(1);
}

const ref = (t: Task) => ({ taskId: t.id, title: t.title, hours: t.estHours, dueAt: t.dueAt, goalId: t.goalId });

/**
 * Turns a what-if into two plans built only from the student's own open tasks (no invented
 * deadlines; activity length comes from the sentence or a stated typical length):
 *  - "X instead of Y" (two kinds of work): X first then Y, against Y first then X.
 *  - an activity (fest, gym, sleep, a shift...): the activity first, then the week's deadlines,
 *    against sticking to the plan.
 *  - one kind of work: that first, against the plan in deadline order.
 * Asks one question only when nothing in the sentence can be placed.
 */
export function parseWhatIfCanned(text: string, data?: TwinData): ScenarioSpec[] {
  const lower = text.toLowerCase();
  const now = data?.now ? new Date(data.now).getTime() : Date.now();
  const open = (data?.tasks ?? []).filter(t => !t.done).sort((a, b) => (a.dueAt ?? "z").localeCompare(b.dueAt ?? "z"));
  const week = open.filter(t => t.dueAt && new Date(t.dueAt).getTime() > now && new Date(t.dueAt).getTime() < now + 8 * 86400000);
  const plan = (week.length ? week : open).slice(0, 6);
  const tasksFor = (g: (typeof GROUPS)[number]) => open.filter(t => g.titles.test(t.title));
  const named = GROUPS.filter(g => g.words.test(lower) && tasksFor(g).length).sort((a, b) => lower.search(a.words) - lower.search(b.words));
  const activity = ACTIVITIES.find(a => a.words.test(lower));
  const ask = "Which tasks and estimated hours should this scenario include?";
  const clarify = (q: string): ScenarioSpec[] => [
    { id: "scenario-a", label: "First option", summary: text.trim(), tasks: [], priority: "neutral", needsInfo: q },
    { id: "scenario-b", label: "Alternative", summary: "Compare with the alternative priority.", tasks: [], priority: "neutral", needsInfo: q },
  ];
  const list = (ts: Task[]) => ts.map(t => t.title).join(", ");

  // An activity that takes time away from the plan.
  if (activity && plan.length) {
    const hours = statedHours(lower) ?? activity.hours;
    const label = activityLabel(text);
    return [
      { id: "activity", label, summary: `${hours}h for this first, then ${list(plan)} before their deadlines.`, priority: activity.priority,
        tasks: [{ title: label, hours }, ...plan.map(ref)] },
      { id: "plan", label: "Stick to the plan", summary: `Work through ${list(plan)} in deadline order.`, priority: "deadline", tasks: plan.map(ref) },
    ];
  }

  // Two kinds of work: which goes first.
  if (named.length >= 2) {
    const [a, b] = named;
    const order = (x: typeof a, y: typeof a) => [...tasksFor(x), ...tasksFor(y)];
    return [a, b].map((g, n) => {
      const other = n === 0 ? b : a;
      return { id: `${g.key}-first`, label: g.label, summary: `Do ${list(tasksFor(g))} first, then ${list(tasksFor(other))}.`, priority: g.priority, tasks: order(g, other).map(ref) };
    });
  }

  // One kind of work named: put it first, against the plan in deadline order.
  if (named.length === 1) {
    const g = named[0];
    const first = tasksFor(g);
    const extra = statedHours(lower);
    const rest = plan.filter(t => !first.includes(t));
    const firstRefs = first.map(ref);
    if (extra && firstRefs.length) firstRefs[0] = { ...firstRefs[0], hours: Math.max(firstRefs[0].hours, extra) };
    return [
      { id: `${g.key}-first`, label: g.label, summary: `${extra ? `${extra}h on ` : ""}${list(first)} first, then ${list(rest) || "the rest of the week"}.`, priority: g.priority, tasks: [...firstRefs, ...rest.map(ref)] },
      { id: "plan", label: "Stick to the plan", summary: `Work through ${list(plan)} in deadline order.`, priority: "deadline", tasks: plan.map(ref) },
    ];
  }

  return clarify(plan.length ? `Which two things are you choosing between? For example: "${plan[0].title}" or something else, and for how long?` : ask);
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
  const caps = matched.map(({ item, task }) => (item.dueAt ?? task?.dueAt ? capacity(item.dueAt ?? task?.dueAt) : Infinity));
  const finite = caps.filter(Number.isFinite);
  const lastCap = finite.length ? Math.max(...finite) : 4;
  const met = matched.map(() => 0);
  for (let i = 0; i < trials; i++) {
    let total = 0, ok = true;
    matched.forEach(({ item, task }, k) => {
      const estimate = item.hours ?? task!.estHours;
      // Only real tasks run over their estimate; a stated activity length is taken as given.
      const ratio = !task ? 1 : ratios.length ? ratios[Math.floor(rng() * ratios.length)] : Math.exp(Math.log(mean) + (rng() - 0.5) * 0.7);
      total += estimate * ratio;
      if (total > caps[k]) ok = false;
      else met[k]++;
    });
    peak += total / lastCap;
    if (ok) successes++;
  }
  const taskOdds = matched.flatMap(({ item, task }, k) => (Number.isFinite(caps[k]) ? [{ title: item.title, dueAt: item.dueAt ?? task?.dueAt, onTime: met[k] / trials, hours: item.hours ?? task?.estHours ?? 0 }] : []));
  const bias = estimationBias(data.tasks);
  const relevant = matched.map(x => x.task).filter(Boolean);
  const goalImpact = relevant.length ? relevant.filter(t => t!.goalId).length / relevant.length : 0;
  return { id: spec.id, label: spec.label, summary: spec.summary, onTimeProb: successes / trials,
    peakLoad: peak / trials, goalImpact: spec.priority === "goal" ? Math.max(goalImpact, 0.5) : goalImpact,
    taskOdds,
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

const pc = (v: number) => `${Math.round(v * 100)}%`;
const dayName = (iso?: string) => (iso ? new Date(iso).toLocaleDateString("en-IN", { weekday: "long" }) : "");

/**
 * A plain-language comparison built only from the simulation numbers and the student's own data.
 * No model is involved, so every number said aloud is one shown on screen.
 */
export function explainComparison(
  scenarios: Scenario[],
  recommendedId: string | undefined,
  facts: Array<{ id: string; text: string }>,
  studyBias?: number,
): { text: string; spoken: string; usedFactIds: string[] } {
  if (scenarios.length < 2) return { text: "I need two options to compare.", spoken: "I need two options to compare.", usedFactIds: [] };
  const best = scenarios.find(s => s.id === recommendedId) ?? scenarios[0];
  const other = scenarios.find(s => s.id !== best.id)!;
  const parts: string[] = [];
  parts.push(`${best.label}: ${pc(best.onTimeProb)} chance every deadline is met. ${other.label}: ${pc(other.onTimeProb)}.`);

  // The deadline that changes most between the two plans.
  const odds = (s: Scenario, title: string) => s.taskOdds?.find(t => t.title === title);
  const swings = (best.taskOdds ?? []).map(t => ({ t, o: odds(other, t.title) })).filter(x => x.o).map(x => ({ ...x, d: Math.abs(x.t.onTime - x.o!.onTime) })).sort((a, b) => b.d - a.d);
  const top = swings[0];
  if (top && top.d >= 0.05) {
    parts.push(`The difference is ${top.t.title}${top.t.dueAt ? `, due ${dayName(top.t.dueAt)}` : ""}: ${pc(top.t.onTime)} with ${best.label.toLowerCase()}, ${pc(top.o!.onTime)} with ${other.label.toLowerCase()}.`);
  } else if (Math.abs(best.onTimeProb - other.onTimeProb) < 0.05) {
    parts.push(`Both plans keep the deadlines about equally safe, so the difference is your load: ${pc(best.peakLoad)} against ${pc(other.peakLoad)} of your free time.`);
  }
  const risky = (other.taskOdds ?? []).filter(t => t.onTime < 0.7).sort((a, b) => a.onTime - b.onTime)[0];
  if (risky && risky.title !== top?.t.title) parts.push(`With ${other.label.toLowerCase()}, ${risky.title} is the deadline most at risk (${pc(risky.onTime)}).`);
  if (studyBias && Math.abs(studyBias - 1) >= 0.1) parts.push(`Your study tasks usually take ${studyBias.toFixed(1)} times your estimate, so I planned for that.`);
  const fact = facts[0];
  if (fact) parts.push(`You told me: "${fact.text.replace(/[.]+$/, "")}."`);
  parts.push(`My suggestion: ${best.label.toLowerCase()}.`);
  const text = parts.join(" ");
  const spoken = [parts[0], parts[1], parts[parts.length - 1]].filter(Boolean).join(" ");
  return { text, spoken, usedFactIds: fact ? [fact.id] : [] };
}
