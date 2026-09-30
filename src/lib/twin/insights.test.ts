import { describe, expect, it } from "vitest";
import type { Decision, TwinState } from "../types";
import { feedbackDelta, insights, predictedNeeds } from "./insights";

const twinState = (updatedAt = "2026-10-01T12:00:00.000Z"): TwinState => ({
  confidenceByDomain: {}, loadPct: 20, habitConsistency: 0.7, goalAlignment: 0.5,
  estimationBias: { study: 1.3, health: 1, personal: 1, career: 1, other: 1 },
  heatmap: Array.from({ length: 7 }, () => Array<number>(24).fill(0)), fidelity: 0.6, updatedAt,
});

const decision = (id: string, userChoice: Decision["userChoice"], actual: string, predicted: string): Decision => ({
  id, prompt: "Which plan?", scenarios: [
    { id: "a", label: "A", summary: "A", onTimeProb: 0.5, peakLoad: 0.5, goalImpact: 0, assumptions: [] },
    { id: "b", label: "B", summary: "B", onTimeProb: 0.5, peakLoad: 0.5, goalImpact: 0, assumptions: [] },
  ], recommendedId: "a", predictedChoiceId: predicted, chosenScenarioId: actual,
  userChoice, createdAt: `2026-09-${String(Number(id) + 1).padStart(2, "0")}T00:00:00.000Z`, updatedAt: "2026-10-01T00:00:00.000Z",
});

describe("insight functions", () => {
  it("returns numeric estimate, focus, habit-risk, and energy statements", () => {
    const twin = twinState();
    twin.heatmap[1][9] = 0.9;
    const tasks = [{ id: "done", title: "Read", category: "study" as const, estHours: 2, actualHours: 2.6, done: true, createdAt: "2026-09-20T00:00:00.000Z", updatedAt: "2026-09-20T00:00:00.000Z" }];
    const habits = [{ id: "walk", title: "Walk", category: "health" as const, log: { "2026-09-29": true, "2026-09-30": true }, createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-30T00:00:00.000Z" }];
    const checkins = [{ id: "checkin", date: "2026-10-01", mood: 3 as const, energy: 4 as const, createdAt: "2026-10-01T00:00:00.000Z", updatedAt: "2026-10-01T00:00:00.000Z" }];
    const result = insights(twin, tasks, habits, checkins);
    expect(result).toHaveLength(4);
    expect(result[0]).toContain("1.30x");
    expect(result[1]).toContain("Tue 09:00");
    expect(result[2]).toContain("1 of 1");
    expect(result[3]).toContain("4.0/5");
  });

  it("predicts tomorrow's open deadline and continuing habit", () => {
    const tasks = [{ id: "exam", title: "Biology exam", category: "study" as const, estHours: 2, dueAt: "2026-10-02T14:00:00.000Z", done: false, createdAt: "2026-09-20T00:00:00.000Z", updatedAt: "2026-09-20T00:00:00.000Z" }];
    const habits = [{ id: "walk", title: "Evening walk", category: "health" as const, log: { "2026-10-01": true }, createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-10-01T00:00:00.000Z" }];
    expect(predictedNeeds(tasks, habits, new Date("2026-10-01T12:00:00.000Z"))).toEqual([
      "Plan a study block for Biology exam due tomorrow.", "Keep your Evening walk streak going tomorrow.",
    ]);
  });

  it("compares the last five feedback outcomes with the preceding five", () => {
    const history = [
      decision("1", "accept", "a", "a"), decision("2", "reject", "b", "b"),
      decision("3", "accept", "a", "a"), decision("4", "reject", "b", "b"),
      decision("5", "accept", "a", "a"), decision("6", "modify", "b", "b"),
      decision("7", "accept", "a", "a"), decision("8", "reject", "b", "b"),
      decision("9", "modify", "a", "b"), decision("10", "accept", "a", "b"),
    ];
    expect(feedbackDelta(history)).toEqual({ fidelityBefore: 1, fidelityAfter: 0.6, delta: -0.4, answered: 5 });
  });
});
