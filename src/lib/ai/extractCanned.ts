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

const WORD_NUM: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };

/**
 * A long-range horizon for goals: "in the next 2 years", "within six months", "by 2028",
 * "by the end of the year", "this year", "next year". Returns an ISO date or undefined.
 */
export function goalHorizon(text: string, now = new Date()): string | undefined {
  const lower = text.toLowerCase();
  const rel = lower.match(/\b(?:in|within|over)\s+(?:the\s+)?(?:next|coming)?\s*(\d+|a|an|one|two|three|four|five|six|seven|eight|nine|ten)\s+(years?|months?|weeks?)\b/);
  if (rel) {
    const n = /^\d+$/.test(rel[1]) ? Number(rel[1]) : WORD_NUM[rel[1]] ?? 1;
    const d = new Date(now);
    if (rel[2].startsWith("year")) d.setFullYear(d.getFullYear() + n);
    else if (rel[2].startsWith("month")) d.setMonth(d.getMonth() + n);
    else d.setDate(d.getDate() + n * 7);
    d.setHours(9, 0, 0, 0);
    return d.toISOString();
  }
  const year = lower.match(/\b(?:by|in|before)\s+(?:the\s+end\s+of\s+)?(20\d\d)\b/);
  if (year) return new Date(Number(year[1]), 11, 31, 9).toISOString();
  if (/\b(?:by\s+the\s+end\s+of\s+(?:the|this)\s+year|this\s+year)\b/.test(lower)) return new Date(now.getFullYear(), 11, 31, 9).toISOString();
  if (/\bnext\s+year\b/.test(lower)) return new Date(now.getFullYear() + 1, 11, 31, 9).toISOString();
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
    // Goals: explicit words, or ambitions like "I want to be a ... in the next 2 years".
    const horizon = goalHorizon(sentence);
    if (/\b(goal|want to achieve|aim to|my target|i want to (?:be|become)|i'd like to (?:be|become)|i would like to (?:be|become)|my dream|i dream of|i hope to (?:be|become))\b/i.test(sentence) || (horizon && /\b(i want|i'd like|i would like|i hope|i plan)\b/i.test(sentence))) {
      add("goal", { title: sentence, ...(horizon ? { targetDate: horizon } : {}) });
    }
    if (/\b(habit|every day|daily|each morning|routine)\b/i.test(sentence)) add("habit", { title: sentence });
    if (/\b(i prefer|i like|works well for me|i work best|i (?:usually )?(?:focus|study|concentrate|work) (?:best|better)|i(?:'m| am) (?:most )?productive)\b/i.test(sentence)) add("preference", { preference: sentence });
  }
  return facts;
}

export default extractCanned;
