import type { Category, ConsentSettings, FactKind } from "../../../lib/types";
import { extractCanned } from "../../../lib/ai/extractCanned";
import { openRouterJson, parseJsonObject } from "../../../lib/ai/openRouter";
import { buildTwinContext, type TwinContext } from "../../../lib/ai/buildTwinContext";

export const runtime = "nodejs";

const factKinds = new Set<FactKind>(["task", "goal", "habit", "routine", "preference", "deadline", "decision"]);
const categories = new Set<Category>(["study", "health", "personal", "career", "other"]);
interface ExtractedFact { kind: FactKind; text: string; category: Category; data: Record<string, unknown>; confidence: number }

function normalizedFacts(value: unknown, originalText: string): ExtractedFact[] | undefined {
  if (!value || typeof value !== "object" || !Array.isArray((value as { facts?: unknown }).facts)) return undefined;
  const facts = (value as { facts: unknown[] }).facts;
  if (facts.some(item => !item || typeof item !== "object")) return undefined;
  const result: ExtractedFact[] = [];
  for (const item of facts as Array<Record<string, unknown>>) {
    if (!factKinds.has(item.kind as FactKind) || !categories.has(item.category as Category) || typeof item.text !== "string") return undefined;
    const text = item.text.trim();
    // Requiring a direct quote keeps the model from paraphrasing into an interpretation.
    if (!text || !originalText.includes(text)) return undefined;
    const data = item.data && typeof item.data === "object" && !Array.isArray(item.data) ? item.data as Record<string, unknown> : {};
    const confidence = typeof item.confidence === "number" && Number.isFinite(item.confidence) ? Math.max(0, Math.min(1, item.confidence)) : 0.65;
    result.push({ kind: item.kind as FactKind, text, category: item.category as Category, data, confidence });
  }
  return result;
}

function safeContext(value: unknown): TwinContext | undefined {
  if (!value || typeof value !== "object") return undefined;
  const context = value as Partial<TwinContext>;
  return {
    approvedFacts: Array.isArray(context.approvedFacts) ? context.approvedFacts.filter(fact => fact && typeof fact.id === "string" && typeof fact.text === "string").slice(0, 12) : [],
    ...(typeof context.habitConsistency === "number" ? { habitConsistency: context.habitConsistency } : {}),
    ...(context.estimationBias && typeof context.estimationBias === "object" ? { estimationBias: context.estimationBias } : {}),
    ...(context.averages && typeof context.averages === "object" ? { averages: context.averages } : {}),
  };
}

export async function POST(request: Request) {
  let body: { text?: unknown; source?: unknown; sourceId?: unknown; consent?: unknown; context?: unknown };
  try { body = await request.json(); } catch { return Response.json({ error: "Send a valid JSON body." }, { status: 400 }); }
  if (typeof body.text !== "string" || !body.text.trim() || body.text.length > 12000) return Response.json({ error: "Text must be between 1 and 12000 characters." }, { status: 400 });
  const inputText = body.text;
  const source = body.source === "question" ? "question" : body.source === "journal" ? "journal" : undefined;
  if (!source) return Response.json({ error: "Source must be journal or question." }, { status: 400 });
  const sourceId = typeof body.sourceId === "string" ? body.sourceId.slice(0, 120) : "unknown-source";
  const context = safeContext(body.context) ?? (body.consent && typeof body.consent === "object" ? await buildTwinContext(body.consent as ConsentSettings) : undefined);
  const today = new Date().toISOString().slice(0, 10);
  const messages = [
    { role: "system", content: `Extract explicit student productivity facts. Return only JSON matching {"facts":[{"kind":"task|goal|habit|routine|preference|deadline|decision","text":"exact quote from the input","category":"study|health|personal|career|other","data":{},"confidence":0.0}]}. Extract only what the text states. Do not infer, interpret emotion, or produce clinical or mental-health content. Keep text as an exact quote from the input. Resolve explicit relative dates using today=${today} to ISO-8601 dates; omit dates that are not stated.` },
    { role: "user", content: JSON.stringify({ source, text: inputText, approvedTwinContext: context }) },
  ] as const;
  const content = await openRouterJson([...messages], value => normalizedFacts(value, inputText) !== undefined);
  const parsed = content ? parseJsonObject(content) : undefined;
  const facts = parsed ? normalizedFacts(parsed, inputText) : undefined;
  if (facts) return Response.json({ facts, degraded: false });

  const canned = extractCanned(inputText, sourceId, source).map(({ kind, text, category, data, confidence }) => ({ kind, text, category, data, confidence }));
  return Response.json({ facts: canned, degraded: true });
}
