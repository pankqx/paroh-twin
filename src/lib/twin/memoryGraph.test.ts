import { describe, expect, it } from "vitest";
import type { Fact, Goal, Habit, Task } from "../types";
import { buildMemoryGraph } from "./memoryGraph";

const fact = (id: string, text: string): Fact => ({
  id, kind: "preference", text, category: "study", data: {}, sourceId: "journal", sourceType: "journal",
  status: "approved", confidence: 0.8, createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-01T00:00:00.000Z",
});
const base = { createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-01T00:00:00.000Z" };

describe("buildMemoryGraph", () => {
  it("links facts to domains and keyword-matched plans and links related facts", () => {
    const facts = [fact("morning", "I revise biology in the morning"), fact("evening", "Biology revision works in the evening")];
    const tasks: Task[] = [{ ...base, id: "revision", title: "Revise biology exam", category: "study", estHours: 2, done: false }];
    const goals: Goal[] = [{ ...base, id: "exam-goal", title: "Pass biology exam", category: "study", progress: 0.6 }];
    const habits: Habit[] = [{ ...base, id: "review", title: "Biology review", category: "study", log: { "2026-09-01": true } }];

    const graph = buildMemoryGraph(facts, tasks, goals, habits);
    const linkSet = new Set(graph.links.map(link => `${link.source}|${link.target}`));
    expect(graph.nodes).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "domain:study", kind: "domain", weight: 0.8 }),
      expect.objectContaining({ id: "task:revision", kind: "task" }),
      expect.objectContaining({ id: "goal:exam-goal", kind: "goal", weight: 0.6 }),
      expect.objectContaining({ id: "habit:review", kind: "habit", weight: 1 }),
    ]));
    expect(linkSet).toContain("fact:morning|domain:study");
    expect(linkSet).toContain("fact:morning|task:revision");
    expect(linkSet).toContain("fact:morning|goal:exam-goal");
    expect(linkSet).toContain("fact:morning|habit:review");
    expect(linkSet).toContain("fact:morning|fact:evening");
  });

  it("does not create keyword links for unrelated records and is deterministic", () => {
    const facts = [fact("f", "I prefer biology revision")];
    const tasks: Task[] = [{ ...base, id: "walk", title: "Evening walk", category: "health", estHours: 1, done: false }];
    const first = buildMemoryGraph(facts, tasks, [], []);
    expect(first.links).toEqual([{ source: "fact:f", target: "domain:study" }]);
    expect(buildMemoryGraph(facts, tasks, [], [])).toEqual(first);
  });
});
