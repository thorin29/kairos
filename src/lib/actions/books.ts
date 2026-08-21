"use server";

import { revalidatePath } from "next/cache";
import { requireInteractive } from "@/lib/gate";
import { prisma } from "@/lib/prisma";
import { toDateColumn, todayISO } from "@/lib/dates";

function refresh() {
  revalidatePath("/reading");
  revalidatePath("/");
}

export async function addBook(input: {
  userId: string;
  title: string;
  unit: "PAGES" | "CHAPTERS";
  length: number;
}): Promise<{ error: string | null }> {
  await requireInteractive();
  const title = input.title.trim().slice(0, 120);
  if (!input.userId) return { error: "Whose book is this?" };
  if (title.length < 1) return { error: "Give the book a title." };
  const unit = input.unit === "CHAPTERS" ? "CHAPTERS" : "PAGES";
  const length = Math.max(0, Math.min(100000, Math.round(input.length) || 0));
  if (!length)
    return { error: unit === "PAGES" ? "How many pages?" : "How many chapters?" };
  await prisma.book.create({
    data: { userId: input.userId, title, unit, length },
  });
  refresh();
  return { error: null };
}

/** Set how much was read today (a single per-day figure, so it's easy to fix a
 *  mistake — re-enter the day's total). Zero clears the day. */
export async function logBookReading(
  bookId: string,
  amount: number,
): Promise<void> {
  await requireInteractive();
  if (!bookId) return;
  const amt = Math.max(0, Math.min(100000, Math.round(amount) || 0));
  const day = toDateColumn(todayISO());
  const existing = await prisma.bookLog.findFirst({ where: { bookId, day } });
  if (existing) {
    if (amt === 0) await prisma.bookLog.delete({ where: { id: existing.id } });
    else
      await prisma.bookLog.update({
        where: { id: existing.id },
        data: { amount: amt },
      });
  } else if (amt > 0) {
    await prisma.bookLog.create({ data: { bookId, day, amount: amt } });
  }
  refresh();
}

export async function editBook(
  bookId: string,
  patch: { title?: string; length?: number },
): Promise<void> {
  await requireInteractive();
  if (!bookId) return;
  const data: { title?: string; length?: number } = {};
  if (patch.title !== undefined)
    data.title = patch.title.trim().slice(0, 120) || "Book";
  if (patch.length !== undefined)
    data.length = Math.max(1, Math.min(100000, Math.round(patch.length) || 1));
  if (Object.keys(data).length === 0) return;
  await prisma.book.update({ where: { id: bookId }, data });
  refresh();
}

export async function finishBook(
  bookId: string,
  finished: boolean,
): Promise<void> {
  await requireInteractive();
  if (!bookId) return;
  await prisma.book.update({
    where: { id: bookId },
    data: { finishedAt: finished ? new Date() : null },
  });
  refresh();
}

export async function deleteBook(bookId: string): Promise<void> {
  await requireInteractive();
  if (!bookId) return;
  await prisma.book.delete({ where: { id: bookId } }).catch(() => {});
  refresh();
}
