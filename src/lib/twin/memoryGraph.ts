import type { Fact, Goal, Habit, Task } from "../types";

export type MemoryNodeKind = "fact" | "domain" | "task" | "goal" | "habit";

export interface MemoryGraphNode {
  id: string;
  label: string;
  kind: MemoryNodeKind;
  weight: number;
}

export interface MemoryGraphLink {
  source: string;
  target: string;
}

export interface MemoryGraph {
  nodes: MemoryGraphNode[];
  links: MemoryGraphLink[];
}

const ignored = new Set(["about", "after", "again", "before", "from", "have", "into", "just", "more", "much", "need", "over", "plan", "that", "the", "then", "this", "with", "will", "would", "your", "you", "my", "our", "for", "and", "but", "not", "are", "was"]);
const keywords = (text: string) => new Set((text.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter(word => word.length > 2 && !ignored.has(word)));
const overlap = (a: Set<string>, b: Set<string>) => [...a].some(word => b.has(word));
const clamp = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
const canonicalLink = (source: string, target: string) => source < target ? `${source}\u0000${target}` : `${target}\u0000${source}`;

/** Builds a deterministic keyword graph from facts and the student's planning records. */
export function buildMemoryGraph(facts: Fact[], tasks: Task[], goals: Goal[], habits: Habit[]): MemoryGraph {
  const nodes: MemoryGraphNode[] = [];
  const links = new Map<string, MemoryGraphLink>();
  const addLink = (source: string, target: string) => {
    if (source === target) return;
    links.set(canonicalLink(source, target), { source, target });
  };

  const factKeys = new Map<string, Set<string>>();
  for (const fact of facts) {
    const id = `fact:${fact.id}`;
    nodes.push({ id, label: fact.text, kind: "fact", weight: clamp(fact.confidence) });
    factKeys.set(id, keywords(`${fact.text} ${String(fact.data.title ?? "")} ${String(fact.data.subject ?? "")}`));
  }

  const entities: Array<{ id: string; label: string; kind: "task" | "goal" | "habit"; category: string; weight: number; text: string }> = [
    ...tasks.map(task => ({ id: `task:${task.id}`, label: task.title, kind: "task" as const, category: task.category, weight: task.done ? 0.6 : 0.85, text: task.title })),
    ...goals.map(goal => ({ id: `goal:${goal.id}`, label: goal.title, kind: "goal" as const, category: goal.category, weight: clamp(goal.progress), text: goal.title })),
    ...habits.map(habit => {
      const days = Object.values(habit.log);
      const completion = days.length ? days.filter(Boolean).length / days.length : 0;
      return { id: `habit:${habit.id}`, label: habit.title, kind: "habit" as const, category: habit.category, weight: clamp(completion), text: habit.title };
    }),
  ];
  for (const entity of entities) nodes.push({ id: entity.id, label: entity.label, kind: entity.kind, weight: clamp(entity.weight) });

  const domainWeights = new Map<string, number[]>();
  for (const fact of facts) {
    const factId = `fact:${fact.id}`;
    const domainId = `domain:${fact.category}`;
    const weightValues = domainWeights.get(domainId) ?? [];
    weightValues.push(clamp(fact.confidence));
    domainWeights.set(domainId, weightValues);
    addLink(factId, domainId);

    const factTerms = factKeys.get(factId)!;
    for (const entity of entities) {
      if (overlap(factTerms, keywords(entity.text))) addLink(factId, entity.id);
    }
  }

  const factNodes = facts.map(fact => `fact:${fact.id}`);
  for (let i = 0; i < factNodes.length; i += 1) {
    for (let j = i + 1; j < factNodes.length; j += 1) {
      if (overlap(factKeys.get(factNodes[i])!, factKeys.get(factNodes[j])!)) addLink(factNodes[i], factNodes[j]);
    }
  }

  for (const [id, weights] of domainWeights) {
    nodes.push({ id, label: id.slice("domain:".length), kind: "domain", weight: weights.reduce((sum, weight) => sum + weight, 0) / weights.length });
  }
  nodes.sort((a, b) => a.kind.localeCompare(b.kind) || a.label.localeCompare(b.label) || a.id.localeCompare(b.id));
  const sortedLinks = [...links.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, link]) => link);
  return { nodes, links: sortedLinks };
}

export default buildMemoryGraph;
