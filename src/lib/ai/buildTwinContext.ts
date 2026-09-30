import type { CheckIn, ConsentSettings, Fact, Habit, Task, Category } from "../types";
import { localDataService } from "../data/LocalDataService";
import type { Repo } from "../data/DataService";
import { estimationBias, habitConsistency } from "../twin";
import { relevantFacts } from "./relevantFacts";

export interface TwinContext {
  approvedFacts: Array<{ id: string; kind: Fact["kind"]; text: string }>;
  habitConsistency?: number;
  estimationBias?: Partial<Record<Category, number>>;
  averages?: { energy: number; mood: number; checkIns: number };
}

export interface TwinContextSource {
  facts: Repo<Fact>;
  tasks: Repo<Task>;
  habits: Repo<Habit>;
  checkins: Repo<CheckIn>;
}

const topicConsent: Partial<Record<Fact["kind"], Array<keyof ConsentSettings>>> = {
  task: ["tasks"],
  deadline: ["tasks"],
  habit: ["tasks", "habits"], // Respect both current toggles; Night Plan groups habits under tasks.
  routine: ["tasks"],
  preference: ["journal"],
  goal: ["planner"],
  decision: ["decisions"],
};

function factIsConsented(fact: Fact, consent: ConsentSettings): boolean {
  const sourceAllowed = fact.sourceType === "journal"
      ? consent.journal
      : fact.sourceType === "question"
        ? consent.voice
        : true; // Manual facts are additionally gated by their topic category below.
  const topics = topicConsent[fact.kind] ?? [];
  return sourceAllowed && topics.every(topic => consent[topic]);
}

const average = (values: number[]) => values.length
  ? Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10
  : undefined;

/** Build a compact prompt context using only facts and statistics allowed by consent. */
export async function buildTwinContext(
  consent: ConsentSettings,
  source: TwinContextSource = localDataService,
  query = "",
): Promise<TwinContext> {
  const facts = consent.journal || consent.voice || consent.tasks || consent.planner || consent.decisions
    ? await source.facts.list()
    : [];
  const approvedFacts = relevantFacts(query, facts.filter(fact => factIsConsented(fact, consent)), 12)
    .map(({ id, kind, text }) => ({ id, kind, text: text.slice(0, 180) }));

  const context: TwinContext = { approvedFacts };
  if (consent.tasks) {
    const tasks = await source.tasks.list();
    const bias = estimationBias(tasks);
    context.estimationBias = Object.fromEntries(Object.entries(bias).map(([category, ratio]) => [category, Math.round(ratio * 100) / 100])) as Partial<Record<Category, number>>;
  }
  if (consent.tasks && consent.habits) {
    context.habitConsistency = Math.round(habitConsistency(await source.habits.list()) * 100) / 100;
  }
  if (consent.mood) {
    const checkins = await source.checkins.list();
    const energy = average(checkins.map(checkin => checkin.energy));
    const mood = average(checkins.map(checkin => checkin.mood));
    if (energy !== undefined && mood !== undefined) context.averages = { energy, mood, checkIns: checkins.length };
  }
  return context;
}

export default buildTwinContext;
