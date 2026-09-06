"use server";

import { revalidatePath } from "next/cache";
import { requireInteractive, requireCanActFor } from "@/lib/gate";
import { confirmSportCore, declineSportCore } from "@/lib/sport/core";

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
