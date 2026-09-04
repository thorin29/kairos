"use server";

import { requireInteractive, requireCanActFor } from "@/lib/gate";
import {
  saveMyBookChaptersCore,
  saveMyBooksCore,
} from "@/lib/bible/personal-core";

// Personal Bible reading is logged per person, the same household way chores and
// workouts are: any interactive user on the device can record it for the person
// whose page it's on. The userId is bound by the page, not taken from the login,
// so on the shared wall tablet every person's own card can log their reading.

/** Replace a book's read chapters for `userId` with exactly this set. */
export async function saveMyBookChapters(
  userId: string,
  bookName: string,
  chapters: number[],
): Promise<void> {
  await requireInteractive();
  await requireCanActFor(userId);
  await saveMyBookChaptersCore(userId, bookName, chapters);
}

/** Mark or clear several whole books at once for `userId`. */
export async function saveMyBooks(
  userId: string,
  bookNames: string[],
  read: boolean,
): Promise<void> {
  await requireInteractive();
  await requireCanActFor(userId);
  await saveMyBooksCore(userId, bookNames, read);
}
