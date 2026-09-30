import type { ConnectorKind } from "../lib/data/DataService";

/** Fictional student-life messages used to preview connector fact extraction. */
export const connectorSamples: Record<ConnectorKind, string[]> = {
  gmail: [
    "The history assignment deadline is October 5.",
    "I will submit my biology assignment by October 7.",
    "The exam timetable has chemistry on October 9.",
  ],
  whatsapp: [
    "We have a group study plan for biology tomorrow at 4 pm.",
    "Let's revise chemistry together tomorrow.",
    "I will review the assignment with the group by October 6.",
  ],
  telegram: [
    "The physics exam timetable lists October 10.",
    "I will finish the project draft by October 8.",
    "We plan a group study session for maths on Friday.",
  ],
  calendar: [
    "Gym slot: I will go to the gym tomorrow at 6 pm.",
    "Group study session for biology is on October 7.",
    "Exam timetable: statistics exam on October 11.",
  ],
};
