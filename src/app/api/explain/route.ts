import type { ConsentSettings, Scenario } from "../../../lib/types";
import { openRouterJson, parseJsonObject } from "../../../lib/ai/openRouter";
import { buildTwinContext, type TwinContext } from "../../../lib/ai/buildTwinContext";

export const runtime = "nodejs";

interface ApprovedFact { id: string; kind: string; text: string }
interface ExplainInput {
  scenarios?: unknown;
  recommendedId?: unknown;
  approvedFacts?: unknown;
  context?: unknown;
  consent?: unknown;
}

function validScenarios(value: unknown): Scenario[] | undefined {
  if (!Array.isArray(value) || !value.length || value.length > 4) return undefined;
  if (value.some(item => !item || typeof item !== "object" || typeof item.id !== "string" || typeof item.label !== "string" || typeof item.summary !== "string" || typeof item.onTimeProb !== "number" || typeof item.peakLoad !== "number" || typeof item.goalImpact !== "number" || !Array.isArray(item.assumptions))) return undefined;
  return value as Scenario[];
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

function safeFacts(value: unknown, allowedIds: Set<string>): ApprovedFact[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is ApprovedFact => Boolean(item && typeof item === "object" && typeof item.id === "string" && allowedIds.has(item.id) && typeof item.text === "string"));
}

function spokenUnder60(text: string): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  return words.slice(0, 55).join(" ");
}

function hasUnverifiedNumber(text: string, scenarios: Scenario[]): boolean {
  const supplied = new Set(scenarios.flatMap(scenario => JSON.stringify(scenario).match(/\d+(?:\.\d+)?/g) ?? []));
  const spokenNumbers = text.match(/\d+(?:\.\d+)?/g) ?? [];
  if (spokenNumbers.some(number => !supplied.has(number))) return true;
  // Ask for qualitative wording; a spelled-out numerical claim has no safe provenance.
  return /\b(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|first|second|third|fourth|fifth|hundred|thousand|million)\b/i.test(text);
}

function cannedExplanation(scenarios: Scenario[], recommendedId: string, usedFactIds: string[]) {
  const recommended = scenarios.find(scenario => scenario.id === recommendedId) ?? scenarios[0];
  const other = scenarios.find(scenario => scenario.id !== recommended.id);
  const text = other
    ? `${recommended.label} fits the current comparison. ${recommended.summary} Compared with ${other.label.toLowerCase()}, this plan follows the selected priority.`
    : `${recommended.label} fits the current comparison. ${recommended.summary}`;
  return { text, spoken: spokenUnder60(text), usedFactIds, degraded: true };
}

export async function POST(request: Request) {
  let body: ExplainInput;
  try { body = await request.json() as ExplainInput; } catch { return Response.json({ error: "Send a valid JSON body." }, { status: 400 }); }
  const scenarios = validScenarios(body.scenarios);
  if (!scenarios) return Response.json({ error: "Provide computed scenario results." }, { status: 400 });
  const recommendedId = typeof body.recommendedId === "string" && scenarios.some(scenario => scenario.id === body.recommendedId)
    ? body.recommendedId
    : scenarios[0].id;
  const context = safeContext(body.context) ?? (body.consent && typeof body.consent === "object" ? await buildTwinContext(body.consent as ConsentSettings) : undefined);
  const allowedFacts = safeFacts(body.approvedFacts ?? context?.approvedFacts, new Set((context?.approvedFacts ?? []).map(fact => fact.id)));
  const usedFactIds = allowedFacts.map(fact => fact.id);
  const messages = [
    { role: "system", content: "Explain the supplied computed comparison in 2-4 plain sentences. Return only JSON {\"text\":\"...\",\"spoken\":\"...\"}. Use only the supplied scenarios and approved facts. Do not add or calculate numbers; use qualitative wording only. Do not make emotional or clinical interpretations. Keep spoken under 60 words." },
    { role: "user", content: JSON.stringify({ scenarios, recommendedId, approvedFacts: allowedFacts, twinContext: context }) },
  ] as const;
  const content = await openRouterJson([...messages], value => {
    const proposedText = typeof value.text === "string" ? value.text.trim() : "";
    const proposedSpoken = typeof value.spoken === "string" ? value.spoken.trim() : proposedText;
    return Boolean(proposedText && proposedSpoken && !hasUnverifiedNumber(`${proposedText} ${proposedSpoken}`, scenarios));
  });
  const parsed = content ? parseJsonObject(content) : undefined;
  const text = typeof parsed?.text === "string" ? parsed.text.trim() : "";
  const proposedSpoken = typeof parsed?.spoken === "string" ? parsed.spoken.trim() : text;
  const combined = `${text} ${proposedSpoken}`;
  if (!text || !proposedSpoken || hasUnverifiedNumber(combined, scenarios)) return Response.json(cannedExplanation(scenarios, recommendedId, usedFactIds));
  return Response.json({ text, spoken: spokenUnder60(proposedSpoken), usedFactIds, degraded: false });
}
