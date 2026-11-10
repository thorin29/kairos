"use server";

import { revalidatePath } from "next/cache";
import { requireInteractive, requireCanActFor } from "@/lib/gate";
import { confirmSportCore, declineSportCore, editSportSessionCore } from "@/lib/sport/core";

/** "Yes, I did it." Logs the SPORT session + marks the exercise task done. */
export async function confirmSportWorkout(
  eventId: string,
  userId: string,
  dateISO: string,
): Promise<void> {
  await requireInteractive();
  await requireCanActFor(userId);
  await confirmSportCore(eventId, userId, dateISO);
  revalidatePath("/", "layout");
}

/** "No." Remembered for this person + this occurrence so the prompt stops. */
export async function declineSportWorkout(
  eventId: string,
  userId: string,
  dateISO: string,
): Promise<void> {
  await requireInteractive();
  await requireCanActFor(userId);
  await declineSportCore(eventId, userId, dateISO);
  revalidatePath("/", "layout");
}

/** Change a calendar-confirmed session afterwards (v0.656): how hard, and its
 *  minutes when its event type's time varies. */
export async function editSportSession(
  userId: string,
  input: { sessionId: string; minutes?: number | null; effort?: string | null; hurt?: string | null },
): Promise<boolean> {
  await requireInteractive();
  await requireCanActFor(userId);
  const ok = await editSportSessionCore(userId, input);
  revalidatePath("/", "layout");
  return ok;
}
