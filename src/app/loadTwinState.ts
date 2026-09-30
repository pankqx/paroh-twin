import type { TwinState } from "@/lib/types";
import { twinStateStub } from "@/mock/twinStateStub";

/**
 * Single seam for the Twin page's state. Once src/lib/data/LocalDataService.ts
 * exists, read `getTwinState()` from it here; the stub keeps the page rendering
 * until then.
 */
export async function loadTwinState(): Promise<TwinState> {
  return twinStateStub;
}
