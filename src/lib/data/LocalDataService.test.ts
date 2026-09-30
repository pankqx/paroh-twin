import { describe, expect, it } from "vitest";
import type { TwinState } from "../types";
import { LocalDataService, questionsForTwinState } from "./LocalDataService";

const blankTwin = (confidenceByDomain: Record<string, number>): TwinState => ({
  confidenceByDomain, loadPct: 0, habitConsistency: 0, goalAlignment: 0,
  estimationBias: { study: 1, health: 1, personal: 1, career: 1, other: 1 },
  heatmap: Array.from({ length: 7 }, () => Array<number>(24).fill(0)), fidelity: 0,
  updatedAt: "2026-09-30T00:00:00.000Z",
});

describe("nextQuestions", () => {
  it("returns the three least-known domains first with deterministic ties", () => {
    const questions = questionsForTwinState(blankTwin({ tasks: 0.8, habits: 0.7, routines: 0, mood: 0.2, goals: 0.1, planner: 0.2 }));
    expect(questions.map(q => q.domain)).toEqual(["routines", "goals", "energy"]);
    expect(questions).toEqual(questionsForTwinState(blankTwin({ tasks: 0.8, habits: 0.7, routines: 0, mood: 0.2, goals: 0.1, planner: 0.2 })));
    expect(questions.every(q => q.quickReplies.length === 3)).toBe(true);
  });

  it("returns a stable set from the LocalDataService contract", async () => {
    const storage = { getItem: () => null, setItem: () => undefined, removeItem: () => undefined } as unknown as Storage;
    const service = new LocalDataService(storage);
    const questions = await service.nextQuestions();
    expect(questions).toHaveLength(3);
    expect(await service.nextQuestions()).toEqual(questions);
  });
});
