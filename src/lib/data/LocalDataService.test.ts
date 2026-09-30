import { afterEach, describe, expect, it, vi } from "vitest";
import type { TwinState } from "../types";
import { LocalDataService, questionsForTwinState } from "./LocalDataService";
import { connectorSamples } from "../../mock/connectorSamples";
import { buildTwinContext } from "../ai/buildTwinContext";

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

describe("route payload previews", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("shrinks with consent off and previews the exact extract and explain request bodies", async () => {
    const storage = { getItem: () => null, setItem: () => undefined, removeItem: () => undefined } as unknown as Storage;
    const service = new LocalDataService(storage);
    const extractInput = { text: "I will revise biology tonight", source: "journal" as const, sourceId: "preview-entry" };
    const full = await service.previewPayload("extract", extractInput);
    await service.setConsent({ ...(await service.getConsent()), mood: false });
    const withoutMood = await service.previewPayload("extract", extractInput);
    expect(withoutMood.text.length).toBeLessThan(full.text.length);

    const bodies: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init: RequestInit) => {
      bodies.push(String(init.body));
      return Response.json({ facts: [] });
    }));
    await service.extractFacts(extractInput);
    expect(JSON.parse(withoutMood.text)).toEqual(JSON.parse(bodies[0]));

    const now = new Date().toISOString();
    const scenario = { id: "s1", label: "Study", summary: "Study now", onTimeProb: 0.8, peakLoad: 0.3, goalImpact: 0, assumptions: [] };
    await service.decisions.upsert({ id: "decision-preview", prompt: "Study?", scenarios: [scenario], recommendedId: "s1", predictedChoiceId: "s1", createdAt: now, updatedAt: now });
    const preview = await service.previewPayload("explain", "decision-preview");
    await service.explain("decision-preview");
    expect(JSON.parse(preview.text)).toEqual(JSON.parse(bodies[1]));
  });
});

describe("connector previews", () => {
  it("extracts pending candidates from three sample messages per connector", async () => {
    const storage = { getItem: () => null, setItem: () => undefined, removeItem: () => undefined } as unknown as Storage;
    const service = new LocalDataService(storage);

    for (const kind of ["gmail", "whatsapp", "telegram", "calendar"] as const) {
      expect(connectorSamples[kind]).toHaveLength(3);
      const candidates = await service.previewConnector(kind);
      expect(candidates.length).toBeGreaterThan(0);
      expect(candidates.every(fact => fact.status === "pending")).toBe(true);
      expect(candidates.every(fact => fact.sourceId === `sample-${kind}`)).toBe(true);
      expect(candidates.every(fact => fact.sourceType === "journal")).toBe(true);
    }
  });
});

describe("approved fact conflicts", () => {
  it("keeps the newer same-subject fact current and marks the old one superseded", async () => {
    const storage = { getItem: () => null, setItem: () => undefined, removeItem: () => undefined } as unknown as Storage;
    const service = new LocalDataService(storage);
    const now = new Date().toISOString();
    const base = { kind: "preference" as const, category: "study" as const, sourceId: "test", sourceType: "manual" as const, status: "approved" as const, confidence: 0.9, createdAt: now, updatedAt: now };
    await service.facts.upsert({ ...base, id: "old-focus", text: "I work best in the morning", data: {} });
    await service.facts.upsert({ ...base, id: "new-focus", text: "I work best in the evening", data: {}, status: "pending" });

    const current = await service.setFactStatus("new-focus", "approve");
    const older = await service.facts.get("old-focus");
    expect(current.data.changedFrom).toBe("I work best in the morning");
    expect(older?.data.supersededBy).toBe("new-focus");
    const context = await buildTwinContext(await service.getConsent(), service);
    expect(context.approvedFacts.map(fact => fact.id)).not.toContain("old-focus");
    expect(context.approvedFacts.map(fact => fact.id)).toContain("new-focus");
  });
});

describe("stale decisions", () => {
  it("flags decisions followed by an approved deadline or task fact", async () => {
    const storage = { getItem: () => null, setItem: () => undefined, removeItem: () => undefined } as unknown as Storage;
    const service = new LocalDataService(storage);
    const scenarios = [{ id: "s", label: "Study", summary: "Study", onTimeProb: 0.5, peakLoad: 0.5, goalImpact: 0, assumptions: [] }];
    await service.decisions.upsert({ id: "old-decision", prompt: "Study or project?", scenarios, recommendedId: "s", predictedChoiceId: "s", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" });
    await service.facts.upsert({ id: "new-deadline", kind: "deadline", text: "Biology exam is tomorrow", category: "study", data: { title: "Biology exam", due: "2026-10-02T09:00:00.000Z" }, sourceId: "journal", sourceType: "journal", status: "approved", confidence: 0.9, createdAt: "2026-02-01T00:00:00.000Z", updatedAt: "2026-02-01T00:00:00.000Z" });
    expect(await service.staleDecisionIds()).toContain("old-decision");
  });
});

describe("converse", () => {
  afterEach(() => vi.unstubAllGlobals());
  const makeService = () => {
    const storage = { getItem: () => null, setItem: () => undefined, removeItem: () => undefined } as unknown as Storage;
    return new LocalDataService(storage);
  };

  it("builds status numbers from the current twin state", async () => {
    const service = makeService();
    await service.resetAll();
    const now = new Date();
    const dueAt = new Date(now.getTime() + 86400000).toISOString();
    await service.tasks.upsert({ id: "upcoming", title: "Biology revision", category: "study", estHours: 2, dueAt, done: false, createdAt: now.toISOString(), updatedAt: now.toISOString() });
    const twin = await service.getTwinState();
    const answer = await service.converse({ utterance: "How is my week and load?", history: [] });
    expect(answer.intent).toBe("status");
    expect(answer.spoken).toContain(`${Math.round(twin.loadPct)}%`);
    expect(answer.spoken).toContain("1 open deadline");
  });

  it("returns a canned answer instead of throwing when the route fails", async () => {
    const service = makeService();
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
    await expect(service.converse({ utterance: "Should I revise tonight?", history: [] })).resolves.toMatchObject({
      intent: "whatif", degraded: true, whatIfPrompt: "Should I revise tonight?", candidateFacts: [],
    });
  });

  it("answers locally and makes no route call when a required category is off", async () => {
    const service = makeService();
    await service.setConsent({ ...(await service.getConsent()), tasks: false });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const result = await service.converse({ utterance: "How is my study load this week?", history: [] });
    expect(result.reply).toBe("That's outside what you've allowed me to use.");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
