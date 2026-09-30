import type { Category, TwinData, TwinState, Task } from "../types";

const categories: Category[] = ["study", "health", "personal", "career", "other"];
const iso = (d: Date) => d.toISOString();

export function estimationBias(tasks: Task[]): Record<Category, number> {
  const result = {} as Record<Category, number>;
  for (const category of categories) {
    const ratios = tasks.filter(t => t.category === category && t.done && t.actualHours !== undefined && t.estHours > 0)
      .map(t => t.actualHours! / t.estHours);
    result[category] = ratios.length < 3 ? 1 : ratios.reduce((a, b) => a + b, 0) / ratios.length;
  }
  return result;
}

export function load(tasks: Task[], now = new Date(), availableHoursPerDay = 4): number {
  const end = now.getTime() + 7 * 24 * 60 * 60 * 1000;
  const bias = estimationBias(tasks);
  const hours = tasks.filter(t => !t.done && t.dueAt && new Date(t.dueAt).getTime() >= now.getTime() && new Date(t.dueAt).getTime() < end)
    .reduce((sum, t) => sum + t.estHours * bias[t.category], 0);
  return availableHoursPerDay > 0 ? (hours / (availableHoursPerDay * 7)) * 100 : 0;
}

export function heatmap(tasks: Task[]): number[][] {
  const grid = Array.from({ length: 7 }, () => Array<number>(24).fill(0));
  for (const task of tasks) {
    if (!task.done || !task.completedAt) continue;
    const date = new Date(task.completedAt);
    if (Number.isNaN(date.getTime())) continue;
    const day = (date.getUTCDay() + 6) % 7;
    grid[day][date.getUTCHours()] += task.actualHours ?? task.estHours;
  }
  const max = Math.max(0, ...grid.flat());
  return grid.map(row => row.map(v => max ? v / max : 0));
}

export function habitConsistency(habits: TwinData["habits"], now = new Date()): number {
  const expectedDays = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(now); d.setUTCDate(d.getUTCDate() - 13 + i); return d.toISOString().slice(0, 10);
  });
  const expected = habits.length * expectedDays.length;
  if (!expected) return 0;
  const completed = habits.reduce((sum, h) => sum + expectedDays.filter(day => h.log[day]).length, 0);
  return completed / expected;
}

export function goalAlignment(tasks: Task[], now = new Date()): number {
  const start = now.getTime() - 7 * 86400000;
  const recent = tasks.filter(t => t.done && t.completedAt && new Date(t.completedAt).getTime() >= start && new Date(t.completedAt).getTime() <= now.getTime());
  const total = recent.reduce((s, t) => s + (t.actualHours ?? t.estHours), 0);
  return total ? recent.filter(t => t.goalId).reduce((s, t) => s + (t.actualHours ?? t.estHours), 0) / total : 0;
}

export function confidenceByDomain(data: TwinData): Record<string, number> {
  const approved = data.facts?.filter(f => f.status === "approved" && typeof f.data.supersededBy !== "string") ?? [];
  const countKind = (...kinds: string[]) => approved.filter(f => kinds.includes(f.kind)).length;
  const habitDays = new Set(data.habits.flatMap(h => Object.keys(h.log))).size;
  return {
    tasks: Math.min(1, (data.tasks.length + countKind("task", "deadline")) / 12),
    habits: Math.min(1, Math.max(habitDays, countKind("habit")) / 14),
    routines: Math.min(1, countKind("routine", "preference") / 8),
    mood: Math.min(1, data.checkins.length / 10),
    goals: Math.min(1, (data.goals.length + countKind("goal")) / 6),
    planner: Math.min(1, data.tasks.filter(t => t.dueAt).length / 12),
  };
}

export function fidelity(decisions: TwinData["decisions"], count = 10): number {
  const recorded = decisions.filter(d => d.chosenScenarioId && (d.userChoice || d.chosenScenarioId)).slice(-count);
  return recorded.length ? recorded.filter(d => d.predictedChoiceId === d.chosenScenarioId).length / recorded.length : 0;
}

export function deriveTwinState(data: TwinData): TwinState {
  const now = data.now ? new Date(data.now) : new Date();
  return {
    confidenceByDomain: confidenceByDomain(data), loadPct: load(data.tasks, now),
    habitConsistency: habitConsistency(data.habits, now), goalAlignment: goalAlignment(data.tasks, now),
    estimationBias: estimationBias(data.tasks), heatmap: heatmap(data.tasks),
    fidelity: fidelity(data.decisions), updatedAt: iso(now),
  };
}

export { categories as TWIN_CATEGORIES };
