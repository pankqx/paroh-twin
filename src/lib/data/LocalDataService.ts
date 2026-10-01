import type { CheckIn, ConsentCategory, ConsentSettings, Decision, Fact, Goal, Habit, JournalEntry, MemoryItem, Scenario, Task, TwinData, TwinState } from "../types";
import type { ConnectorKind, ConverseInput, ConverseResult, DataService, Repo, WhatIfParseResult } from "./DataService";
import { createSampleData } from "../../mock/sample";
import { connectorSamples } from "../../mock/connectorSamples";
import { extractCanned } from "../ai/extractCanned";
import { buildTwinContext } from "../ai/buildTwinContext";
import { buildMemoryGraph, deriveTwinState, detectConflicts, feedbackDelta as deriveFeedbackDelta, insights as deriveInsights, predictedNeeds as derivePredictedNeeds, privacyBoundary, retrieveRelevant, staleFacts } from "../twin";
import { parseWhatIfCanned, recommend, simulate } from "../twin/scenarios";

type State = { entries: JournalEntry[]; facts: Fact[]; tasks: Task[]; goals: Goal[]; habits: Habit[]; checkins: CheckIn[]; decisions: Decision[]; memories: MemoryItem[]; consent: ConsentSettings };
const KEY = "paroh-local-data-v1";
const defaultConsent: ConsentSettings = { journal: true, tasks: true, habits: true, mood: true, planner: true, voice: false, decisions: true };
const shortSpeech = (text: string) => text.trim().split(/\s+/).slice(0, 44).join(" ");
const stableId = (text: string) => { let hash = 2166136261; for (const char of text) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619); return (hash >>> 0).toString(36); };
const routedIntent = (text: string): ConverseResult["intent"] => {
  if (/\bwhat if\b|\bshould i\b/i.test(text)) return "whatif";
  if (/\bhow is my week\b|\bhow's my week\b|\bhow am i\b|\bhow busy\b|\bmy load\b|\bstatus\b|\b(load|deadlines?|week's plan|planned capacity)\b/i.test(text)) return "status";
  if (/\b(help|what can you do|how do i)\b/i.test(text)) return "help";
  if (/\b(journal|remember this|write this down)\b/i.test(text)) return "journal";
  return "chat";
};
const neededConsent = (text: string): ConsentCategory[] => {
  const lower = text.toLowerCase();
  const required = new Set<ConsentCategory>();
  if (/\b(habit|streak|routine)\b/.test(lower)) { required.add("habits"); required.add("tasks"); }
  if (/\b(energy|mood|tired|focus level)\b/.test(lower)) required.add("mood");
  if (/\b(goal|year plan|planner)\b/.test(lower)) required.add("planner");
  if (/\b(decision|choice|what did i choose)\b/.test(lower)) required.add("decisions");
  if (/\b(task|deadline|due|load|week|study|exam|project|assignment|revise|revision)\b/.test(lower)) required.add("tasks");
  if (/\b(journal|note|memory|remember|what do you know)\b/.test(lower)) required.add("journal");
  return [...required];
};
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
  async insights() {
    const twin = await this.getTwinState();
    return deriveInsights(twin, this.state.consent.tasks ? await this.tasks.list() : [], this.state.consent.tasks && this.state.consent.habits ? await this.habits.list() : [], this.state.consent.mood ? await this.checkins.list() : []);
  }
  async predictedNeeds() {
    return derivePredictedNeeds(this.state.consent.tasks ? await this.tasks.list() : [], this.state.consent.tasks && this.state.consent.habits ? await this.habits.list() : []);
  }
  async feedbackDelta() {
    return deriveFeedbackDelta(this.state.consent.decisions ? await this.decisions.list() : []);
  }
  async getMemoryGraph() {
    const facts = await this.permittedApprovedFacts();
    const tasks = this.state.consent.tasks ? await this.tasks.list() : [];
    const goals = this.state.consent.planner ? await this.goals.list() : [];
    const habits = this.state.consent.tasks && this.state.consent.habits ? await this.habits.list() : [];
    return buildMemoryGraph(facts, tasks, goals, habits);
  }
  private async permittedApprovedFacts(): Promise<Fact[]> {
    return privacyBoundary(await this.facts.list(), this.state.consent).filter(fact => fact.status === "approved");
  }
  async getConflicts() { return detectConflicts(await this.permittedApprovedFacts()); }
  async getStale() { return staleFacts(await this.permittedApprovedFacts(), new Date()); }
  async retrieve(question: string) { return retrieveRelevant(await this.permittedApprovedFacts(), question); }
  async nextQuestions() {
    return questionsForTwinState(await this.getTwinState());
  }
  async extractFacts(input: { text: string; source: "journal" | "question"; sourceId: string }) {
    if (!this.state.consent.journal) return [];
    let result: Fact[];
    try {
      const context = await buildTwinContext(this.state.consent, this, input.text);
      const response = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...input, context }),
      });
      if (!response.ok) throw new Error("Fact extraction route failed");
      const payload: unknown = await response.json();
      if (!payload || typeof payload !== "object" || !Array.isArray((payload as { facts?: unknown }).facts)) throw new Error("Fact extraction route returned an invalid response");
      const facts = (payload as { facts: unknown[] }).facts;
      // The model found nothing: let the local rules have a go before giving up.
      if (facts.length === 0) throw new Error("Model returned no facts");
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
    const context = await buildTwinContext(this.state.consent, this, text);
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
  async previewConnector(kind: ConnectorKind): Promise<Fact[]> {
    if (!this.state.consent.journal) return [];
    const candidates: Fact[] = [];
    for (const [index, message] of connectorSamples[kind].entries()) {
      const extracted = await this.extractFacts({ text: message, source: "journal", sourceId: `sample-${kind}-${index + 1}` });
      for (const fact of extracted) {
        const candidate: Fact = { ...fact, status: "pending", data: { ...fact.data, sampleConnector: kind, sampleLabel: "sample messages" } };
        await this.facts.upsert(candidate);
        candidates.push(candidate);
      }
    }
    return candidates;
  }
  async explain(decisionId: string) {
    const decision = await this.decisions.get(decisionId);
    if (!decision) return { text: "I do not have enough saved scenario data to explain this yet.", spoken: "I need more saved data to explain this choice.", usedFactIds: [] };
    let usedFactIds: string[] = [];
    try {
      const context = await buildTwinContext(this.state.consent, this, decision.prompt);
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
  async converse(input: ConverseInput): Promise<ConverseResult> {
    try {
      const intent = routedIntent(input.utterance);
      const consent = { ...this.state.consent };
      const sourceId = `voice-${stableId(input.utterance)}`;
      const candidateFacts = consent.voice ? extractCanned(input.utterance, sourceId, "question") : [];
      if (neededConsent(input.utterance).some(category => !consent[category])) {
        const reply = "That's outside what you've allowed me to use.";
        return { reply, spoken: reply, candidateFacts, intent, ...(intent === "whatif" ? { whatIfPrompt: input.utterance } : {}) };
      }
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
      const context = await buildTwinContext(consent, this, input.utterance);
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
    return { categories: allowed, text: JSON.stringify({ kind, input: allowed.includes("journal") || kind !== "extract" ? input : "[omitted: journal consent is off]" }) };
  }
  async loadSampleData() { this.state = seededState(); this.persist(); }
  async resetAll() { this.state = { ...seededState(), entries: [], facts: [], tasks: [], goals: [], habits: [], checkins: [], decisions: [], memories: [] }; try { this.storage?.removeItem(KEY); } catch { /* unavailable */ } }
}

export const localDataService = new LocalDataService();
export default LocalDataService;
