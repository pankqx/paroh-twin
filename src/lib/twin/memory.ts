import type { ConsentSettings, Fact } from "../types";

const timeWords = new Set(["morning", "mornings", "afternoon", "afternoons", "evening", "evenings", "night", "nights", "early", "late"]);
const commonWords = new Set(["i", "my", "we", "our", "usually", "often", "sometimes", "prefer", "like", "work", "works", "focus", "best", "in", "at", "the", "a", "an", "to", "for", "on", "is", "are", "am", "be"]);
const words = (text: string) => text.toLowerCase().match(/[a-z0-9]+/g) ?? [];

function subjectKey(fact: Fact): string {
  const text = String(fact.data.subject ?? fact.data.title ?? fact.text);
  const normalized = words(text).filter(word => !timeWords.has(word) && !commonWords.has(word) && !/^\d+(?:\.\d+)?$/.test(word));
  if (/\b(work|works|focus) best\b/i.test(text)) normalized.unshift("focus");
  return [...new Set(normalized)].sort().join(" ");
}

export interface FactConflict {
  kind: Fact["kind"];
  subject: string;
  facts: Fact[];
}

/** Groups same-kind facts that describe the same subject but contain distinct claims. */
export function detectConflicts(facts: Fact[]): FactConflict[] {
  const groups = new Map<string, { kind: Fact["kind"]; subject: string; facts: Fact[] }>();
  for (const fact of facts) {
    if (fact.status !== "approved" || typeof fact.data.supersededBy === "string") continue;
    const subject = subjectKey(fact);
    if (!subject) continue;
    const key = `${fact.kind}:${subject}`;
    const group = groups.get(key) ?? { kind: fact.kind, subject, facts: [] };
    group.facts.push(fact);
    groups.set(key, group);
  }
  return [...groups.values()].filter(group => {
    const claims = new Set(group.facts.map(fact => words(fact.text).filter(word => timeWords.has(word) || /^\d+(?:\.\d+)?$/.test(word)).sort().join(" ")));
    return group.facts.length > 1 && claims.size > 1;
  });
}

/** Lists approved facts older than 30 days that have no explicit reconfirmation marker. */
export function staleFacts(facts: Fact[], now: Date): Fact[] {
  const cutoff = now.getTime() - 30 * 86400000;
  return facts.filter(fact => {
    if (fact.status !== "approved" || typeof fact.data.supersededBy === "string" || fact.data.reconfirmedAt || fact.data.lastConfirmedAt) return false;
    const created = new Date(fact.createdAt).getTime();
    return Number.isFinite(created) && created < cutoff;
  });
}

const domainWords: Record<string, string[]> = {
  study: ["study", "exam", "revision", "revise", "assignment", "project", "class", "deadline", "homework"],
  health: ["gym", "walk", "exercise", "sleep", "run", "health"],
  personal: ["personal", "routine", "habit", "daily", "morning", "evening"],
  career: ["career", "job", "internship", "work"],
};

/** Keyword overlap plus a small domain bonus and recency; does not use embeddings or I/O. */
export function retrieveRelevant(facts: Fact[], question: string, k = 5): Fact[] {
  if (k <= 0) return [];
  const queryWords = [...new Set(words(question).filter(word => word.length > 2))];
  const query = question.toLowerCase();
  const domain = Object.entries(domainWords).find(([, terms]) => terms.some(term => query.includes(term)))?.[0];
  const latest = Math.max(0, ...facts.map(fact => new Date(fact.updatedAt).getTime()).filter(Number.isFinite));
  return facts.filter(fact => fact.status === "approved" && typeof fact.data.supersededBy !== "string")
    .map((fact, index) => {
      const factWords = new Set(words(`${fact.text} ${String(fact.data.title ?? "")} ${String(fact.data.subject ?? "")}`));
      const overlap = queryWords.reduce((score, word) => score + (factWords.has(word) ? 1 : 0), 0);
      const updated = new Date(fact.updatedAt).getTime();
      const recency = latest > 0 && Number.isFinite(updated) ? Math.max(0, updated / latest) : 0;
      const domainMatch = domain && fact.category === domain ? 2 : 0;
      return { fact, index, score: overlap * 3 + domainMatch + recency };
    })
    .sort((a, b) => b.score - a.score || b.fact.updatedAt.localeCompare(a.fact.updatedAt) || a.index - b.index)
    .slice(0, k).map(item => item.fact);
}

const topicConsent: Partial<Record<Fact["kind"], Array<keyof ConsentSettings>>> = {
  task: ["tasks"], deadline: ["tasks"], habit: ["tasks", "habits"], routine: ["tasks"],
  preference: ["journal"], goal: ["planner"], decision: ["decisions"],
};

/** Enforces source and topic consent for facts before retrieval or prompt use. */
export function privacyBoundary(facts: Fact[], consent: ConsentSettings): Fact[] {
  return facts.filter(fact => {
    const sourceAllowed = fact.sourceType === "journal" ? consent.journal : fact.sourceType === "question" ? consent.voice : true;
    const topics = topicConsent[fact.kind] ?? [];
    return sourceAllowed && topics.every(topic => consent[topic]);
  });
}
