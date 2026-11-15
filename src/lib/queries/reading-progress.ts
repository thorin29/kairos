import "server-only";
import { aheadKeys, loadTrackerCore, manualKeys } from "@/lib/bible/tracker-core";

export type ReadingProgress = {
  /** "Book|chapter" already read toward the next whole-Bible time. Automatic. */
  planCovered: string[];
  /** "Book|chapter" marked in the family's open manual run. */
  manualCovered: string[];
};

/**
 * The family checklist: what's already read toward the next time through the
 * whole Bible (the plan's days and earlier marks, not editable here) beside the
 * open manual run's marks (v0.724).
 */
export async function loadReadingProgress(todayISO: string): Promise<ReadingProgress> {
  const [{ events, startedOver }, manual] = await Promise.all([loadTrackerCore(null, todayISO), manualKeys(null)]);
  const mine = new Set(manual);
  return {
    planCovered: aheadKeys(events, startedOver).filter((k) => !mine.has(k)),
    manualCovered: manual,
  };
}
