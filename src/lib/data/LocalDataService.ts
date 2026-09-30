import type { CheckIn, ConsentCategory, ConsentSettings, Decision, Fact, Goal, Habit, JournalEntry, MemoryItem, Scenario, Task, TwinData, TwinState, Whisper } from "../types";
import type { ConverseInput, ConverseResult, DataService, Repo } from "./DataService";
import { createSampleData } from "../../mock/sample";
import { extractCanned } from "../ai/extractCanned";
import { buildTwinContext } from "../ai/buildTwinContext";
import { deriveTwinState } from "../twin";
import { parseWhatIfCanned, recommend, simulate } from "../twin/scenarios";
import { pulseWhispers } from "../twin/pulseWhispers";

type State = { entries: JournalEntry[]; facts: Fact[]; tasks: Task[]; goals: Goal[]; habits: Habit[]; checkins: CheckIn[]; decisions: Decision[]; memories: MemoryItem[]; consent: ConsentSettings };
const KEY = "paroh-local-data-v1";
const defaultConsent: ConsentSettings = { journal: true, tasks: true, habits: true, mood: true, planner: true, voice: false, decisions: true };
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const stamp = () => new Date().toISOString();
const shortSpeech = (text: string) => text.trim().split(/\s+/).slice(0, 44).join(" ");
const stableId = (text: string) => { let hash = 2166136261; for (const char of text) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619); return (hash >>> 0).toString(36); };
const routedIntent = (text: string): ConverseResult["intent"] => {
  if (/\bwhat if\b|\bshould i\b/i.test(text)) return "whatif";
  if (/\bhow is my week\b|\bhow's my week\b|\bhow am i\b|\bhow busy\b|\bmy load\b|\bstatus\b|\b(load|deadlines?|week's plan|planned capacity)\b/i.test(text)) return "status";
  if (/\b(help|what can you do|how do i)\b/i.test(text)) return "help";
  if (/\b(journal|remember this|write this down)\b/i.test(text)) return "journal";
  return "chat";
};

const questionOrder = ["tasks", "habits", "routines", "energy", "goals", "planner"] as const;
const questionTemplates: Record<(typeof questionOrder)[number], { text: string; quickReplies: string[] }> = {
  tasks: { text: "Which task should we plan first this week?", quickReplies: ["Exam revision", "Project work", "A smaller task"] },
  habits: { text: "Which habit would you like to keep steady this week?", quickReplies: ["Morning review", "Focused study", "Evening walk"] },
  routines: { text: "When do you usually focus best?", quickReplies: ["Morning", "Afternoon", "Evening"] },
  energy: { text: "When do you usually have the most energy for study?", quickReplies: ["Morning", "Afternoon", "Evening"] },
  goals: { text: "Which goal matters most to you this week?", quickReplies: ["Exam preparation", "Project", "Steady routine"] },
  planner: { text: "How much time can you set aside for study tomorrow?", quickReplies: ["1–2 hours", "2–3 hours", "3 or more hours"] },
};

/** Stable tie-breaking keeps the same low-confidence prompt order between visits. */
export function questionsForTwinState(state: TwinState) {
  return [...questionOrder]
    .map((domain, index) => ({ domain, index, confidence: state.confidenceByDomain[domain === "energy" ? "mood" : domain] ?? 0 }))
    .sort((a, b) => a.confidence - b.confidence || a.index - b.index)
    .slice(0, 3)
    .map(({ domain }) => ({ id: `twin-question-${domain}`, text: questionTemplates[domain].text, domain, quickReplies: [...questionTemplates[domain].quickReplies] }));
}

function seededState(): State {
  const sampleData = createSampleData(new Date());
  return { entries: clone(sampleData.entries), facts: clone(sampleData.facts), tasks: clone(sampleData.tasks), goals: clone(sampleData.goals), habits: clone(sampleData.habits), checkins: clone(sampleData.checkins), decisions: clone(sampleData.decisions), memories: [], consent: { ...defaultConsent } };
}

export class LocalDataService implements DataService {
  private state: State;
  private storage: Storage | undefined;

  constructor(storage?: Storage) {
    this.storage = storage ?? (typeof window !== "undefined" ? window.localStorage : undefined);
    let initial: State | undefined;
    try { const raw = this.storage?.getItem(KEY); if (raw) initial = JSON.parse(raw) as State; } catch { /* recover with sample data */ }
    this.state = initial ?? seededState();
    this.persist();
  }

  private persist() { try { this.storage?.setItem(KEY, JSON.stringify(this.state)); } catch { /* storage may be unavailable */ } }
  private repo<T extends { id: string }>(key: keyof State): Repo<T> {
    return {
      list: async () => clone(this.state[key] as unknown as T[]),
      get: async (id: string) => clone((this.state[key] as unknown as T[]).find(item => item.id === id)),
      upsert: async (item: T) => { const list = this.state[key] as unknown as T[]; const i = list.findIndex(row => row.id === item.id); if (i < 0) list.push(clone(item)); else list[i] = clone(item); this.persist(); return clone(item); },
      remove: async (id: string) => { this.state[key] = (this.state[key] as unknown as T[]).filter(item => item.id !== id) as never; this.persist(); },
    };
  }

  entries = this.repo<JournalEntry>("entries");
  facts = this.repo<Fact>("facts");
  tasks = this.repo<Task>("tasks");
  goals = this.repo<Goal>("goals");
  habits = this.repo<Habit>("habits");
  checkins = this.repo<CheckIn>("checkins");
  decisions = this.repo<Decision>("decisions");
  memories = this.repo<MemoryItem>("memories");

  async saveEntry(entry: JournalEntry) { return this.entries.upsert(entry); }
  async listFacts() { return this.facts.list(); }
  async setFactStatus(id: string, status: "approve" | "reject" | "edit", edits: Partial<Fact> = {}) {
    const current = await this.facts.get(id);
    if (!current) throw new Error(`Fact ${id} was not found`);
    const now = stamp();
    const fact: Fact = { ...current, ...edits, status: status === "approve" ? "approved" : status === "reject" ? "rejected" : current.status, updatedAt: now };
    await this.facts.upsert(fact);
    if (status === "approve") {
      const data = fact.data;
      await this.memories.upsert({ id: `memory-${fact.id}`, text: fact.text, sourceId: fact.id, kind: fact.kind, createdAt: now, updatedAt: now });
      if (fact.kind === "task" || fact.kind === "deadline") {
        const title = String(data.title ?? fact.text);
        const existing = (await this.tasks.list()).find(t => t.title.toLowerCase() === title.toLowerCase());
        if (!existing) await this.tasks.upsert({ id: `fact-task-${fact.id}`, title, category: fact.category, dueAt: typeof data.due === "string" ? data.due : undefined, estHours: typeof data.estHours === "number" ? data.estHours : 1, done: false, createdAt: now, updatedAt: now });
      }
      if (fact.kind === "goal") {
        const title = String(data.title ?? fact.text);
        if (!(await this.goals.list()).some(g => g.title.toLowerCase() === title.toLowerCase())) await this.goals.upsert({ id: `fact-goal-${fact.id}`, title, category: fact.category, progress: 0, createdAt: now, updatedAt: now });
      }
      if (fact.kind === "habit" && !(await this.habits.list()).some(h => h.title.toLowerCase() === String(data.title ?? fact.text).toLowerCase())) {
        await this.habits.upsert({ id: `fact-habit-${fact.id}`, title: String(data.title ?? fact.text), category: fact.category, log: {}, createdAt: now, updatedAt: now });
      }
    }
    return fact;
  }

  async getConsent() { return { ...this.state.consent }; }
  async setConsent(consent: ConsentSettings) { this.state.consent = { ...consent }; this.persist(); }
  async getTwinState() {
    const visibleFacts = await this.facts.list();
    const data: TwinData = { tasks: this.state.consent.tasks ? await this.tasks.list() : [], goals: this.state.consent.planner ? await this.goals.list() : [], habits: this.state.consent.habits ? await this.habits.list() : [], checkins: this.state.consent.mood ? await this.checkins.list() : [], decisions: this.state.consent.decisions ? await this.decisions.list() : [], facts: this.state.consent.journal ? visibleFacts : visibleFacts.filter(f => f.sourceType !== "journal") };
    return deriveTwinState(data);
  }
  async getWhispers(): Promise<Whisper[]> {
    const twin = await this.getTwinState();
    return pulseWhispers(twin, this.state.consent.tasks ? await this.tasks.list() : [], this.state.consent.habits && this.state.consent.tasks ? await this.habits.list() : []);
  }
  async nextQuestions() {
    return questionsForTwinState(await this.getTwinState());
  }
  async extractFacts(input: { text: string; source: "journal" | "question"; sourceId: string }) {
    if (!this.state.consent.journal) return [];
    let result: Fact[];
    try {
      const requestBody = await this.extractPayload(input);
      const response = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      if (!response.ok) throw new Error("Fact extraction route failed");
      const payload: unknown = await response.json();
      if (!payload || typeof payload !== "object" || !Array.isArray((payload as { facts?: unknown }).facts)) throw new Error("Fact extraction route returned an invalid response");
      const facts = (payload as { facts: unknown[] }).facts;
      if (facts.some(fact => !fact || typeof fact !== "object" || typeof (fact as { text?: unknown }).text !== "string" || typeof (fact as { kind?: unknown }).kind !== "string")) throw new Error("Fact extraction route returned invalid facts");
      const now = stamp();
      result = facts.map((value, index) => {
        const fact = value as Partial<Fact>;
        return {
          id: `${input.sourceId}-fact-${index + 1}`,
          kind: fact.kind!, text: fact.text!, category: fact.category ?? "other", data: fact.data ?? {},
          sourceId: input.sourceId, sourceType: input.source, status: "pending",
          confidence: typeof fact.confidence === "number" ? Math.max(0, Math.min(1, fact.confidence)) : 0.65,
          createdAt: now, updatedAt: now,
        };
      });
    } catch {
      result = extractCanned(input.text, input.sourceId, input.source);
    }
    for (const fact of result) await this.facts.upsert(fact);
    return result;
  }
  async proposeScenarios(prompt: string): Promise<Scenario[]> {
    const data: TwinData = { tasks: this.state.consent.tasks ? await this.tasks.list() : [], goals: this.state.consent.planner ? await this.goals.list() : [], habits: this.state.consent.habits ? await this.habits.list() : [], checkins: [], decisions: this.state.consent.decisions ? await this.decisions.list() : [] };
    const specs = parseWhatIfCanned(prompt, data);
    return specs.map(spec => simulate(spec, data));
  }
  async explain(decisionId: string) {
    const decision = await this.decisions.get(decisionId);
    if (!decision) return { text: "I do not have enough saved scenario data to explain this yet.", spoken: "I need more saved data to explain this choice.", usedFactIds: [] };
    let usedFactIds: string[] = [];
    try {
      const requestBody = await this.explainPayload(decision);
      usedFactIds = requestBody.approvedFacts.map(fact => fact.id);
      const response = await fetch("/api/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      if (!response.ok) throw new Error("Explain route failed");
      const payload: unknown = await response.json();
      if (!payload || typeof payload !== "object" || typeof (payload as { text?: unknown }).text !== "string" || typeof (payload as { spoken?: unknown }).spoken !== "string") throw new Error("Explain route returned an invalid response");
      const result = payload as { text: string; spoken: string; usedFactIds?: unknown };
      const allowedIds = new Set(usedFactIds);
      return { text: result.text, spoken: result.spoken.split(/\s+/).slice(0, 55).join(" "), usedFactIds: Array.isArray(result.usedFactIds) ? result.usedFactIds.filter((id): id is string => typeof id === "string" && allowedIds.has(id)) : usedFactIds };
    } catch {
      const best = recommend(decision.scenarios);
      const text = best ? `${best.label} fits the current comparison. ${best.summary}` : "I do not have enough scenario data to compare these options.";
      return { text, spoken: text.split(/\s+/).slice(0, 55).join(" "), usedFactIds };
    }
  }
  async converse(input: ConverseInput): Promise<ConverseResult> {
    try {
      const intent = routedIntent(input.utterance);
      const consent = { ...this.state.consent };
      const sourceId = `voice-${stableId(input.utterance)}`;
      const candidateFacts = consent.voice ? extractCanned(input.utterance, sourceId, "question") : [];
      if (intent === "status") {
        if (!consent.tasks) {
          const reply = "I need task sharing turned on to summarize your week.";
          return { reply, spoken: reply, candidateFacts, intent, degraded: true };
        }
        const twin = await this.getTwinState();
        const now = Date.now();
        const tasks = await this.tasks.list();
        const dueSoon = tasks.filter(task => !task.done && task.dueAt && new Date(task.dueAt).getTime() >= now && new Date(task.dueAt).getTime() <= now + 7 * 86400000).length;
        const deadlineLabel = dueSoon === 1 ? "open deadline" : "open deadlines";
        const studySamples = tasks.filter(task => task.category === "study" && task.done && task.actualHours !== undefined && task.estHours > 0).length;
        const biasNote = studySamples >= 3 ? ` Study tasks average about ${twin.estimationBias.study.toFixed(1)} times their estimate.` : "";
        const reply = `Your planned load is ${Math.round(twin.loadPct)}% of this week's capacity, with ${dueSoon} ${deadlineLabel} in the next seven days.${biasNote}`;
        return { reply, spoken: shortSpeech(reply), candidateFacts, intent };
      }

      const questions = await this.nextQuestions();
      const context = await buildTwinContext(consent, this);
      const response = await fetch("/api/converse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          utterance: input.utterance,
          history: input.history.slice(-8),
          intent,
          sourceId,
          allowCandidateFacts: consent.voice,
          context,
          followUp: questions[0],
          quickReplies: questions[0]?.quickReplies ?? [],
        }),
      });
      if (!response.ok) throw new Error("Converse route failed");
      const value: unknown = await response.json();
      if (!value || typeof value !== "object" || typeof (value as { reply?: unknown }).reply !== "string" || typeof (value as { spoken?: unknown }).spoken !== "string") throw new Error("Converse route returned invalid data");
      const result = value as Partial<ConverseResult>;
      const followUp = result.followUp && typeof result.followUp.text === "string"
        ? { text: result.followUp.text, ...(typeof result.followUp.domain === "string" ? { domain: result.followUp.domain } : {}), quickReplies: Array.isArray(result.followUp.quickReplies) ? result.followUp.quickReplies.filter((item): item is string => typeof item === "string").slice(0, 3) : [] }
        : undefined;
      return {
        reply: result.reply!, spoken: shortSpeech(result.spoken!), followUp, candidateFacts,
        intent, ...(intent === "whatif" ? { whatIfPrompt: input.utterance } : {}), degraded: Boolean(result.degraded),
      };
    } catch {
      try {
        const intent = routedIntent(input.utterance);
        const consent = this.state.consent;
        const candidateFacts = consent.voice ? extractCanned(input.utterance, `voice-${stableId(input.utterance)}`, "question") : [];
        const questions = await this.nextQuestions();
        const followUp = questions[0] ? { text: questions[0].text, domain: questions[0].domain, quickReplies: questions[0].quickReplies } : undefined;
        const base = intent === "whatif" ? "I can compare those options using your saved tasks and deadlines." : intent === "help" ? "I can help with planning, task estimates, deadlines, and what-if choices." : intent === "journal" ? "I can turn clear plans from this note into candidate facts for your review." : "I can help you plan the next step.";
        const reply = followUp ? `${base} ${followUp.text}` : base;
        return { reply, spoken: shortSpeech(reply), followUp, candidateFacts, intent, ...(intent === "whatif" ? { whatIfPrompt: input.utterance } : {}), degraded: true };
      } catch {
        const reply = "I can help with tasks and planning. What would you like to work on next?";
        const intent = routedIntent(input.utterance);
        return { reply, spoken: reply, candidateFacts: [], intent, ...(intent === "whatif" ? { whatIfPrompt: input.utterance } : {}), degraded: true };
      }
    }
  }
  async previewPayload(kind: "extract" | "scenarios" | "explain", input: unknown) {
    const categories: ConsentCategory[] = kind === "extract" ? ["journal"] : kind === "scenarios" ? ["tasks", "planner", "decisions"] : ["tasks", "decisions"];
    const allowed = categories.filter(category => this.state.consent[category]);
    let payload: unknown;
    if (kind === "extract") {
      payload = this.state.consent.journal && input && typeof input === "object"
        ? await this.extractPayload(input as { text: string; source: "journal" | "question"; sourceId: string })
        : {};
    } else if (kind === "explain") {
      const decision = typeof input === "string" ? await this.decisions.get(input) : input as Decision | undefined;
      payload = decision ? await this.explainPayload(decision) : {};
    } else {
      payload = {};
    }
    return { categories: allowed, text: JSON.stringify(payload) };
  }

  private async extractPayload(input: { text: string; source: "journal" | "question"; sourceId: string }) {
    const context = await buildTwinContext(this.state.consent, this);
    return { ...input, context };
  }

  private async explainPayload(decision: Decision) {
    const context = await buildTwinContext(this.state.consent, this);
    return { scenarios: decision.scenarios, recommendedId: decision.recommendedId, approvedFacts: context.approvedFacts, context };
  }
  async loadSampleData() { this.state = seededState(); this.persist(); }
  async resetAll() { this.state = { ...seededState(), entries: [], facts: [], tasks: [], goals: [], habits: [], checkins: [], decisions: [], memories: [] }; try { this.storage?.removeItem(KEY); } catch { /* unavailable */ } }
}

export const localDataService = new LocalDataService();
export default LocalDataService;
