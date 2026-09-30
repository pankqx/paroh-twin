import type { CheckIn, Decision, Habit, Task, TwinState } from "../types";

const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const utcDate = (date: Date) => date.toISOString().slice(0, 10);
const nextDate = (date: Date, offset: number) => {
  const result = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + offset));
  return utcDate(result);
};

/** Human-readable numeric summaries derived only from the supplied twin data. */
export function insights(twinState: TwinState, tasks: Task[], habits: Habit[], checkins: CheckIn[]): string[] {
  const completedStudy = tasks.filter(task => task.done && task.category === "study" && task.actualHours !== undefined && task.estHours > 0);
  const studyBias = twinState.estimationBias.study;
  const estimateText = completedStudy.length
    ? `Study tasks averaged ${studyBias.toFixed(2)}x their estimates across ${completedStudy.length} completed tasks.`
    : `Study estimate baseline is ${studyBias.toFixed(2)}x, with ${completedStudy.length} completed study tasks measured.`;

  const cells = twinState.heatmap.flatMap((row, day) => row.map((intensity, hour) => ({ day, hour, intensity })))
    .filter(cell => Number.isFinite(cell.intensity)).sort((a, b) => b.intensity - a.intensity || a.day - b.day || a.hour - b.hour);
  const focusCells = cells.filter(cell => cell.intensity > 0).slice(0, 2);
  const focusText = focusCells.length
    ? `Strongest focus hour${focusCells.length > 1 ? "s" : ""}: ${focusCells.map(cell => `${weekdays[cell.day]} ${String(cell.hour).padStart(2, "0")}:00 (${cell.intensity.toFixed(2)})`).join(" and ")}.`
    : `Focus heatmap has ${cells.length ? Math.max(0, ...cells.map(cell => cell.intensity)).toFixed(2) : "0.00"} peak intensity recorded.`;

  const today = utcDate(new Date(twinState.updatedAt));
  const streaks = habits.map(habit => {
    let date = habit.log[today] === true ? today : nextDate(new Date(`${today}T00:00:00.000Z`), -1);
    let count = 0;
    while (habit.log[date] === true) { count += 1; date = nextDate(new Date(`${date}T00:00:00.000Z`), -1); }
    return { habit, count, atRisk: habit.log[today] !== true };
  }).filter(item => item.count >= 2);
  const atRisk = streaks.filter(item => item.atRisk).length;
  const habitText = `${atRisk} of ${streaks.length} active habit streaks need a check-in today.`;

  const energyAverage = checkins.length ? checkins.reduce((sum, checkin) => sum + checkin.energy, 0) / checkins.length : 0;
  const energyText = `Average energy is ${energyAverage.toFixed(1)}/5 across ${checkins.length} check-ins.`;
  return [estimateText, focusText, habitText, energyText];
}

/** Likely next-day study/work blocks and habits, ordered by due time and title. */
export function predictedNeeds(tasks: Task[], habits: Habit[], now = new Date()): string[] {
  const tomorrow = nextDate(now, 1);
  const dueNeeds = tasks.filter(task => !task.done && task.dueAt && utcDate(new Date(task.dueAt)) === tomorrow)
    .map(task => ({ order: task.dueAt ?? "", text: `${task.category === "study" ? "Plan a study block" : "Set aside time"} for ${task.title} due tomorrow.` }));
  const habitNeeds = habits.filter(habit => {
    const today = nextDate(now, 0);
    const yesterday = nextDate(now, -1);
    return habit.log[today] === true || habit.log[yesterday] === true;
  }).map(habit => ({ order: "9999", text: `Keep your ${habit.title} streak going tomorrow.` }));
  return [...dueNeeds, ...habitNeeds].sort((a, b) => a.order.localeCompare(b.order) || a.text.localeCompare(b.text)).slice(0, 3).map(item => item.text);
}

export interface FeedbackDelta {
  fidelityBefore: number;
  fidelityAfter: number;
  delta: number;
  answered: number;
}

function actualChoice(decision: Decision): string | undefined {
  if (decision.chosenScenarioId) return decision.chosenScenarioId;
  if (decision.userChoice === "accept") return decision.recommendedId;
  if (decision.userChoice === "reject") return decision.scenarios.find(scenario => scenario.id !== decision.recommendedId)?.id;
  return undefined;
}

/** Compares prediction accuracy before and after the latest five recorded responses. */
export function feedbackDelta(decisions: Decision[]): FeedbackDelta {
  const answered = decisions.filter(decision => decision.userChoice !== undefined)
    .map(decision => ({ decision, actual: actualChoice(decision) }))
    .filter((item): item is { decision: Decision; actual: string } => Boolean(item.actual));
  const recent = answered.slice(-5);
  const before = answered.slice(Math.max(0, answered.length - 10), Math.max(0, answered.length - 5));
  const score = (items: typeof answered) => items.length
    ? items.filter(({ decision, actual }) => decision.predictedChoiceId === actual).length / items.length
    : 0;
  const fidelityBefore = score(before);
  const fidelityAfter = score(recent);
  return { fidelityBefore, fidelityAfter, delta: fidelityAfter - fidelityBefore, answered: recent.length };
}
