"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { dataService } from "@/app/dataService";
import { FACTS_CHANGED } from "./events";

/** Number of facts waiting for approval, kept fresh across screens. */
export function usePendingCount() {
  const pathname = usePathname();
  const [count, setCount] = useState(0);

  useEffect(() => {
    let live = true;
    const refresh = () =>
      dataService.listFacts().then((facts) => {
        if (live) setCount(facts.filter((f) => f.status === "pending").length);
      });
    refresh();
    window.addEventListener(FACTS_CHANGED, refresh);
    window.addEventListener("focus", refresh);
    return () => {
      live = false;
      window.removeEventListener(FACTS_CHANGED, refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [pathname]);

  return count;
}
