import { describe, expect, it } from "vitest";
import type { Decision, Task } from "../types";
import { estimationBias, load } from "./index";
import { recordChoice, simulate } from "./scenarios";
import { LocalDataService } from "../data/LocalDataService";

const task = (id: string, patch: Partial<Task> = {}): Task => ({ id, title: id, category: "study", estHours: 1, actualHours: 1.3, done: true,
  createdAt: "2026-09-20T09:00:00.000Z", updatedAt: "2026-09-20T09:00:00.000Z", ...patch });

describe("twin calculations", () => {
  it("uses the mean actual to estimate ratio after three completed samples", () => {
    const bias = estimationBias([task("a", { actualHours: 1.2 }), task("b", { actualHours: 1.3 }), task("c", { actualHours: 1.4 })]);
    expect(bias.study).toBeCloseTo(1.3);
    expect(bias.health).toBe(1);
  });

  it("weights due workload by category bias over a seven day capacity", () => {
    const tasks = [task("a", { actualHours: 1.3 }), task("b", { actualHours: 1.3 }), task("c", { actualHours: 1.3 }),
      task("open", { done: false, actualHours: undefined, estHours: 2, dueAt: "2026-09-30T18:00:00.000Z" })];
    expect(load(tasks, new Date("2026-09-30T00:00:00.000Z"))).toBeCloseTo((2 * 1.3 / 28) * 100);
  });

  it("returns repeatable Monte Carlo results for the same seed", () => {
    const spec = { id: "branch", label: "Study", summary: "Study now", tasks: [{ title: "Read", hours: 2, dueAt: "2026-10-01T09:00:00.000Z" }], priority: "deadline" as const };
    const data = { tasks: [task("a", { actualHours: 1.2 }), task("b", { actualHours: 1.3 }), task("c", { actualHours: 1.4 })], goals: [], habits: [], checkins: [], decisions: [], now: "2026-09-30T09:00:00.000Z" };
    expect(simulate(spec, data, 123)).toEqual(simulate(spec, data, 123));
    expect(simulate(spec, data, 123).assumptions[0]).toContain("500 seeded trials");
  });

  it("raises task domain confidence and records an approved fact in memory", async () => {
    const storage = { getItem: () => null, setItem: () => undefined, removeItem: () => undefined } as unknown as Storage;
    const service = new LocalDataService(storage);
    await service.resetAll();
    const before = await service.getTwinState();
    const now = new Date().toISOString();
    await service.facts.upsert({ id: "fact-1", kind: "task", text: "Review notes", category: "study", data: { title: "Review notes", estHours: 2 }, sourceId: "entry", sourceType: "journal", status: "pending", confidence: 0.9, createdAt: now, updatedAt: now });
    await service.setFactStatus("fact-1", "approve");
    const after = await service.getTwinState();
    expect(after.confidenceByDomain.tasks).toBeGreaterThan(before.confidenceByDomain.tasks);
    expect(await service.memories?.list()).toHaveLength(1);
    expect((await service.tasks.list()).some(t => t.title === "Review notes")).toBe(true);
  });

  it("reports feedback delta and learns a near-exam preference", () => {
    const scenarios = [
      { id: "exam", label: "Revise for exam", summary: "Exam revision", onTimeProb: 0.8, peakLoad: 0.5, goalImpact: 0, assumptions: [] },
      { id: "project", label: "Finish project", summary: "Project work", onTimeProb: 0.7, peakLoad: 0.4, goalImpact: 0.2, assumptions: [] },
    ];
    const decisions: Decision[] = ["a", "b"].map(id => ({ id, prompt: "What if finish project instead of revising for tomorrow's exam?", scenarios, recommendedId: "project", predictedChoiceId: "project", chosenScenarioId: "exam", createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-01T00:00:00.000Z" }));
    decisions.push({ id: "c", prompt: "What if project tonight or revise for tomorrow's exam?", scenarios, recommendedId: "exam", predictedChoiceId: "exam", createdAt: "2026-09-02T00:00:00.000Z", updatedAt: "2026-09-02T00:00:00.000Z" });
    const result = recordChoice(decisions, "c", "accept", "exam");
    expect(result.fidelityBefore).toBe(0);
    expect(result.fidelityAfter).toBeCloseTo(1 / 3);
    expect(result.learned).toContain("You prefer exam-first when an exam is under 48h away.");
    expect(result.nextPrediction).toBe("exam");
  });
});
