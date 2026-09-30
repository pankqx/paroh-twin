import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as extractPost } from "../../app/api/extract/route";
import { POST as conversePost } from "../../app/api/converse/route";
import { POST as parseWhatIfPost } from "../../app/api/parse-whatif/route";
import { LocalDataService } from "../data/LocalDataService";

const originalKey = process.env.OPENROUTER_API_KEY;
const storage = { getItem: () => null, setItem: () => undefined, removeItem: () => undefined } as unknown as Storage;

beforeEach(() => { delete process.env.OPENROUTER_API_KEY; });
afterEach(() => {
  if (originalKey === undefined) delete process.env.OPENROUTER_API_KEY;
  else process.env.OPENROUTER_API_KEY = originalKey;
  vi.unstubAllGlobals();
});

describe("OpenRouter route fallback", () => {
  it("returns one clarification for a vague what-if without scenarios", async () => {
    const response = await parseWhatIfPost(new Request("http://localhost/api/parse-whatif", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "Should I study?", tasks: [] }),
    }));
    const result = await response.json();
    expect(result.specs).toHaveLength(1);
    expect(result.specs[0].needsInfo).toContain("What two options");
    expect(result.specs[0].tasks).toEqual([]);
  });

  it("uses canned what-if specs when the API key is unset", async () => {
    const now = new Date();
    const tasks = [
      { id: "project", title: "Edit project discussion", category: "study", dueAt: new Date(now.getTime() + 4 * 86400000).toISOString(), estHours: 2, done: false, createdAt: now.toISOString(), updatedAt: now.toISOString() },
      { id: "exam", title: "Revise for biology exam", category: "study", dueAt: new Date(now.getTime() + 2 * 86400000).toISOString(), estHours: 2, done: false, createdAt: now.toISOString(), updatedAt: now.toISOString() },
    ];
    const response = await parseWhatIfPost(new Request("http://localhost/api/parse-whatif", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "What if I finish the project tonight instead of revising for tomorrow's exam?", tasks }),
    }));
    const result = await response.json();
    expect(result.degraded).toBe(true);
    expect(result.specs).toHaveLength(2);
    expect(result.specs.every((spec: { summary: string }) => spec.summary.includes("Horizon: next two days"))).toBe(true);
    expect(process.env.OPENROUTER_API_KEY).toBeUndefined();
  });

  it("extracts and saves canned facts when the API key is unset", async () => {
    vi.stubGlobal("fetch", vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      return extractPost(new Request("http://localhost/api/extract", init));
    }));
    const service = new LocalDataService(storage);
    await service.resetAll();

    const facts = await service.extractFacts({ text: "My biology exam is tomorrow.", source: "journal", sourceId: "no-key-entry" });

    expect(process.env.OPENROUTER_API_KEY).toBeUndefined();
    expect(facts.some(fact => fact.kind === "deadline" && fact.status === "pending")).toBe(true);
    expect(await service.facts.list()).toHaveLength(facts.length);
  });

  it("returns canned converse text and pending facts when the API key is unset", async () => {
    const response = await conversePost(new Request("http://localhost/api/converse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ utterance: "I will revise biology for 2 hours tomorrow.", intent: "chat", followUp: { text: "When do you usually focus best?", domain: "routines", quickReplies: ["Morning"] }, allowCandidateFacts: true, sourceId: "test" }),
    }));
    const result = await response.json();
    expect(result.degraded).toBe(true);
    expect(result.followUp.text).toContain("focus best");
    expect(result.candidateFacts.some((fact: { kind: string; status: string }) => fact.kind === "task" && fact.status === "pending")).toBe(true);
  });
});
