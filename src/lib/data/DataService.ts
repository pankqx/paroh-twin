import type {
  CheckIn,
  ConsentCategory,
  ConsentSettings,
  Decision,
  Fact,
  Goal,
  Habit,
  JournalEntry,
  MemoryItem,
  Scenario,
  ScenarioSpec,
  Task,
  TwinState,
} from "../types";
import type { FactConflict } from "../twin/memory";

export interface WhatIfPlan {
  label: string;
  tasks: ScenarioSpec["tasks"];
  summary?: string;
  priority?: ScenarioSpec["priority"];
}

export interface WhatIfParseResult {
  scenarios: WhatIfPlan[];
  clarify?: string;
  degraded: boolean;
}

/** Generic CRUD surface shared by every stored entity. */
export interface Repo<T extends { id: string }> {
  list(): Promise<T[]>;
  get(id: string): Promise<T | undefined>;
  upsert(item: T): Promise<T>;
  remove(id: string): Promise<void>;
}

/**
 * The only way the UI reads or writes data. Never call storage or the network
 * from components. See docs/HANDOFF.md section 8.
 */
export interface DataService {
  // CRUD
  entries: Repo<JournalEntry>;
  facts: Repo<Fact>;
  tasks: Repo<Task>;
  goals: Repo<Goal>;
  habits: Repo<Habit>;
  checkins: Repo<CheckIn>;
  decisions: Repo<Decision>;
  memories?: Repo<MemoryItem>;

  // consent
  getConsent(): Promise<ConsentSettings>;
  setConsent(consent: ConsentSettings): Promise<void>;

  // twin (derived from approved facts and permitted data)
  getTwinState(): Promise<TwinState>;
  getConflicts(): Promise<FactConflict[]>;
  getStale(): Promise<Fact[]>;
  retrieve(question: string): Promise<Fact[]>;
  nextQuestions(): Promise<{ id: string; text: string; domain: string; quickReplies: string[] }[]>;
  saveEntry?(entry: JournalEntry): Promise<JournalEntry>;
  listFacts?(): Promise<Fact[]>;
  setFactStatus?(id: string, status: "approve" | "reject" | "edit", edits?: Partial<Fact>): Promise<Fact>;

  // AI (server-side, OpenRouter, with canned fallback)
  extractFacts(input: {
    text: string;
    source: "journal" | "question";
    sourceId: string;
  }): Promise<Fact[]>;
  parseWhatIf(text: string): Promise<WhatIfParseResult>;
  proposeScenarios(prompt: string): Promise<Scenario[]>;
  explain(
    decisionId: string,
  ): Promise<{ text: string; spoken: string; usedFactIds: string[] }>;
  previewPayload(
    kind: "extract" | "scenarios" | "explain",
    input: unknown,
  ): Promise<{ categories: ConsentCategory[]; text: string }>;

  // seed
  loadSampleData(): Promise<void>;
  resetAll(): Promise<void>;
}
