import type { Category, Fact, FactKind } from "../types";

const createFact = (id: number, kind: FactKind, text: string, category: Category, data: Record<string, unknown>, sourceId: string, source: "journal" | "question"): Fact => {
  const now = new Date().toISOString();
  return { id: `${sourceId}-fact-${id}`, kind, text: text.trim(), category, data, sourceId, sourceType: source, status: "pending", confidence: 0.78, createdAt: now, updatedAt: now };
};

function explicitDate(text: string): string | undefined {
  const monthMatch = text.match(/\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?\b/i);
  if (monthMatch) {
    const date = new Date(`${monthMatch[1]} ${monthMatch[2]}, ${new Date().getUTCFullYear()} 09:00:00 UTC`);
    if (date.getTime() < Date.now() - 86400000) date.setUTCFullYear(date.getUTCFullYear() + 1);
    return date.toISOString();
  }
  if (/\btomorrow\b/i.test(text)) { const d = new Date(); d.setUTCDate(d.getUTCDate() + 1); d.setUTCHours(9, 0, 0, 0); return d.toISOString(); }
  return undefined;
}

/** Keyword and explicit-date extraction only; this does not infer feelings or diagnoses. */
export function extractCanned(text: string, sourceId: string, source: "journal" | "question" = "journal"): Fact[] {
  const chunks = text.split(/(?<=[.!?\n])\s+/).map(s => s.trim()).filter(Boolean);
  const facts: Fact[] = [];
  for (const sentence of chunks) {
    const lower = sentence.toLowerCase();
    const date = explicitDate(sentence);
    const dueMention = /\b(due|deadline|exam|test|submit|by tomorrow)\b/.test(lower);
    const hours = sentence.match(/\b(\d+(?:\.\d+)?)\s*hours?\b/i);
    const category: Category = /exam|study|revise|class|project|homework|assignment/.test(lower) ? "study" : /walk|sleep|run|exercise/.test(lower) ? "health" : "personal";
    const add = (kind: FactKind, payload: Record<string, unknown> = {}) => facts.push(createFact(facts.length + 1, kind, sentence, category, payload, sourceId, source));
    if (dueMention) {
      if (/\b(exam|test)\b/.test(lower)) add("deadline", { title: sentence, due: date });
      else add("deadline", { title: sentence, due: date });
    }
    if (/\b(i will|i need to|i plan to|i have to|finish|complete|work on|revise|review|study|submit)\b/i.test(sentence)) {
      add("task", { title: sentence.replace(/^(i will|i need to|i plan to|i have to)\s+/i, ""), ...(hours ? { estHours: Number(hours[1]) } : {}), ...(date ? { due: date } : {}) });
    }
    if (/\b(goal|want to achieve|aim to|my target)\b/i.test(sentence)) add("goal", { title: sentence });
    if (/\b(habit|every day|daily|each morning|routine)\b/i.test(sentence)) add("habit", { title: sentence });
    if (/\b(i prefer|i like|works well for me|i work best|i (?:usually )?(?:focus|study|concentrate|work) (?:best|better)|i(?:'m| am) (?:most )?productive)\b/i.test(sentence)) add("preference", { preference: sentence });
  }
  return facts;
}

export default extractCanned;
