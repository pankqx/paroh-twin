import type { CheckIn, ConsentCategory, ConsentSettings, Decision, Fact, Goal, Habit, JournalEntry, MemoryItem, Scenario, Task, TwinData, TwinState } from "../types";
import type { DataService, Repo, WhatIfParseResult } from "./DataService";
import { createSampleData } from "../../mock/sample";
import { extractCanned } from "../ai/extractCanned";
import { buildTwinContext } from "../ai/buildTwinContext";
import { deriveTwinState } from "../twin";
import { parseWhatIfCanned, recommend, simulate } from "../twin/scenarios";

type State = { entries: JournalEntry[]; facts: Fact[]; tasks: Task[]; goals: Goal[]; habits: Habit[]; checkins: CheckIn[]; decisions: Decision[]; memories: MemoryItem[]; consent: ConsentSettings };
const KEY = "paroh-local-data-v1";
const defaultConsent: ConsentSettings = { journal: true, tasks: true, habits: true, mood: true, planner: true, voice: false, decisions: true };
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const stamp = () => new Date().toISOString();

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
  async nextQuestions() {
    return questionsForTwinState(await this.getTwinState());
  }
  async extractFacts(input: { text: string; source: "journal" | "question"; sourceId: string }) {
    if (!this.state.consent.journal) return [];
    let result: Fact[];
    try {
      const context = await buildTwinContext(this.state.consent, this);
      const response = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...input, context }),
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
  async parseWhatIf(text: string): Promise<WhatIfParseResult> {
    const tasks = this.state.consent.tasks ? await this.tasks.list() : [];
    const context = await buildTwinContext(this.state.consent, this);
    try {
      const response = await fetch("/api/parse-whatif", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, context, tasks }),
      });
      if (!response.ok) throw new Error("What-if parser route failed");
      const payload: unknown = await response.json();
      if (!payload || typeof payload !== "object" || !Array.isArray((payload as { scenarios?: unknown }).scenarios)) throw new Error("Invalid what-if response");
      const result = payload as { scenarios: unknown[]; clarify?: unknown; degraded?: unknown };
      if (result.scenarios.length && result.scenarios.some(item => !item || typeof item !== "object" || typeof (item as { label?: unknown }).label !== "string" || !Array.isArray((item as { tasks?: unknown }).tasks))) throw new Error("Invalid what-if scenario");
      if (result.clarify !== undefined && typeof result.clarify !== "string") throw new Error("Invalid clarification");
      return { scenarios: result.scenarios as WhatIfParseResult["scenarios"], ...(typeof result.clarify === "string" ? { clarify: result.clarify } : {}), degraded: Boolean(result.degraded) };
    } catch {
      const data: TwinData = { tasks, goals: [], habits: [], checkins: [], decisions: [] };
      const specs = parseWhatIfCanned(text, data);
      const clarify = specs.find(spec => spec.needsInfo)?.needsInfo;
      if (clarify || specs.every(spec => spec.tasks.length === 0)) return { scenarios: [], clarify: clarify ?? "Which two options should I compare, and how many hours for each?", degraded: true };
      return { scenarios: specs.map(spec => ({ label: spec.label, summary: spec.summary, priority: spec.priority, tasks: spec.tasks })), degraded: true };
    }
  }
  async proposeScenarios(prompt: string): Promise<Scenario[]> {
    const parsed = await this.parseWhatIf(prompt);
    if (parsed.clarify || !parsed.scenarios.length) return [];
    const data: TwinData = { tasks: this.state.consent.tasks ? await this.tasks.list() : [], goals: this.state.consent.planner ? await this.goals.list() : [], habits: this.state.consent.habits ? await this.habits.list() : [], checkins: [], decisions: this.state.consent.decisions ? await this.decisions.list() : [] };
    const specs = parsed.scenarios.map((scenario, index) => ({
      id: `scenario-${index + 1}`,
      label: scenario.label,
      summary: scenario.summary ?? scenario.label,
      tasks: scenario.tasks,
      priority: scenario.priority ?? "neutral" as const,
    }));
    return specs.map(spec => simulate(spec, data));
  }
  async explain(decisionId: string) {
    const decision = await this.decisions.get(decisionId);
    if (!decision) return { text: "I do not have enough saved scenario data to explain this yet.", spoken: "I need more saved data to explain this choice.", usedFactIds: [] };
    let usedFactIds: string[] = [];
    try {
      const context = await buildTwinContext(this.state.consent, this);
      usedFactIds = context.approvedFacts.map(fact => fact.id);
      const response = await fetch("/api/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenarios: decision.scenarios, recommendedId: decision.recommendedId, approvedFacts: context.approvedFacts, context }),
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
  async previewPayload(kind: "extract" | "scenarios" | "explain", input: unknown) {
    const categories: ConsentCategory[] = kind === "extract" ? ["journal"] : kind === "scenarios" ? ["tasks", "planner", "decisions"] : ["tasks", "decisions"];
    const allowed = categories.filter(category => this.state.consent[category]);
    return { categories: allowed, text: JSON.stringify({ kind, input: allowed.includes("journal") || kind !== "extract" ? input : "[omitted: journal consent is off]" }) };
  }
  async loadSampleData() { this.state = seededState(); this.persist(); }
  async resetAll() { this.state = { ...seededState(), entries: [], facts: [], tasks: [], goals: [], habits: [], checkins: [], decisions: [], memories: [] }; try { this.storage?.removeItem(KEY); } catch { /* unavailable */ } }
}

export const localDataService = new LocalDataService();
export default LocalDataService;
