"use server";

import { requireInteractive, requireCanActFor } from "@/lib/gate";
import { dayLogFor } from "@/lib/queries/completion";

export type DayLogItem = {
  title: string;
  category: string;
  done: boolean;
  skipped: boolean;
  /** Due this day, finished later on this day (v0.733). */
  doneOn?: string;
  /** Finished this day, late from this earlier day (v0.733). */
  from?: string;
};

/** What a person actually did (and didn't) on a given day — the day log
 *  popup on Characters and the Summary grid. Read-only. */
export async function personDayLog(
  userId: string,
  dayISO: string,
): Promise<{ items: DayLogItem[]; doneCount: number; assigned: number }> {
  await requireInteractive();
  await requireCanActFor(userId);
  if (!userId || !/^\d{4}-\d{2}-\d{2}$/.test(dayISO)) {
    return { items: [], doneCount: 0, assigned: 0 };
  }
  return dayLogFor(userId, dayISO);
}
