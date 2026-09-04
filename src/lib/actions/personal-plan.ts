"use server";

import { requireInteractive, requireCanActFor } from "@/lib/gate";
import {
  generatePersonalPlanCore,
  deletePersonalPlanCore,
  markPersonalReadingCore,
} from "@/lib/bible/personal-core";

/** Generate a personal reading plan for `userId` from a set of books, a start
 *  date and a chapters-per-day pace. Replaces any existing personal plan (the
 *  chapters already read are kept — they live in the person's own record, not on
 *  the plan). */
export async function generatePersonalPlan(
  userId: string,
  input: {
    name: string;
    bookNames: string[];
    startISO: string;
    chaptersPerDay: number;
  },
): Promise<{ error: string | null }> {
  await requireInteractive();
  await requireCanActFor(userId);
  return generatePersonalPlanCore(userId, input);
}

export async function deletePersonalPlan(userId: string): Promise<void> {
  await requireInteractive();
  await requireCanActFor(userId);
  await deletePersonalPlanCore(userId);
}

/** Tick (or untick) a day's reading: mark exactly that passage's chapters in the
 *  person's own record, which feeds their coverage stats and Wisdom. */
export async function markPersonalReading(
  userId: string,
  passage: string,
  read: boolean,
): Promise<void> {
  await requireInteractive();
  await requireCanActFor(userId);
  await markPersonalReadingCore(userId, passage, read);
}
