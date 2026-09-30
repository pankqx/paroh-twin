import type { Fact } from "../../../lib/types";
import { extractCanned } from "../../../lib/ai/extractCanned";
import { openRouterJson, parseJsonObject } from "../../../lib/ai/openRouter";
import type { TwinContext } from "../../../lib/ai/buildTwinContext";

export const runtime = "nodejs";

type Intent = "chat" | "whatif" | "journal" | "status" | "help";
interface FollowUp { text: string; domain?: string; quickReplies: string[] }

function detectIntent(text: string): Intent {
  if (/\bwhat if\b|\bshould i\b/i.test(text)) return "whatif";
  if (/\bhow is my week\b|\bhow's my week\b|\bhow am i\b|\bhow busy\b|\bmy load\b|\bstatus\b|\b(load|deadlines?|week's plan|planned capacity)\b/i.test(text)) return "status";
  if (/\b(help|what can you do|how do i)\b/i.test(text)) return "help";
  if (/\b(journal|remember this|write this down)\b/i.test(text)) return "journal";
  return "chat";
}

function cleanFollowUp(value: unknown, fallback?: FollowUp): FollowUp | undefined {
  if (!value || typeof value !== "object") return fallback;
  const candidate = value as Partial<FollowUp>;
  if (typeof candidate.text !== "string" || !candidate.text.trim()) return fallback;
  return {
    text: candidate.text.trim().slice(0, 180),
    ...(typeof candidate.domain === "string" ? { domain: candidate.domain.slice(0, 40) } : {}),
    quickReplies: Array.isArray(candidate.quickReplies) ? candidate.quickReplies.filter((reply): reply is string => typeof reply === "string").slice(0, 3).map(reply => reply.slice(0, 50)) : fallback?.quickReplies ?? [],
  };
}

function canned(input: { utterance: string; intent: Intent; followUp?: FollowUp; sourceId: string; allowCandidateFacts: boolean }) {
  const factSourceId = `converse-${input.sourceId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 48) || "voice"}`;
  const candidateFacts: Fact[] = input.allowCandidateFacts ? extractCanned(input.utterance, factSourceId, "question") : [];
  const prefix = input.intent === "whatif" ? "I can compare those options using your saved tasks and deadlines."
    : input.intent === "help" ? "I can help with planning, task estimates, deadlines, and what-if choices."
      : input.intent === "journal" ? "I can turn clear plans from this note into candidate facts for your review."
        : "I can help you plan the next step.";
  const reply = input.followUp ? `${prefix} ${input.followUp.text}` : prefix;
  return { reply, spoken: reply.trim().split(/\s+/).slice(0, 44).join(" "), ...(input.followUp ? { followUp: input.followUp } : {}), candidateFacts, intent: input.intent, ...(input.intent === "whatif" ? { whatIfPrompt: input.utterance } : {}), degraded: true };
}

export async function POST(request: Request) {
  let body: { utterance?: unknown; history?: unknown; intent?: unknown; context?: unknown; followUp?: unknown; quickReplies?: unknown; allowCandidateFacts?: unknown; sourceId?: unknown };
  try { body = await request.json(); } catch { return Response.json({ error: "Send a valid JSON body." }, { status: 400 }); }
  if (typeof body.utterance !== "string" || !body.utterance.trim() || body.utterance.length > 4000) return Response.json({ error: "Utterance must be between 1 and 4000 characters." }, { status: 400 });
  const utterance = body.utterance.trim();
  const intent = body.intent === "chat" || body.intent === "whatif" || body.intent === "journal" || body.intent === "status" || body.intent === "help" ? body.intent : detectIntent(utterance);
  const history = Array.isArray(body.history) ? body.history.filter(item => item && typeof item === "object" && ((item as { role?: unknown }).role === "twin" || (item as { role?: unknown }).role === "user") && typeof (item as { text?: unknown }).text === "string").slice(-8).map(item => ({ role: (item as { role: "twin" | "user" }).role, text: (item as { text: string }).text.slice(0, 500) })) : [];
  const rawContext = body.context && typeof body.context === "object" ? body.context as Partial<TwinContext> : {};
  const context: TwinContext = {
    approvedFacts: Array.isArray(rawContext.approvedFacts) ? rawContext.approvedFacts.filter(fact => fact && typeof fact.id === "string" && typeof fact.text === "string").slice(0, 12) : [],
    ...(typeof rawContext.habitConsistency === "number" ? { habitConsistency: rawContext.habitConsistency } : {}),
    ...(rawContext.estimationBias && typeof rawContext.estimationBias === "object" ? { estimationBias: rawContext.estimationBias } : {}),
    ...(rawContext.averages && typeof rawContext.averages === "object" ? { averages: rawContext.averages } : {}),
  };
  const offeredFollowUp = cleanFollowUp(body.followUp);
  const sourceId = typeof body.sourceId === "string" ? body.sourceId : utterance;
  const fallbackInput = { utterance, intent, followUp: offeredFollowUp, sourceId, allowCandidateFacts: body.allowCandidateFacts === true };
  if (intent === "status") return Response.json(canned({ ...fallbackInput, followUp: undefined }));

  const messages = [
    { role: "system", content: "You are the student's digital twin. Speak to the student in first person, warmly and briefly. Help with productivity and planning only; never use therapy or mental-health wording. Never invent numbers. Ask at most one follow-up question, focusing on the lowest-confidence domain or a follow-up to the last answer. Use the provided question when it fits. Return JSON only as {\"reply\":\"...\",\"spoken\":\"under 45 words\",\"followUp\":{\"text\":\"...\",\"domain\":\"...\",\"quickReplies\":[\"...\"]}}; followUp may be null." },
    { role: "user", content: JSON.stringify({ intent, utterance, history, approvedTwinContext: context, nextQuestion: offeredFollowUp ?? null }) },
  ] as const;
  const raw = await openRouterJson([...messages], value => {
    const reply = typeof value.reply === "string" ? value.reply.trim() : "";
    const spoken = typeof value.spoken === "string" ? value.spoken.trim() : "";
    const followUp = value.followUp;
    const followUpText = followUp && typeof followUp === "object" && typeof (followUp as { text?: unknown }).text === "string" ? (followUp as { text: string }).text : "";
    const spokenWords = spoken.split(/\s+/).filter(Boolean).length;
    return Boolean(reply && spoken && spokenWords < 45 && !/\d/.test(`${reply} ${spoken}`) && (!followUpText || !/\d/.test(followUpText)));
  }, 10_000);
  const parsed = raw ? parseJsonObject(raw) : undefined;
  const reply = typeof parsed?.reply === "string" ? parsed.reply.trim() : "";
  const spoken = typeof parsed?.spoken === "string" ? parsed.spoken.trim() : "";
  if (!reply || !spoken || spoken.split(/\s+/).filter(Boolean).length >= 45 || /\d/.test(`${reply} ${spoken}`)) return Response.json(canned(fallbackInput));
  return Response.json({
    reply,
    spoken,
    ...(cleanFollowUp(parsed?.followUp, offeredFollowUp) ? { followUp: cleanFollowUp(parsed?.followUp, offeredFollowUp) } : {}),
    candidateFacts: fallbackInput.allowCandidateFacts ? extractCanned(utterance, `converse-${sourceId.slice(0, 48)}`, "question") : [],
    intent,
    ...(intent === "whatif" ? { whatIfPrompt: utterance } : {}),
    degraded: false,
  });
}
