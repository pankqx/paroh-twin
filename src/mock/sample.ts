import type { Decision, Fact, Goal, Habit, JournalEntry, SampleData, Scenario, Task, CheckIn, Category } from "../lib/types";

// Fictional demo persona. Dates are fixed so the sample and tests stay reproducible.
export const SAMPLE_STUDENT_NAME = "Asha (sample)";
const created = (day: number, hour = 9) => `2026-09-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:00:00.000Z`;

const goalSeeds: Array<[string, Category, number, string]> = [
  ["Prepare for biology exam", "study", 0.72, "2026-10-02T09:00:00.000Z"],
  ["Finish research project", "study", 0.58, "2026-10-03T18:00:00.000Z"],
  ["Keep a steady sleep routine", "health", 0.81, "2026-10-20T00:00:00.000Z"],
];
export const sampleGoals: Goal[] = goalSeeds.map(([title, category, progress, targetDate], i) => ({
  id: `goal-${i + 1}`, title, category, progress, targetDate, createdAt: created(8), updatedAt: created(30),
}));

const taskSeeds: Array<[string, Category, number, number, number, string, boolean, string?]> = [
  ["Review cell biology notes", "study", 2, 2.6, 9, "2026-10-02T09:00:00.000Z", true, "goal-1"],
  ["Make exam flashcards", "study", 1.5, 2, 10, "2026-10-02T09:00:00.000Z", true, "goal-1"],
  ["Practice genetics questions", "study", 2, 2.7, 12, "2026-10-02T09:00:00.000Z", true, "goal-1"],
  ["Read lecture chapter 4", "study", 1, 1.3, 13, "2026-10-02T09:00:00.000Z", true, "goal-1"],
  ["Summarise lab methods", "study", 1.5, 1.9, 14, "2026-10-02T09:00:00.000Z", true, "goal-1"],
  ["Mock exam section A", "study", 2, 2.5, 15, "2026-10-02T09:00:00.000Z", true, "goal-1"],
  ["Review missed mock questions", "study", 1.5, 2, 16, "2026-10-02T09:00:00.000Z", true, "goal-1"],
  ["Revise diagrams", "study", 1, 1.3, 17, "2026-10-02T09:00:00.000Z", true, "goal-1"],
  ["Research project outline", "study", 2, 2.6, 18, "2026-10-03T18:00:00.000Z", true, "goal-2"],
  ["Collect project sources", "study", 2, 2.7, 19, "2026-10-03T18:00:00.000Z", true, "goal-2"],
  ["Draft project introduction", "study", 2, 2.5, 20, "2026-10-03T18:00:00.000Z", true, "goal-2"],
  ["Create project charts", "study", 1.5, 2, 21, "2026-10-03T18:00:00.000Z", true, "goal-2"],
  ["Edit project discussion", "study", 2, 2.8, 22, "2026-10-03T18:00:00.000Z", false, "goal-2"],
  ["Proofread project", "study", 1, 1.4, 23, "2026-10-03T18:00:00.000Z", false, "goal-2"],
  ["Submit project report", "study", 0.5, 0, 24, "2026-10-03T18:00:00.000Z", false, "goal-2"],
  ["Attend seminar", "career", 1, 1, 8, "2026-09-08T16:00:00.000Z", true],
  ["Update portfolio", "career", 1.5, 1.8, 11, "2026-09-11T16:00:00.000Z", true],
  ["Plan weekly schedule", "personal", 0.5, 0.5, 12, "2026-09-12T12:00:00.000Z", true],
  ["Call project partner", "personal", 0.5, 0.4, 15, "2026-09-15T16:00:00.000Z", true],
  ["Organise desk", "personal", 0.5, 0.6, 16, "2026-09-16T12:00:00.000Z", true],
  ["Meal prep", "health", 1, 1.1, 17, "2026-09-17T17:00:00.000Z", true],
  ["Walk in the park", "health", 0.5, 0.5, 19, "2026-09-19T17:00:00.000Z", true],
  ["Book library room", "other", 0.25, 0.2, 20, "2026-09-20T12:00:00.000Z", true],
  ["Return borrowed book", "personal", 0.25, 0.25, 21, "2026-09-21T12:00:00.000Z", true],
  ["Review project feedback", "study", 1, 1.4, 23, "2026-10-03T18:00:00.000Z", false, "goal-2"],
  ["Revise for biology exam", "study", 2, 0, 24, "2026-10-02T09:00:00.000Z", false, "goal-1"],
];
export const sampleTasks: Task[] = taskSeeds.map(([title, category, estHours, actualHours, day, dueAt, done, goalId], i) => ({
  id: `task-${i + 1}`, title, category, estHours, actualHours: done ? actualHours : undefined, dueAt, done, goalId,
  completedAt: done ? created(day, 17) : undefined, createdAt: created(Math.max(1, day - 2)), updatedAt: created(day),
}));

const days = Array.from({ length: 14 }, (_, i) => new Date(Date.UTC(2026, 8, 17 + i)).toISOString().slice(0, 10));
const habitSeeds: Array<[string, Category, number[]]> = [
  ["Morning review", "study", [0,1,2,3,5,6,7,8,10,11,12,13]],
  ["Focused study block", "study", [0,1,2,4,5,6,8,9,10,12,13]],
  ["Evening walk", "health", [0,2,3,4,6,7,9,10,11,13]],
  ["Read for pleasure", "personal", [1,2,4,5,7,8,10,12]],
  ["Sleep before 11", "health", [0,1,3,4,5,7,8,9,11,12,13]],
];
export const sampleHabits: Habit[] = habitSeeds.map(([title, category, completed], i) => ({
  id: `habit-${i + 1}`, title, category,
  log: Object.fromEntries(days.map((day, n) => [day, completed.includes(n)])),
  createdAt: created(17), updatedAt: created(30),
}));

export const sampleCheckins: CheckIn[] = days.map((date, i) => ({
  id: `checkin-${i + 1}`, date, mood: ([3,4,4,2,3,5,4,3,4,2,3,4,5,4][i]) as CheckIn["mood"],
  energy: ([3,4,3,2,3,4,4,3,5,2,3,4,4,3][i]) as CheckIn["energy"], createdAt: `${date}T20:00:00.000Z`, updatedAt: `${date}T20:00:00.000Z`,
}));

const entryBodies = [
  "I reviewed two biology chapters and want to keep using flashcards.",
  "The genetics practice took longer than I planned. I will do a shorter set tomorrow.",
  "I went for a walk after lunch and felt more focused for the afternoon study block.",
  "I collected sources for my research project and need to finish the draft by October 3.",
  "Morning review works well for me; I prefer quiet study at the library.",
  "I completed a mock exam and will revise the questions I missed before the biology exam on October 2.",
  "I slept late after editing. Tonight I will stop studying by 10:30 pm.",
  "I finished the project charts and plan to proofread the report before submitting it.",
];
export const sampleEntries: JournalEntry[] = entryBodies.map((body, i) => ({
  id: `entry-${i + 1}`, title: ["Study notes", "A longer practice set", "A good reset", "Project progress", "My study setup", "Mock exam", "A late night", "Nearly there"][i],
  body, tags: [i < 2 || i === 5 ? "study" : "journal"], mood: ([4,3,4,3,4,3,2,4][i]) as JournalEntry["mood"],
  createdAt: created(20 + i), updatedAt: created(20 + i),
}));

const scenariosFor = (label: string, onTimeProb: number): Scenario[] => [
  { id: `${label}-a`, label: "Accept", summary: "Follow the twin's suggested plan.", onTimeProb, peakLoad: 0.72, goalImpact: 0.12, assumptions: ["Uses Asha's recorded task-hour ratios."] },
  { id: `${label}-b`, label: "Alternative", summary: "Choose the other priority first.", onTimeProb: onTimeProb - 0.12, peakLoad: 0.88, goalImpact: -0.05, assumptions: ["Uses Asha's recorded task-hour ratios."] },
];
export const sampleDecisions: Decision[] = Array.from({ length: 6 }, (_, i) => {
  const scenarios = scenariosFor(`decision-${i + 1}`, 0.76 - i * 0.025);
  const predictedChoiceId = scenarios[i % 2].id;
  return { id: `decision-${i + 1}`, prompt: ["Study or rest?", "Revise or work on project?", "Walk or keep studying?", "Finish draft or review notes?", "Sleep or polish slides?", "Practice or organise notes?"][i], scenarios,
    recommendedId: scenarios[0].id, predictedChoiceId, userChoice: i < 5 ? (i % 2 === 0 ? "accept" : "reject") : undefined,
    chosenScenarioId: i < 5 ? scenarios[i % 2 === 0 ? 0 : 0].id : undefined, createdAt: created(25 + i), updatedAt: created(25 + i) };
});

export const sampleFacts: Fact[] = [];
export const sampleData: SampleData = {
  studentName: SAMPLE_STUDENT_NAME, tasks: sampleTasks, goals: sampleGoals, habits: sampleHabits,
  checkins: sampleCheckins, entries: sampleEntries, decisions: sampleDecisions, facts: sampleFacts,
};
export default sampleData;
