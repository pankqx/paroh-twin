// Paroh data model (solo scope). See docs/HANDOFF.md section 7.

export type Category = "study" | "health" | "personal" | "career" | "other";
export type FactKind =
  | "task"
  | "goal"
  | "habit"
  | "routine"
  | "preference"
  | "deadline"
  | "decision";
export type ConsentCategory =
  | "journal"
  | "tasks"
  | "habits"
  | "mood"
  | "planner"
  | "voice"
  | "decisions";
export type Level = 1 | 2 | 3 | 4 | 5;

interface Base {
  id: string;
  createdAt: string; // ISO
  updatedAt: string; // ISO
}

export interface JournalEntry extends Base {
  title: string;
  body: string;
  tags: string[];
  mood?: Level;
  energy?: Level;
}

/** Candidate or approved knowledge about the student. */
export interface Fact extends Base {
  kind: FactKind;
  text: string;
  category: Category;
  data: Record<string, unknown>; // e.g. { due, estHours }
  sourceId: string;
  sourceType: "journal" | "question" | "manual";
  status: "pending" | "approved" | "rejected";
  confidence: number; // 0-1 extractor confidence
}

export interface Task extends Base {
  title: string;
  category: Category;
  dueAt?: string;
  estHours: number;
  actualHours?: number;
  done: boolean;
  goalId?: string;
  completedAt?: string;
}

export interface Goal extends Base {
  title: string;
  category: Category;
  targetDate?: string;
  progress: number; // 0-1
}

export interface Habit extends Base {
  title: string;
  category: Category;
  log: Record<string, boolean>; // YYYY-MM-DD -> done
}

export interface CheckIn extends Base {
  date: string; // YYYY-MM-DD
  mood: Level;
  energy: Level;
}

export interface Scenario {
  id: string;
  label: string;
  summary: string;
  onTimeProb: number; // 0-1
  peakLoad: number; // 0-1+
  goalImpact: number; // -1..1
  assumptions: string[];
  /** Chance each deadline in the plan is met, in plan order (from the simulation). */
  taskOdds?: Array<{ title: string; dueAt?: string; onTime: number; hours: number }>;
}

export interface Whisper {
  id: string;
  severity: "info" | "watch" | "act";
  text: string;
  kind: "load" | "deadline" | "streak" | "habit";
  data: Record<string, unknown>;
}

export interface Decision extends Base {
  prompt: string;
  scenarios: Scenario[];
  recommendedId: string;
  predictedChoiceId: string;
  userChoice?: "accept" | "reject" | "modify";
  chosenScenarioId?: string;
}

export type ConsentSettings = Record<ConsentCategory, boolean>;

export interface TwinState {
  confidenceByDomain: Record<string, number>; // 0-1 per domain
  loadPct: number; // weekly workload, 0-100+
  habitConsistency: number; // 0-1
  goalAlignment: number; // 0-1
  estimationBias: Record<Category, number>; // mean actual/est
  heatmap: number[][]; // 7 (Mon-Sun) x 24, normalised 0-1
  fidelity: number; // 0-1, rolling accuracy of twin's guesses
  updatedAt: string; // ISO
}

/** A small, dated audit item shown in the twin's memory timeline. */
export interface MemoryItem extends Base {
  text: string;
  sourceId: string;
  kind: FactKind;
}

/** Inputs shared by deterministic twin calculations. */
export interface TwinData {
  tasks: Task[];
  goals: Goal[];
  habits: Habit[];
  checkins: CheckIn[];
  decisions: Decision[];
  facts?: Fact[];
  now?: string;
}

export interface ScenarioSpec {
  id: string;
  label: string;
  summary: string;
  tasks: Array<{ title: string; hours?: number; taskId?: string; dueAt?: string; goalId?: string }>;
  hoursShift?: Array<{ hours: number; from?: string; to?: string }>;
  priority: "deadline" | "goal" | "rest" | "health" | "neutral";
  needsInfo?: string;
}

export interface SampleData {
  studentName: string;
  tasks: Task[];
  goals: Goal[];
  habits: Habit[];
  checkins: CheckIn[];
  entries: JournalEntry[];
  decisions: Decision[];
  facts: Fact[];
}
