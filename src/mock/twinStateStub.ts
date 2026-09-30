import type { TwinState } from "@/lib/types";

// Deterministic 7 (Mon-Sun) x 24 focus heatmap for the sample student.
// Weekday mornings and evenings are strong, weekends are lighter.
const WEEKDAY = [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.05, 0.15, 0.55, 0.8, 0.9, 0.6, 0.2, 0.15, 0.4, 0.55, 0.45, 0.25, 0.2, 0.5, 0.85, 0.75, 0.4, 0.1];
const WEEKEND = [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.1, 0.3, 0.55, 0.5, 0.2, 0.1, 0.25, 0.4, 0.35, 0.2, 0.1, 0.15, 0.4, 0.35, 0.15, 0.0];

const heatmap: number[][] = [
  WEEKDAY, // Mon
  WEEKDAY.map((v, h) => (h >= 19 && h <= 21 ? Math.min(1, v + 0.1) : v)), // Tue
  WEEKDAY.map((v) => Math.round(v * 0.85 * 100) / 100), // Wed
  WEEKDAY, // Thu
  WEEKDAY.map((v, h) => (h >= 14 ? Math.round(v * 0.6 * 100) / 100 : v)), // Fri
  WEEKEND, // Sat
  WEEKEND.map((v) => Math.round(v * 0.7 * 100) / 100), // Sun
];

export const twinStateStub: TwinState = {
  confidenceByDomain: {
    tasks: 0.82,
    habits: 0.64,
    routines: 0.45,
    energy: 0.58,
    goals: 0.7,
    planner: 0.18, // below 0.3 renders as a dashed leaf
  },
  loadPct: 72,
  habitConsistency: 0.71,
  goalAlignment: 0.56,
  estimationBias: {
    study: 1.3,
    health: 1.05,
    personal: 1.1,
    career: 1.2,
    other: 1.0,
  },
  heatmap,
  fidelity: 0.6,
  updatedAt: "2026-09-30T10:00:00.000Z",
};
