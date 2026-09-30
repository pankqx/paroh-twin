import type { Fact } from "../types";

const stopWords = new Set(["about", "after", "again", "from", "have", "into", "just", "like", "might", "need", "please", "that", "the", "then", "this", "what", "when", "where", "with", "would", "your", "you"]);
const tokens = (text: string) => text.toLowerCase().match(/[a-z0-9]+/g)?.filter(token => token.length > 2 && !stopWords.has(token)) ?? [];
const queryCategory = (query: string): string | undefined => {
  const text = query.toLowerCase();
  if (/exam|study|revise|assignment|project|deadline|class/.test(text)) return "study";
  if (/gym|walk|exercise|sleep|run/.test(text)) return "health";
  if (/career|job|intern/.test(text)) return "career";
  if (/goal|personal|routine|habit/.test(text)) return "personal";
  return undefined;
};

/** Keyword overlap plus recency and category match; no embedding or external calls. */
export function relevantFacts(query: string, facts: Fact[], k = 5): Fact[] {
  if (k <= 0) return [];
  const terms = [...new Set(tokens(query))];
  const category = queryCategory(query);
  const now = Date.now();
  return facts.filter(fact => fact.status === "approved" && typeof fact.data.supersededBy !== "string")
    .map((fact, index) => {
      const factText = `${fact.text} ${String(fact.data.title ?? "")} ${String(fact.data.subject ?? "")}`;
      const factTerms = new Set(tokens(factText));
      const overlap = terms.reduce((sum, term) => sum + (factTerms.has(term) ? 1 : 0), 0);
      const ageDays = Math.max(0, (now - new Date(fact.updatedAt).getTime()) / 86400000);
      const recency = Number.isFinite(ageDays) ? 1 / (1 + ageDays / 30) : 0;
      const categoryMatch = category && fact.category === category ? 1.5 : 0;
      return { fact, score: overlap * 2 + recency + categoryMatch, index };
    })
    .sort((a, b) => b.score - a.score || b.fact.updatedAt.localeCompare(a.fact.updatedAt) || a.index - b.index)
    .slice(0, k).map(item => item.fact);
}

export default relevantFacts;
