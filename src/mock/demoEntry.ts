import type { Fact } from "../lib/types";

export const demoEntry = {
  id: "demo-journal-entry",
  title: "A focused study week",
  body: "I have a biology exam tomorrow and need 2 hours to revise. I will work on my project tonight. I prefer quiet study at the library. I want to keep my morning review habit.",
  tags: ["study", "demo"],
  createdAt: "2026-09-30T09:00:00.000Z",
};

const stamp = demoEntry.createdAt;
export const demoFacts: Fact[] = [
  { id: "demo-fact-deadline", kind: "deadline", text: "Biology exam tomorrow", category: "study", data: { due: "2026-10-01T09:00:00.000Z", subject: "biology exam" }, sourceId: demoEntry.id, sourceType: "journal", status: "pending", confidence: 0.96, createdAt: stamp, updatedAt: stamp },
  { id: "demo-fact-task", kind: "task", text: "Revise for 2 hours", category: "study", data: { title: "Revise for biology exam", estHours: 2, due: "2026-10-01T09:00:00.000Z" }, sourceId: demoEntry.id, sourceType: "journal", status: "pending", confidence: 0.94, createdAt: stamp, updatedAt: stamp },
  { id: "demo-fact-project", kind: "task", text: "Work on my project tonight", category: "study", data: { title: "Work on project", due: "2026-09-30T23:00:00.000Z" }, sourceId: demoEntry.id, sourceType: "journal", status: "pending", confidence: 0.9, createdAt: stamp, updatedAt: stamp },
  { id: "demo-fact-preference", kind: "preference", text: "I prefer quiet study at the library", category: "study", data: { preference: "quiet study at the library" }, sourceId: demoEntry.id, sourceType: "journal", status: "pending", confidence: 0.94, createdAt: stamp, updatedAt: stamp },
  { id: "demo-fact-habit", kind: "habit", text: "I want to keep my morning review habit", category: "study", data: { title: "Morning review" }, sourceId: demoEntry.id, sourceType: "journal", status: "pending", confidence: 0.9, createdAt: stamp, updatedAt: stamp },
];
