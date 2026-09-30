import { afterEach, describe, expect, it, vi } from "vitest";
import { openRouterJson } from "./openRouter";

const previous = {
  key: process.env.OPENROUTER_API_KEY,
  model: process.env.OPENROUTER_MODEL,
  fallback: process.env.OPENROUTER_FALLBACK_MODEL,
  base: process.env.LLM_BASE_URL,
};

afterEach(() => {
  for (const [key, value] of Object.entries({ OPENROUTER_API_KEY: previous.key, OPENROUTER_MODEL: previous.model, OPENROUTER_FALLBACK_MODEL: previous.fallback, LLM_BASE_URL: previous.base })) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
  vi.unstubAllGlobals();
});

describe("OpenAI-compatible base URL", () => {
  it("supports a local endpoint without an API key", async () => {
    delete process.env.OPENROUTER_API_KEY;
    process.env.LLM_BASE_URL = "http://localhost:11434/v1/";
    process.env.OPENROUTER_MODEL = "qwen-local";
    delete process.env.OPENROUTER_FALLBACK_MODEL;
    const fetchMock = vi.fn(async () => Response.json({ choices: [{ message: { content: "{\"ok\":true}" } }] }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(openRouterJson([{ role: "user", content: "Return JSON" }])).resolves.toContain("ok");
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://localhost:11434/v1/chat/completions");
    expect(new Headers(init.headers).has("Authorization")).toBe(false);
  });

  it("tries the fallback model after the main model fails", async () => {
    process.env.OPENROUTER_API_KEY = "test-placeholder";
    process.env.OPENROUTER_MODEL = "main-model";
    process.env.OPENROUTER_FALLBACK_MODEL = "fallback-model";
    delete process.env.LLM_BASE_URL;
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response("", { status: 503 }))
      .mockResolvedValueOnce(Response.json({ choices: [{ message: { content: "{\"ok\":true}" } }] }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(openRouterJson([{ role: "user", content: "Return JSON" }])).resolves.toContain("ok");
    const models = fetchMock.mock.calls.map(([, init]) => JSON.parse(String((init as RequestInit).body)).model);
    expect(models).toEqual(["main-model", "fallback-model"]);
  });
});
