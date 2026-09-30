import { describe, expect, it } from "vitest";
import type { CheckIn, ConsentSettings, Fact, Habit, Task } from "../types";
import type { Repo } from "../data/DataService";
import { buildTwinContext, type TwinContextSource } from "./buildTwinContext";

function repo<T extends { id: string }>(items: T[]): Repo<T> {
  return {
    list: async () => items,
    get: async id => items.find(item => item.id === id),
    upsert: async item => { items.push(item); return item; },
    remove: async id => { const index = items.findIndex(item => item.id === id); if (index >= 0) items.splice(index, 1); },
  };
}

const at = "2026-10-01T00:00:00.000Z";
const today = new Date().toISOString().slice(0, 10);
const fact = (id: string, kind: Fact["kind"], sourceType: Fact["sourceType"], status: Fact["status"] = "approved"): Fact => ({
  id, kind, text: `Fact ${id}`, category: "study", data: {}, sourceId: "source", sourceType, status, confidence: 0.9, createdAt: at, updatedAt: at,
});

const allConsent: ConsentSettings = { journal: true, tasks: true, habits: true, mood: true, planner: true, voice: true, decisions: true };
const source: TwinContextSource = {
  facts: repo([fact("approved-task", "task", "journal"), fact("pending-pref", "preference", "journal", "pending"), fact("question-pref", "preference", "question"), fact("disallowed-goal", "goal", "journal")]),
  tasks: repo(["a", "b", "c"].map(id => ({ id, title: "Read", category: "study" as const, estHours: 1, actualHours: 1.3, done: true, createdAt: at, updatedAt: at } as Task))),
  habits: repo([{ id: "habit", title: "Review", category: "study", log: { [today]: true }, createdAt: at, updatedAt: at } as Habit]),
  checkins: repo([{ id: "checkin", date: "2026-10-01", energy: 4, mood: 3, createdAt: at, updatedAt: at } as CheckIn]),
};

describe("buildTwinContext", () => {
  it("includes approved facts and compact statistics when their categories are allowed", async () => {
    const context = await buildTwinContext(allConsent, source);
    expect(context.approvedFacts.map(item => item.id)).toEqual(["approved-task", "question-pref", "disallowed-goal"]);
    expect(context.estimationBias?.study).toBe(1.3);
    expect(context.habitConsistency).toBeGreaterThan(0);
    expect(context.averages).toEqual({ energy: 4, mood: 3, checkIns: 1 });
  });

  it("omits category data when consent is off", async () => {
    const consent = { ...allConsent, journal: false, voice: false, tasks: false, mood: false, planner: false, decisions: false };
    expect(await buildTwinContext(consent, source)).toEqual({ approvedFacts: [] });
  });
});
