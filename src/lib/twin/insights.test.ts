import { describe, expect, it } from "vitest";
import type { TwinData } from "../types";
import { predictedNeeds, twinInsights } from "./insights";

const base: TwinData = { tasks: [], goals: [], habits: [], checkins: [], decisions: [], now: "2026-10-01T08:00:00.000Z" };
const task = (id: string, actualHours: number, completedAt: string) => ({ id, title: `Study ${id}`, category: "study" as const, estHours: 1, actualHours, done: true, completedAt, createdAt: completedAt, updatedAt: completedAt });

describe("twin insights and predicted needs", () => {
  it("computes estimate and completion patterns from the provided records", () => {
    const data = { ...base, tasks: [task("a", 1.3, "2026-09-29T09:10:00.000Z"), task("b", 1.3, "2026-10-01T09:20:00.000Z"), task("c", 1.3, "2026-09-24T09:30:00.000Z")] };
    expect(twinInsights(data)).toContain("Study tasks take 1.3x longer than you estimate.");
    expect(twinInsights(data).some(text => text.includes("finish most work Thu around 8:00–10:00"))).toBe(true);
  });

  it("returns the two nearest upcoming task or habit needs", () => {
    const data = {
      ...base,
      tasks: [
        { id: "exam", title: "Biology exam", category: "study" as const, estHours: 2, dueAt: "2026-10-02T12:00:00.000Z", done: false, createdAt: "2026-09-30T00:00:00.000Z", updatedAt: "2026-09-30T00:00:00.000Z" },
        { id: "project", title: "Project deadline", category: "study" as const, estHours: 3, dueAt: "2026-10-04T12:00:00.000Z", done: false, createdAt: "2026-09-30T00:00:00.000Z", updatedAt: "2026-09-30T00:00:00.000Z" },
      ],
    };
    expect(predictedNeeds(data)).toEqual(["a revision block before Biology exam tomorrow.", "a revision block before Project deadline in 3 days."]);
  });
});
