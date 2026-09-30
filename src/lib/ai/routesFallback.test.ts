import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as extractPost } from "../../app/api/extract/route";
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
});
