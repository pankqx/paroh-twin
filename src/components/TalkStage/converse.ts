import { dataService } from "@/app/dataService";

// The engine's converse() is the normal path (it has its own offline fallback). The stub below
// is only a safety net for a thrown error or a stalled call, so Talk never goes dead.
import type { ConverseInput, ConverseResult } from "@/lib/data/DataService";

export type { ConverseResult };
export type ConverseTurn = ConverseInput["history"][number];

const TIMEOUT_MS = 20000;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

async function nextFollowUp(asked: number): Promise<ConverseResult["followUp"]> {
  try {
    const qs = await dataService.nextQuestions();
    const q = qs[asked % Math.max(qs.length, 1)];
    return q ? { text: q.text, quickReplies: q.quickReplies, domain: q.domain } : undefined;
  } catch {
    return undefined;
  }
}

/** Offline stand-in: simple intent rules, then the existing fact extraction. */
async function stub(utterance: string, history: ConverseTurn[]): Promise<ConverseResult> {
  const asked = history.filter((t) => t.role === "twin").length;
  const lower = utterance.toLowerCase();
  const followUp = await nextFollowUp(asked);
  const base = { degraded: true, followUp };

  if (/\bwhat if\b|\bwhat would happen\b|\bshould i\b|\bwould it be better\b/.test(lower)) {
    return { ...base, reply: "Let's run that as a what-if.", spoken: "Let's run that as a what-if.", candidateFacts: [], intent: "whatif", whatIfPrompt: utterance, followUp: undefined };
  }
  if (/\bhow am i\b|\bhow's my week\b|\bhow is my week\b|\bstatus\b|\bmy load\b|\bhow busy\b/.test(lower)) {
    const twin = await dataService.getTwinState();
    const text = `Your workload this week is about ${Math.round(twin.loadPct)} percent, and your habit consistency is ${Math.round(twin.habitConsistency * 100)} percent.`;
    return { ...base, reply: text, spoken: text, candidateFacts: [], intent: "status" };
  }
  if (/\bjournal\b|\bdear diary\b|\bnote to self\b/.test(lower)) {
    return { ...base, reply: "That sounds like a journal note. I can save it for you.", spoken: "That sounds like a journal note. I can save it for you.", candidateFacts: [], intent: "journal", followUp: undefined };
  }

  const candidateFacts = await dataService.extractFacts({ text: utterance, source: "question", sourceId: `talk-${Date.now()}` });
  const text = candidateFacts.length
    ? "Here is what I understood. Approve what is right."
    : "I couldn't turn that into something to remember. A full sentence works best.";
  return { ...base, reply: text, spoken: text, candidateFacts, intent: "chat" };
}

/** Calls dataService.converse when it exists; any failure or timeout falls back to the stub. */
export async function converse(utterance: string, history: ConverseTurn[]): Promise<ConverseResult> {
  try {
    const r = await withTimeout(dataService.converse({ utterance, history }), TIMEOUT_MS);
    return { ...r, candidateFacts: r.candidateFacts ?? [] };
  } catch {
    return stub(utterance, history);
  }
}

/** Opening line and first quick replies, before she has heard anything. */
export async function openingTurn(): Promise<{ text: string; quickReplies: string[]; domain?: string }> {
  const f = await nextFollowUp(0);
  return {
    text: f ? `Hi, I'm your twin. Tell me about your week, ask me a what-if, or start here: ${f.text}` : "Hi, I'm your twin. Tell me about your week or ask me a what-if.",
    quickReplies: f?.quickReplies ?? [],
    domain: f?.domain,
  };
}
