import { notifyFactsChanged } from "@/components/shell/events";
import type { Fact } from "@/lib/types";
import { recordGrowth } from "./bloomGrowth";
import { dataService } from "./dataService";

// Approve / reject / edit, shared by Talk, the Approvals page and the Approvals tray.

export async function approveFact(fact: Fact) {
  const before = (await dataService.getTwinState()).confidenceByDomain;
  await dataService.setFactStatus(fact.id, "approve");
  const after = (await dataService.getTwinState()).confidenceByDomain;
  // Remember which domains grew so the Twin page can flare when she next appears.
  recordGrowth(before, after);
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
