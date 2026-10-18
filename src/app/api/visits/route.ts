export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Anonymous page-visit counter. Stores one number, nothing about the visitor.
 *  - If Upstash / Vercel KV env vars exist, it uses that Redis (key "paroh:visits").
 *  - Otherwise it uses the free keyless counterapi.dev counter.
 * Any failure returns { count: null } so the site never breaks.
 */
const KEY = "paroh:visits";
const NAMESPACE = process.env.VISIT_COUNTER_NAMESPACE?.trim() || "paroh-twin-gateways-2026";

async function withTimeout(url: string, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    return await fetch(url, { ...init, cache: "no-store", signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function redisConfig(): { url: string; token: string } | undefined {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  return url && token ? { url: url.replace(/\/+$/, ""), token } : undefined;
}

async function redis(command: "incr" | "get"): Promise<number | null> {
  const config = redisConfig();
  if (!config) return null;
  const response = await withTimeout(`${config.url}/${command}/${encodeURIComponent(KEY)}`, {
    headers: { Authorization: `Bearer ${config.token}` },
  });
  if (!response.ok) return null;
  const body = (await response.json()) as { result?: unknown };
  const value = Number(body.result ?? 0);
  return Number.isFinite(value) ? value : null;
}

async function counterApi(action: "up" | ""): Promise<number | null> {
  const response = await withTimeout(`https://api.counterapi.dev/v1/${NAMESPACE}/visits${action ? `/${action}` : ""}`);
  if (!response.ok) return action ? null : 0; // a counter that was never hit reads as 0
  const body = (await response.json()) as { count?: unknown };
  const value = Number(body.count ?? 0);
  return Number.isFinite(value) ? value : null;
}

async function run(increment: boolean): Promise<number | null> {
  try {
    if (redisConfig()) return await redis(increment ? "incr" : "get");
    return await counterApi(increment ? "up" : "");
  } catch {
    return null;
  }
}

export async function GET() {
  return Response.json({ count: await run(false) }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST() {
  return Response.json({ count: await run(true) }, { headers: { "Cache-Control": "no-store" } });
}
