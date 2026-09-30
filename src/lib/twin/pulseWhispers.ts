import type { Habit, Task, TwinData, TwinState, Whisper } from "../types";
import { simulate } from "./scenarios";

const dayKey = (date: Date) => date.toISOString().slice(0, 10);

/** Derive concise planning prompts from current workload, deadlines, and habit logs. */
export function pulseWhispers(twinState: TwinState, tasks: Task[], habits: Habit[], now = new Date()): Whisper[] {
  const whispers: Whisper[] = [];
  if (twinState.loadPct >= 75) {
    const severity = twinState.loadPct >= 100 ? "act" : "watch";
    whispers.push({ id: "load-spike", severity, kind: "load", text: severity === "act" ? "This week is over capacity. Move or shorten one task." : "This week is getting busy. Leave room around the next deadline.", data: { loadPct: Math.round(twinState.loadPct) } });
  }

  const horizon = now.getTime() + 7 * 86400000;
  const simulationData: TwinData = { tasks, goals: [], habits, checkins: [], decisions: [], now: now.toISOString() };
  for (const task of tasks) {
    if (task.done || !task.dueAt) continue;
    const due = new Date(task.dueAt).getTime();
    if (!Number.isFinite(due) || due < now.getTime() || due > horizon) continue;
    const result = simulate({ id: `deadline-${task.id}`, label: task.title, summary: task.title, tasks: [{ taskId: task.id, title: task.title, hours: task.estHours, dueAt: task.dueAt, goalId: task.goalId }], priority: "deadline" }, simulationData);
    if (result.needsInfo || result.onTimeProb >= 0.75) continue;
    const severity = result.onTimeProb < 0.4 ? "act" : "watch";
    whispers.push({ id: `deadline-risk-${task.id}`, severity, kind: "deadline", text: severity === "act" ? `There may not be enough time for ${task.title} before it is due. Split it or start now.` : `${task.title} may be tight against its deadline. Check the estimate.` , data: { taskId: task.id, onTimeProb: result.onTimeProb, dueAt: task.dueAt, peakLoad: result.peakLoad } });
  }

  const today = dayKey(now);
  const yesterday = new Date(now); yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const lastDay = dayKey(yesterday);
  for (const habit of habits) {
    if (habit.log[today] !== undefined) continue;
    let streak = 0;
    const cursor = new Date(`${lastDay}T00:00:00.000Z`);
    while (habit.log[dayKey(cursor)] === true) { streak++; cursor.setUTCDate(cursor.getUTCDate() - 1); }
    if (streak < 2) continue;
    whispers.push({ id: `habit-streak-${habit.id}-${today}`, severity: streak >= 5 ? "watch" : "info", kind: "streak", text: `${habit.title} has a ${streak}-day run. Add it to tonight's plan if you want to keep it going.`, data: { habitId: habit.id, streak, date: today } });
  }
  return whispers;
}

export default pulseWhispers;
