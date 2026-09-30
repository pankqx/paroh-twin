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
  Task,
  TwinState,
  Whisper,
} from "../types";

export type ConnectorKind = "gmail" | "whatsapp" | "telegram" | "calendar";

/** Generic CRUD surface shared by every stored entity. */
export interface Repo<T extends { id: string }> {
  list(): Promise<T[]>;
  get(id: string): Promise<T | undefined>;
  upsert(item: T): Promise<T>;
  remove(id: string): Promise<void>;
}

export interface ConverseInput {
  utterance: string;
  history: Array<{ role: "twin" | "user"; text: string }>;
}
export interface ConverseResult {
  reply: string;
  spoken: string;
  followUp?: { text: string; domain?: string; quickReplies: string[] };
  candidateFacts: Fact[];
  intent: "chat" | "whatif" | "journal" | "status" | "help";
  whatIfPrompt?: string;
  degraded?: boolean;
}

export type ProposedScenario = Scenario & { needsInfo?: string };

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
  getWhispers(): Promise<Whisper[]>;
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
  proposeScenarios(prompt: string): Promise<ProposedScenario[]>;
  explain(
    decisionId: string,
  ): Promise<{ text: string; spoken: string; usedFactIds: string[] }>;
  converse(input: ConverseInput): Promise<ConverseResult>;
  previewConnector(kind: ConnectorKind): Promise<Fact[]>;
  previewPayload(
    kind: "extract" | "scenarios" | "explain",
    input: unknown,
  ): Promise<{ categories: ConsentCategory[]; text: string }>;

  // seed
  loadSampleData(): Promise<void>;
  resetAll(): Promise<void>;
}
