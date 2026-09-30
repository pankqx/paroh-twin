export interface ChatMessage {
  role: "system" | "user";
  content: string;
}

/** Server route helper. Never expose environment credentials through its result. */
export async function openRouterJson(
  messages: ChatMessage[],
  accept: (value: Record<string, unknown>) => boolean = () => true,
  timeoutMs = 12_000,
): Promise<string | undefined> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const customBaseUrl = process.env.LLM_BASE_URL?.trim();
  if (!apiKey && !customBaseUrl) return undefined;
  const baseUrl = (customBaseUrl || "https://openrouter.ai/api/v1").replace(/\/+$/, "");
  const endpoint = baseUrl.endsWith("/chat/completions") ? baseUrl : `${baseUrl}/chat/completions`;

  const models = [...new Set([process.env.OPENROUTER_MODEL, process.env.OPENROUTER_FALLBACK_MODEL].filter((model): model is string => Boolean(model?.trim())))];
  for (const model of models) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}), "Content-Type": "application/json" },
        body: JSON.stringify({ model, messages, response_format: { type: "json_object" } }),
        signal: controller.signal,
      });
      if (!response.ok) continue;
      const payload: unknown = await response.json();
      if (!payload || typeof payload !== "object") continue;
      const choices = (payload as { choices?: Array<{ message?: { content?: unknown } }> }).choices;
      const content = choices?.[0]?.message?.content;
      if (typeof content === "string" && content.trim()) {
        const parsed = parseJsonObject(content);
        if (parsed && accept(parsed)) return content;
      }
    } catch {
      // Try the fallback model; errors intentionally omit request headers and credentials.
    } finally {
      clearTimeout(timeout);
    }
  }
  return undefined;
}

export function parseJsonObject(content: string): Record<string, unknown> | undefined {
  try {
    const parsed: unknown = JSON.parse(content.trim().replace(/^```(?:json)?\s*|\s*```$/g, ""));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : undefined;
  } catch {
    return undefined;
  }
}
