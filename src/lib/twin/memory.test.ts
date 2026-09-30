import { describe, expect, it } from "vitest";
import type { ConsentSettings, Fact } from "../types";
import { detectConflicts, privacyBoundary, retrieveRelevant, staleFacts } from "./memory";

const makeFact = (patch: Partial<Fact> & Pick<Fact, "id" | "text">): Fact => {
  const { id, text, ...overrides } = patch;
  const date = overrides.createdAt ?? "2026-08-01T00:00:00.000Z";
  return {
    id, kind: "preference", text, category: "personal", data: {}, sourceId: "memory",
    sourceType: "journal", status: "approved", confidence: 0.9, createdAt: date, updatedAt: overrides.updatedAt ?? date, ...overrides,
  };
};

const consent: ConsentSettings = { journal: true, tasks: true, habits: true, mood: true, planner: true, voice: true, decisions: true };

describe("twin memory helpers", () => {
  it("detects opposing time preferences with the same subject", () => {
    const facts = [
      makeFact({ id: "morning", text: "I work best in the morning" }),
      makeFact({ id: "evening", text: "I work best in the evening", createdAt: "2026-09-01T00:00:00.000Z" }),
      makeFact({ id: "task", kind: "task", text: "I study biology in the morning" }),
    ];
    const conflicts = detectConflicts(facts);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].facts.map(fact => fact.id)).toEqual(["morning", "evening"]);
  });

  it("marks facts older than thirty days stale unless explicitly reconfirmed", () => {
    const facts = [
      makeFact({ id: "stale", text: "I prefer early study" }),
      makeFact({ id: "fresh", text: "I prefer afternoon study", createdAt: "2026-09-15T00:00:00.000Z" }),
      makeFact({ id: "confirmed", text: "I prefer evening study", data: { reconfirmedAt: "2026-09-30T00:00:00.000Z" } }),
    ];
    expect(staleFacts(facts, new Date("2026-10-01T00:00:00.000Z")).map(fact => fact.id)).toEqual(["stale"]);
  });

  it("retrieves keyword and domain matches in relevance order", () => {
    const facts = [
      makeFact({ id: "gym", text: "I go to the gym after class", category: "health", updatedAt: "2026-09-30T00:00:00.000Z" }),
      makeFact({ id: "bio", text: "Biology revision works best in the morning", category: "study", updatedAt: "2026-09-01T00:00:00.000Z" }),
      makeFact({ id: "pending", text: "I revise biology nightly", status: "pending" }),
    ];
    expect(retrieveRelevant(facts, "How should I revise biology before my exam?", 1).map(fact => fact.id)).toEqual(["bio"]);
  });

  it("filters facts by source and topic consent", () => {
    const facts = [
      makeFact({ id: "journal-pref", text: "I work best in the morning" }),
      makeFact({ id: "question-task", text: "I will revise biology", kind: "task", sourceType: "question" }),
      makeFact({ id: "goal", text: "My goal is to pass biology", kind: "goal" }),
    ];
    const filtered = privacyBoundary(facts, { ...consent, tasks: false, planner: false, voice: false });
    expect(filtered.map(fact => fact.id)).toEqual(["journal-pref"]);
  });
});
