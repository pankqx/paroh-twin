import type { TwinData } from "../types";
import { estimationBias } from "./index";

const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function twinInsights(data: TwinData): string[] {
  const insights: string[] = [];
  const study = data.tasks.filter(task => task.category === "study" && task.done && task.actualHours !== undefined && task.estHours > 0);
  if (study.length >= 3) {
    const ratio = estimationBias(data.tasks).study;
    if (ratio >= 1.05) insights.push(`Study tasks take ${ratio.toFixed(1)}x longer than you estimate.`);
    else if (ratio <= 0.95) insights.push(`Study tasks take about ${ratio.toFixed(1)}x as long as you estimate.`);
    else insights.push("Your study estimates are close to your actual time so far.");
  }

  const completionSlots = new Map<string, { day: string; start: number; hours: number; count: number }>();
  for (const task of data.tasks) {
    if (!task.done || !task.completedAt) continue;
    const completedAt = new Date(task.completedAt);
    if (Number.isNaN(completedAt.getTime())) continue;
    const start = Math.floor(completedAt.getUTCHours() / 2) * 2;
    const day = weekdays[completedAt.getUTCDay()];
    const key = `${day}-${start}`;
    const slot = completionSlots.get(key) ?? { day, start, hours: 0, count: 0 };
    slot.hours += task.actualHours ?? task.estHours;
    slot.count += 1;
    completionSlots.set(key, slot);
  }
  const topSlot = [...completionSlots.values()].sort((a, b) => b.hours - a.hours || b.count - a.count)[0];
  if (topSlot) insights.push(`You finish most work ${topSlot.day} around ${topSlot.start}:00–${topSlot.start + 2}:00.`);

  const closeCalls = data.decisions.filter(decision => /exam|revise|revision/i.test(decision.prompt) && decision.chosenScenarioId).slice(-5);
  if (closeCalls.length) {
    const examFirst = closeCalls.filter(decision => {
      const choice = decision.scenarios.find(scenario => scenario.id === decision.chosenScenarioId);
      return /exam|revise|revision/i.test(`${choice?.label ?? ""} ${choice?.summary ?? ""} ${decision.chosenScenarioId ?? ""}`);
    }).length;
    insights.push(`You chose exam-first in ${examFirst} of your last ${closeCalls.length} close calls.`);
  }
  return insights;
}

export function predictedNeeds(data: TwinData, now = data.now ? new Date(data.now) : new Date()): string[] {
  const needs: Array<{ due: number; text: string }> = [];
  for (const task of data.tasks) {
    if (task.done || !task.dueAt) continue;
    const due = new Date(task.dueAt).getTime();
    if (!Number.isFinite(due) || due < now.getTime()) continue;
    const days = Math.max(0, Math.ceil((Date.UTC(new Date(due).getUTCFullYear(), new Date(due).getUTCMonth(), new Date(due).getUTCDate()) - Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())) / 86400000));
    const prep = task.category === "study" ? "a revision block" : "a work block";
    const when = days === 0 ? " today" : days === 1 ? " tomorrow" : ` in ${days} days`;
    needs.push({ due, text: `${prep} before ${task.title}${when}.` });
  }
  const dayKey = now.toISOString().slice(0, 10);
  for (const habit of data.habits) {
    if (habit.log[dayKey] !== true) needs.push({ due: now.getTime() + 1, text: `Time for ${habit.title} today.` });
  }
  return needs.sort((a, b) => a.due - b.due).slice(0, 2).map(item => item.text);
}
