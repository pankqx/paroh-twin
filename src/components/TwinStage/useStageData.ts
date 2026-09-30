"use client";

import { useEffect, useState } from "react";
import { dataService } from "@/app/dataService";
import { FACTS_CHANGED } from "@/components/shell/events";
import type { Fact, TwinState } from "@/lib/types";

/** Real values from the DataService for the stage gauges and memory stream, kept fresh. */
export function useStageData(enabled = true): { twin: TwinState | null; facts: Fact[] } {
  const [twin, setTwin] = useState<TwinState | null>(null);
  const [facts, setFacts] = useState<Fact[]>([]);
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    const refresh = () => {
      dataService
        .getTwinState()
        .then((t) => live && setTwin(t))
        .catch(() => {});
      dataService.facts
        .list()
        .then((f) => live && setFacts(f.filter((x) => x.status !== "rejected").sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))))
        .catch(() => {});
    };
    refresh();
    window.addEventListener(FACTS_CHANGED, refresh);
    window.addEventListener("focus", refresh);
    return () => {
      live = false;
      window.removeEventListener(FACTS_CHANGED, refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [enabled]);
  return { twin, facts };
}
