import type { Category, Decision, Fact, Goal, Habit, JournalEntry, SampleData, Scenario, Task, CheckIn } from "../lib/types";

// Fictional demo persona. All dates are generated from the seed date, not a calendar year.
export const SAMPLE_STUDENT_NAME = "Frank (sample)";

type TaskSeed = { title: string; category: Category; estHours: number; actualHours: number; goalId?: string; dueInDays?: number; dueHour?: number };
const completedSeeds: TaskSeed[] = [
  { title: "Review cell biology notes", category: "study", estHours: 2, actualHours: 2.6, goalId: "goal-1" },
  { title: "Make exam flashcards", category: "study", estHours: 1.5, actualHours: 2, goalId: "goal-1" },
  { title: "Practice genetics questions", category: "study", estHours: 2, actualHours: 2.7, goalId: "goal-1" },
  { title: "Read lecture chapter 4", category: "study", estHours: 1, actualHours: 1.3, goalId: "goal-1" },
  { title: "Summarise lab methods", category: "study", estHours: 1.5, actualHours: 1.9, goalId: "goal-1" },
  { title: "Mock exam section A", category: "study", estHours: 2, actualHours: 2.6, goalId: "goal-1" },
  { title: "Review missed mock questions", category: "study", estHours: 1.5, actualHours: 2, goalId: "goal-1" },
  { title: "Revise biology diagrams", category: "study", estHours: 1, actualHours: 1.3, goalId: "goal-1" },
  { title: "Research project outline", category: "study", estHours: 2, actualHours: 2.6, goalId: "goal-2" },
  { title: "Collect project sources", category: "study", estHours: 2, actualHours: 2.7, goalId: "goal-2" },
  { title: "Draft project introduction", category: "study", estHours: 2, actualHours: 2.5, goalId: "goal-2" },
  { title: "Create project charts", category: "study", estHours: 1.5, actualHours: 2, goalId: "goal-2" },
  { title: "Attend seminar", category: "career", estHours: 1, actualHours: 1.1 },
  { title: "Update portfolio", category: "career", estHours: 1.5, actualHours: 1.8 },
  { title: "Plan weekly schedule", category: "personal", estHours: 0.5, actualHours: 0.5 },
  { title: "Call project partner", category: "personal", estHours: 0.5, actualHours: 0.6 },
  { title: "Meal prep", category: "health", estHours: 1, actualHours: 1.1 },
  { title: "Walk in the park", category: "health", estHours: 0.5, actualHours: 0.5 },
  { title: "Book library room", category: "other", estHours: 0.25, actualHours: 0.3 },
  { title: "Organise class notes", category: "other", estHours: 0.5, actualHours: 0.6 },
];

const openSeeds: TaskSeed[] = [
  { title: "Revise for biology exam", category: "study", estHours: 2, actualHours: 0, goalId: "goal-1", dueInDays: 2, dueHour: 9 },
  { title: "Review exam formulas", category: "study", estHours: 1, actualHours: 0, goalId: "goal-1", dueInDays: 2, dueHour: 9 },
  { title: "Finish project discussion", category: "study", estHours: 2, actualHours: 0, goalId: "goal-2", dueInDays: 4, dueHour: 18 },
  { title: "Proofread project report", category: "study", estHours: 1.5, actualHours: 0, goalId: "goal-2", dueInDays: 4, dueHour: 18 },
  { title: "Prepare seminar notes", category: "career", estHours: 1, actualHours: 0, dueInDays: 8, dueHour: 16 },
  { title: "Update portfolio", category: "career", estHours: 1.5, actualHours: 0, dueInDays: 12, dueHour: 16 },
  { title: "Plan next study cycle", category: "personal", estHours: 0.5, actualHours: 0, dueInDays: 18, dueHour: 12 },
];

const entryBodies = [
  "I reviewed two biology chapters and want to keep using flashcards.",
  "The genetics practice took longer than I planned. I will do a shorter set tomorrow.",
  "I went for a walk after lunch and focused well during the afternoon study block.",
  "I collected sources for my research project and need to finish the draft before its deadline.",
  "Morning review works well for me; I prefer quiet study at the library.",
  "I completed a mock exam and will revise the questions I missed before the biology exam.",
  "I slept late after editing. Tonight I will stop studying by 10:30 pm.",
  "I finished the project charts and plan to proofread the report before submitting it.",
];

function dayAt(seed: Date, offset: number, hour = 12): Date {
  const date = new Date(seed);
  date.setDate(date.getDate() + offset);
  date.setHours(hour, 0, 0, 0);
  return date;
}

function previousWeekday(seed: Date, weekday: number, weeksBack: number): Date {
  const date = new Date(seed);
  date.setHours(0, 0, 0, 0);
  const daysBack = ((date.getDay() - weekday + 7) % 7) || 7;
  date.setDate(date.getDate() - daysBack - weeksBack * 7);
  return date;
}

const iso = (date: Date) => date.toISOString();
const dateKey = (date: Date) => date.toISOString().slice(0, 10);

function makeDecisions(seed: Date): Decision[] {
  return Array.from({ length: 6 }, (_, i) => {
    const scenarios: Scenario[] = [
      { id: `decision-${i + 1}-a`, label: "Deadline first", summary: "Make progress on the closest deadline.", onTimeProb: 0.76 - i * 0.02, peakLoad: 0.72, goalImpact: 0.12, assumptions: ["Uses Frank's recorded task-hour ratios."] },
      { id: `decision-${i + 1}-b`, label: "Take a lighter evening", summary: "Choose a smaller task and leave time to rest.", onTimeProb: 0.64 - i * 0.02, peakLoad: 0.48, goalImpact: -0.03, assumptions: ["Uses Frank's recorded task-hour ratios."] },
    ];
    const predictedChoiceId = scenarios[i % 2].id;
    const hasChoice = i < 5;
    const predictedWasRight = [true, false, true, false, true][i];
    const chosenScenarioId = hasChoice
      ? scenarios[predictedWasRight ? i % 2 : (i + 1) % 2].id
      : undefined;
    return {
      id: `decision-${i + 1}`,
      prompt: ["Study or rest?", "Revise or work on project?", "Walk or keep studying?", "Finish draft or review notes?", "Sleep or polish slides?", "Practice or organise notes?"][i],
      scenarios,
      recommendedId: scenarios[0].id,
      predictedChoiceId,
      userChoice: hasChoice ? (chosenScenarioId === scenarios[0].id ? "accept" : "reject") : undefined,
      chosenScenarioId,
      createdAt: iso(dayAt(seed, -5 + i, 12)),
      updatedAt: iso(dayAt(seed, -5 + i, 12)),
    };
  });
}

export function createSampleData(seedDate = new Date()): SampleData {
  const seed = new Date(seedDate);
  const goals: Goal[] = [
    { id: "goal-1", title: "Prepare for biology exam", category: "study", progress: 0.72, targetDate: iso(dayAt(seed, 2, 9)), createdAt: iso(dayAt(seed, -26)), updatedAt: iso(seed) },
    { id: "goal-2", title: "Finish research project", category: "study", progress: 0.58, targetDate: iso(dayAt(seed, 4, 18)), createdAt: iso(dayAt(seed, -24)), updatedAt: iso(seed) },
    { id: "goal-3", title: "Keep a steady sleep routine", category: "health", progress: 0.81, targetDate: iso(dayAt(seed, 20)), createdAt: iso(dayAt(seed, -22)), updatedAt: iso(seed) },
  ];

  // Eighteen weekday sessions and two lighter weekend sessions across four weeks.
  const weekdaySlots: Array<{ date: Date; hour: number }> = [];
  for (let week = 0; week < 4; week++) {
    for (const weekday of [1, 2, 3, 4, 5]) weekdaySlots.push({ date: previousWeekday(seed, weekday, week), hour: 8 + ((week + weekday) % 2) * 10 });
  }
  weekdaySlots.splice(3, 1);
  weekdaySlots.splice(12, 1);
  const weekendSlots = [
    { date: previousWeekday(seed, 0, 1), hour: 10 },
    { date: previousWeekday(seed, 6, 3), hour: 17 },
  ];
  const completedTimes = [...weekdaySlots, ...weekendSlots].sort((a, b) => a.date.getTime() - b.date.getTime());

  const tasks: Task[] = [
    ...completedSeeds.map((task, i) => {
      const completedAt = new Date(completedTimes[i].date);
      completedAt.setHours(completedTimes[i].hour + (i % 3 === 0 ? 1 : 0), 0, 0, 0);
      const createdAt = new Date(completedAt.getTime() - 2 * 60 * 60 * 1000);
      return { ...task, id: `task-${i + 1}`, done: true, dueAt: undefined, completedAt: iso(completedAt), createdAt: iso(createdAt), updatedAt: iso(completedAt) };
    }),
    ...openSeeds.map((task, i) => ({
      ...task,
      id: `task-${completedSeeds.length + i + 1}`,
      done: false,
      dueAt: iso(dayAt(seed, task.dueInDays ?? 0, task.dueHour ?? 18)),
      actualHours: undefined,
      completedAt: undefined,
      createdAt: iso(dayAt(seed, -Math.max(2, (task.dueInDays ?? 1) + 1))),
      updatedAt: iso(seed),
    })),
  ];

  const habitRows: Array<{ title: string; category: Category; completedOffsets: number[] }> = [
    { title: "Morning review", category: "study", completedOffsets: [0, 1, 2, 4, 5, 6, 7, 8, 10, 11, 12, 13] },
    { title: "Focused study block", category: "study", completedOffsets: [0, 1, 2, 3, 5, 6, 8, 9, 10, 12, 13] },
    { title: "Evening walk", category: "health", completedOffsets: [0, 2, 3, 4, 6, 7, 9, 10, 11, 13] },
    { title: "Read for pleasure", category: "personal", completedOffsets: [1, 2, 4, 5, 7, 8, 10, 12] },
    { title: "Sleep before 11", category: "health", completedOffsets: [0, 1, 3, 4, 5, 7, 8, 9, 11, 12, 13] },
  ];
  const habits: Habit[] = habitRows.map((habit, i) => ({
    id: `habit-${i + 1}`, title: habit.title, category: habit.category,
    log: Object.fromEntries(Array.from({ length: 14 }, (_, index) => {
      const daysAgo = 13 - index;
      return [dateKey(dayAt(seed, -daysAgo)), habit.completedOffsets.includes(index)];
    })),
    createdAt: iso(dayAt(seed, -27)), updatedAt: iso(seed),
  }));

  const mood = [3, 4, 4, 2, 3, 5, 4, 3, 4, 2, 3, 4, 5, 4] as const;
  const energy = [3, 4, 3, 2, 3, 4, 4, 3, 5, 2, 3, 4, 4, 3] as const;
  const checkins: CheckIn[] = Array.from({ length: 14 }, (_, i) => {
    const day = dayAt(seed, i - 13, 20);
    return { id: `checkin-${i + 1}`, date: dateKey(day), mood: mood[i], energy: energy[i], createdAt: iso(day), updatedAt: iso(day) };
  });

  const entries: JournalEntry[] = entryBodies.map((body, i) => {
    const createdAt = iso(dayAt(seed, -20 + i * 2, 9));
    return { id: `entry-${i + 1}`, title: ["Study notes", "A longer practice set", "A good reset", "Project progress", "My study setup", "Mock exam", "A late night", "Nearly there"][i],
      body, tags: [i < 2 || i === 5 ? "study" : "journal"], mood: ([4, 3, 4, 3, 4, 3, 2, 4][i]) as JournalEntry["mood"], createdAt, updatedAt: createdAt };
  });
  const decisions = makeDecisions(seed);
  const facts: Fact[] = [];
  return { studentName: SAMPLE_STUDENT_NAME, tasks, goals, habits, checkins, entries, decisions, facts };
}

// Stable module exports for existing consumers; LocalDataService uses the factory at seed time.
export const sampleData = createSampleData();
export const sampleTasks = sampleData.tasks;
export const sampleGoals = sampleData.goals;
export const sampleHabits = sampleData.habits;
export const sampleCheckins = sampleData.checkins;
export const sampleEntries = sampleData.entries;
export const sampleDecisions = sampleData.decisions;
export const sampleFacts = sampleData.facts;
export default sampleData;
