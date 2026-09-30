import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as extractPost } from "../../app/api/extract/route";
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

  it("returns canned what-if scenarios when the API key is unset", async () => {
    const now = new Date();
    const tasks = [
      { id: "exam-task", title: "Revise for biology exam", category: "study", estHours: 2, dueAt: new Date(now.getTime() + 2 * 86400000).toISOString(), done: false, createdAt: now.toISOString(), updatedAt: now.toISOString() },
      { id: "project-task", title: "Finish project discussion", category: "study", estHours: 2, dueAt: new Date(now.getTime() + 4 * 86400000).toISOString(), done: false, createdAt: now.toISOString(), updatedAt: now.toISOString() },
    ];
    const response = await parseWhatIfPost(new Request("http://localhost/api/parse-whatif", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "What if I finish the project tonight instead of revising for tomorrow's exam?", context: { approvedFacts: [] }, tasks }),
    }));
    const result = await response.json();
    expect(process.env.OPENROUTER_API_KEY).toBeUndefined();
    expect(result.degraded).toBe(true);
    expect(result.scenarios).toHaveLength(2);
    expect(result.scenarios[0].tasks[0]).toMatchObject({ taskId: "project-task", hours: 2 });
  });

  it("asks one clarification for a vague what-if", async () => {
    const response = await parseWhatIfPost(new Request("http://localhost/api/parse-whatif", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "Should I study?", context: { approvedFacts: [] }, tasks: [] }),
    }));
    const result = await response.json();
    expect(result.scenarios).toEqual([]);
    expect(result.clarify).toMatch(/two options/i);
    expect(result.degraded).toBe(true);
  });
});
