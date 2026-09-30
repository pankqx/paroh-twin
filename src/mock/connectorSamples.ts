import type { ConnectorKind } from "../lib/data/DataService";

export type { ConnectorKind };

/** Fictional messages for the sample-only connector preview. */
export const connectorSamples: Record<ConnectorKind, string[]> = {
  gmail: [
    "Professor says the biology assignment is due tomorrow.",
    "Exam timetable: chemistry exam on October 7.",
    "Can we meet for group study in the library tomorrow at 4 pm?",
  ],
  whatsapp: [
    "Let's meet for group study tomorrow at 5 pm.",
    "I will submit my history assignment by October 9.",
    "I will go to the gym tomorrow at 6 pm.",
  ],
  telegram: [
    "The exam timetable lists the physics exam on October 11.",
    "I will finish my project draft by October 8.",
    "Let's schedule group study tomorrow at 3 pm.",
  ],
  calendar: [
    "Biology assignment deadline is tomorrow.",
    "Group study session for chemistry tomorrow at 4 pm.",
    "Gym slot: I will go to the gym tomorrow at 6 pm.",
  ],
};
