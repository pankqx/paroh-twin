"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { dataService } from "@/app/dataService";
import { FACTS_CHANGED } from "@/components/shell/events";

export interface Telemetry {
  load: number; // percent
  fidelity: number; // percent
  approved: number;
  approvedSeries: number[]; // running count of approved facts, oldest first (real history)
  nextDeadlineDays: number | null;
}

const DAY = 86400000;

/** Real values from the DataService only. Null until they have loaded. */
export function useTelemetry(enabled: boolean): Telemetry | null {
  const pathname = usePathname();
  const [t, setT] = useState<Telemetry | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let live = true;
    const run = async () => {
      try {
        const [twin, facts, tasks] = await Promise.all([
          dataService.getTwinState(),
          dataService.facts.list(),
          dataService.tasks.list(),
        ]);
        if (!live) return;
        const approved = facts
          .filter((f) => f.status === "approved")
          .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
        const now = Date.now();
        const due = tasks
          .filter((k) => !k.done && k.dueAt && new Date(k.dueAt).getTime() > now - DAY / 2)
          .map((k) => new Date(k.dueAt!).getTime())
          .sort((a, b) => a - b)[0];
        setT({
          load: Math.round(twin.loadPct),
          fidelity: Math.round(twin.fidelity * 100),
          approved: approved.length,
          approvedSeries: approved.map((_, i) => i + 1).slice(-10),
          nextDeadlineDays: due === undefined ? null : Math.max(0, Math.ceil((due - now) / DAY)),
        });
      } catch {
        /* telemetry is decoration: stay quiet if data is unavailable */
      }
    };
    run();
    window.addEventListener(FACTS_CHANGED, run);
    window.addEventListener("focus", run);
    return () => {
      live = false;
      window.removeEventListener(FACTS_CHANGED, run);
      window.removeEventListener("focus", run);
    };
  }, [enabled, pathname]);

  return t;
}
