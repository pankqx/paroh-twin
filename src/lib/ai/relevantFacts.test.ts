import { describe, expect, it } from "vitest";
import type { Fact } from "../types";
import { relevantFacts } from "./relevantFacts";

const fact = (id: string, text: string, updatedAt: string, data: Record<string, unknown> = {}): Fact => ({
  id, kind: "preference", text, category: "study", data, sourceId: "test", sourceType: "manual", status: "approved", confidence: 1, createdAt: updatedAt, updatedAt,
});

describe("relevantFacts", () => {
  it("ranks keyword and category matches, respects k, and drops superseded facts", () => {
    const facts = [
      fact("old", "I study biology in the morning", "2026-09-01T00:00:00.000Z", { supersededBy: "new" }),
      fact("biology", "Biology revision works best in the morning", "2026-09-20T00:00:00.000Z"),
      fact("gym", "I prefer gym after class", "2026-09-29T00:00:00.000Z"),
    ];
    expect(relevantFacts("How should I revise for my biology exam?", facts, 1).map(item => item.id)).toEqual(["biology"]);
    expect(relevantFacts("biology", facts, 5).map(item => item.id)).not.toContain("old");
  });
});
