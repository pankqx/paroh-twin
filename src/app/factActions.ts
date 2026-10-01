import { notifyFactsChanged } from "@/components/shell/events";
import type { Fact } from "@/lib/types";
import { recordGrowth } from "./bloomGrowth";
import { describeChange, recordChange, type Snapshot } from "./lastChange";
import { dataService } from "./dataService";

// Approve / reject / edit, shared by Talk, the Approvals page and the Approvals tray.

async function snapshot(): Promise<Snapshot> {
  const [twin, tasks, goals, habits, facts] = await Promise.all([
    dataService.getTwinState(),
    dataService.tasks.list(),
    dataService.goals.list(),
    dataService.habits.list(),
    dataService.facts.list(),
  ]);
  return { twin, tasks: tasks.length, goals: goals.length, habits: habits.length, facts: facts.filter((f) => f.status === "approved").length };
}

export async function approveFact(fact: Fact) {
  const before = await snapshot();
  await dataService.setFactStatus(fact.id, "approve");
  const after = await snapshot();
  // Remember which domains grew so the Twin page can flare when she next appears.
  recordGrowth(before.twin.confidenceByDomain, after.twin.confidenceByDomain);
  // And exactly how the dashboard moved, shown on the Twin page.
  recordChange(describeChange(fact, before, after));
  notifyFactsChanged();
}

export async function rejectFact(fact: Fact) {
  await dataService.setFactStatus(fact.id, "reject");
  notifyFactsChanged();
}

export async function editFact(fact: Fact, text: string) {
  await dataService.setFactStatus(fact.id, "edit", { text });
  notifyFactsChanged();
}
