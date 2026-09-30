import { describe, expect, it } from "vitest";
import type { Habit, Task, TwinState } from "../types";
import { pulseWhispers } from "./pulseWhispers";

const state = (loadPct: number): TwinState => ({ confidenceByDomain: {}, loadPct, habitConsistency: 0.5, goalAlignment: 0, estimationBias: { study: 1.3, health: 1, personal: 1, career: 1, other: 1 }, heatmap: [], fidelity: 0, updatedAt: "2026-09-30T00:00:00.000Z" });
const base = { createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-01T00:00:00.000Z", category: "study" as const };

describe("pulseWhispers", () => {
  it("flags high load and a near deadline based on seeded simulation", () => {
    const tasks: Task[] = [
      { ...base, id: "past", title: "Past work", estHours: 2, actualHours: 2.6, done: true },
      { ...base, id: "due", title: "Lab report", estHours: 20, done: false, dueAt: "2026-10-02T09:00:00.000Z" },
    ];
    const whispers = pulseWhispers(state(110), tasks, [], new Date("2026-10-01T09:00:00.000Z"));
    expect(whispers.find(item => item.kind === "load")?.severity).toBe("act");
    expect(whispers.find(item => item.kind === "deadline")?.data.taskId).toBe("due");
  });

  it("notices an unlogged habit streak at risk tonight without modifying inputs", () => {
    const now = new Date("2026-10-01T18:00:00.000Z");
    const habit: Habit = { ...base, id: "review", title: "Review notes", log: { "2026-09-29": true, "2026-09-30": true } };
    const before = structuredClone(habit);
    const whispers = pulseWhispers(state(0), [], [habit], now);
    expect(whispers).toContainEqual(expect.objectContaining({ kind: "streak", data: expect.objectContaining({ habitId: "review", streak: 2, date: "2026-10-01" }) }));
    expect(habit).toEqual(before);
  });
});
