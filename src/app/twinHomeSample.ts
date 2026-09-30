// TEMPORARY view data for the Twin page, so it renders before LocalDataService
// exists. Replace with data read through the DataService (tasks, goals, facts).
import type { FactKind } from "@/lib/types";

export const STUDENT_NAME = "Asha";
export const WAITING_FOR_REVIEW = 3;

export interface Deadline {
  id: string;
  title: string;
  due: string; // ISO date
  onTime: number; // 0-1
}

export interface GoalRow {
  id: string;
  title: string;
  target: string; // ISO date
  progress: number; // 0-1
}

export interface MemoryRow {
  id: string;
  date: string; // ISO date
  text: string;
  kind: FactKind;
}

export const deadlines: Deadline[] = [
  { id: "d1", title: "Data Structures exam", due: "2026-10-02", onTime: 0.68 },
  { id: "d2", title: "Networks project report", due: "2026-10-03", onTime: 0.82 },
  { id: "d3", title: "Lab record submission", due: "2026-10-05", onTime: 0.46 },
];

export const goals: GoalRow[] = [
  { id: "g1", title: "Finish semester project", target: "2026-10-20", progress: 0.62 },
  { id: "g2", title: "Study 10 hours a week", target: "2026-12-15", progress: 0.48 },
  { id: "g3", title: "Sleep before midnight", target: "2026-11-30", progress: 0.35 },
];

export const memory: MemoryRow[] = [
  { id: "m1", date: "2026-09-29", text: "Studies best in the evening, after 8pm.", kind: "preference" },
  { id: "m2", date: "2026-09-27", text: "Networks report is due on 3 Oct.", kind: "deadline" },
  { id: "m3", date: "2026-09-24", text: "Wants to build a daily revision habit.", kind: "habit" },
  { id: "m4", date: "2026-09-21", text: "Study tasks usually take about 30% longer than planned.", kind: "task" },
  { id: "m5", date: "2026-09-18", text: "Finish the semester project before the mid-term break.", kind: "goal" },
];
