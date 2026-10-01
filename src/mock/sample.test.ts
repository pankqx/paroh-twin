import { describe, expect, it } from "vitest";
import { createSampleData } from "./sample";
import { estimationBias, heatmap } from "../lib/twin";

describe("relative Frank sample seed", () => {
  const seed = new Date("2031-04-14T15:30:00.000Z");
  const sample = createSampleData(seed);

  it("keeps deadlines relative and future-facing", () => {
    const exam = sample.goals.find(goal => goal.id === "goal-1")!;
    const project = sample.goals.find(goal => goal.id === "goal-2")!;
    const expectedExam = new Date(seed); expectedExam.setDate(expectedExam.getDate() + 2); expectedExam.setHours(9, 0, 0, 0);
    const expectedProject = new Date(seed); expectedProject.setDate(expectedProject.getDate() + 4); expectedProject.setHours(18, 0, 0, 0);
    expect(exam.targetDate).toBe(expectedExam.toISOString());
    expect(project.targetDate).toBe(expectedProject.toISOString());
    expect(sample.tasks.filter(task => !task.done && task.dueAt).every(task => new Date(task.dueAt!).getTime() > seed.getTime())).toBe(true);
    expect(sample.tasks.find(task => task.title === "Revise for biology exam")?.dueAt).toBe(exam.targetDate);
    expect(sample.tasks.find(task => task.title === "Finish project discussion")?.dueAt).toBe(project.targetDate);
  });

  it("spreads focus across multiple hours with weekday work stronger than weekends", () => {
    const grid = heatmap(sample.tasks);
    const activeHours = new Set(grid.flatMap(row => row.flatMap((value, hour) => value > 0 ? [hour] : [])));
    expect(activeHours.size).toBeGreaterThan(3);
    const weekdayTotal = grid.slice(0, 5).flat().reduce((sum, value) => sum + value, 0);
    const weekendTotal = grid.slice(5).flat().reduce((sum, value) => sum + value, 0);
    expect(weekdayTotal).toBeGreaterThan(weekendTotal);
  });

  it("keeps study estimates near 1.3x and preserves goal-linked work and fidelity history", () => {
    expect(sample.tasks).toHaveLength(27);
    expect(estimationBias(sample.tasks).study).toBeCloseTo(1.3, 1);
    expect(sample.tasks.some(task => task.done && task.goalId)).toBe(true);
    expect(sample.checkins).toHaveLength(14);
    expect(sample.decisions).toHaveLength(6);
    expect(sample.decisions.filter(decision => decision.chosenScenarioId).filter(decision => decision.predictedChoiceId === decision.chosenScenarioId)).toHaveLength(3);
  });
});
