import { afterEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "./route";

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("/api/visits", () => {
  it("increments the keyless counter on POST and reads it on GET", async () => {
    const fetchMock = vi.fn().mockImplementation(async () => new Response(JSON.stringify({ count: 42 })));
    vi.stubGlobal("fetch", fetchMock);
    expect(await (await POST()).json()).toEqual({ count: 42 });
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/visits\/up$/);
    expect(await (await GET()).json()).toEqual({ count: 42 });
    expect(fetchMock.mock.calls[1][0]).toMatch(/\/visits$/);
  });

  it("uses Redis when configured", async () => {
    vi.stubEnv("KV_REST_API_URL", "https://redis.example");
    vi.stubEnv("KV_REST_API_TOKEN", "t");
    const fetchMock = vi.fn().mockImplementation(async () => new Response(JSON.stringify({ result: 7 })));
    vi.stubGlobal("fetch", fetchMock);
    expect(await (await POST()).json()).toEqual({ count: 7 });
    expect(fetchMock.mock.calls[0][0]).toContain("https://redis.example/incr/");
  });

  it("returns null instead of failing when the counter is down", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    expect(await (await POST()).json()).toEqual({ count: null });
  });
});
