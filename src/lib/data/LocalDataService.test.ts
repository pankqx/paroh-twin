import { afterEach, describe, expect, it, vi } from "vitest";
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

describe("memory quality DataService methods", () => {
  it("returns consented conflicts, stale facts, and question-relevant approved facts", async () => {
    const storage = { getItem: () => null, setItem: () => undefined, removeItem: () => undefined } as unknown as Storage;
    const service = new LocalDataService(storage);
    await service.resetAll();
    const base = { kind: "preference" as const, category: "personal" as const, data: {}, sourceId: "test", sourceType: "journal" as const, status: "approved" as const, confidence: 0.9, createdAt: "2026-07-01T00:00:00.000Z", updatedAt: "2026-07-01T00:00:00.000Z" };
    await service.facts.upsert({ ...base, id: "morning", text: "I work best in the morning" });
    await service.facts.upsert({ ...base, id: "evening", text: "I work best in the evening", createdAt: "2026-07-02T00:00:00.000Z", updatedAt: "2026-07-02T00:00:00.000Z" });

    expect(await service.getConflicts()).toHaveLength(1);
    expect((await service.getStale()).map(fact => fact.id)).toEqual(["morning", "evening"]);
    expect((await service.retrieve("When do I work best in the evening?")).slice(0, 1).map(fact => fact.id)).toEqual(["evening"]);

    await service.setConsent({ ...(await service.getConsent()), journal: false });
    expect(await service.getConflicts()).toEqual([]);
    expect(await service.getStale()).toEqual([]);
    expect(await service.retrieve("work best evening")).toEqual([]);
  });
});

describe("parseWhatIf DataService contract", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("feeds parsed scenario plans through the TypeScript simulation", async () => {
    const storage = { getItem: () => null, setItem: () => undefined, removeItem: () => undefined } as unknown as Storage;
    const service = new LocalDataService(storage);
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init: RequestInit) => {
      const result = await (await import("../../app/api/parse-whatif/route")).POST(new Request("http://localhost/api/parse-whatif", init));
      return result;
    }));
    const parsed = await service.parseWhatIf("What if I finish the project tonight instead of revising for tomorrow's exam?");
    expect(parsed.scenarios).toHaveLength(2);
    expect(parsed.degraded).toBe(true);
    const simulated = await service.proposeScenarios("What if I finish the project tonight instead of revising for tomorrow's exam?");
    expect(simulated).toHaveLength(2);
    expect(simulated.every(scenario => scenario.assumptions.some(note => note.includes("500 seeded trials")))).toBe(true);
  });

  it("returns clarification instead of scenario plans for vague text", async () => {
    const storage = { getItem: () => null, setItem: () => undefined, removeItem: () => undefined } as unknown as Storage;
    const service = new LocalDataService(storage);
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init: RequestInit) => (await import("../../app/api/parse-whatif/route")).POST(new Request("http://localhost/api/parse-whatif", init))));
    await expect(service.parseWhatIf("Should I study?")).resolves.toMatchObject({ scenarios: [], clarify: expect.stringContaining("two options"), degraded: true });
    await expect(service.proposeScenarios("Should I study?")).resolves.toEqual([]);
  });
});
