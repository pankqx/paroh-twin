import { localDataService } from "@/lib/data/LocalDataService";

/**
 * The one place the UI picks its data implementation. Swap for an API-backed
 * service here later; pages and components import from this file only.
 */
export const dataService = localDataService;
