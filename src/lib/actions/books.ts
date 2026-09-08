"use server";

import { revalidatePath } from "next/cache";
import { requireInteractive, requireCanActFor } from "@/lib/gate";
import {
  addBookCore,
  bookOwnerId,
  logBookCore,
  updateBookCore,
  finishBookCore,
  shelfBookCore,
  deleteBookCore,
} from "@/lib/books-core";

function refresh() {
  revalidatePath("/reading");
  revalidatePath("/");
}

/** Resolve a book's owner and authorize the caller to act for them. */
async function ownerOrThrow(bookId: string): Promise<string | null> {
  const userId = await bookOwnerId(bookId);
  if (!userId) return null;
  await requireCanActFor(userId);
  return userId;
}

export async function addBook(input: {
  userId: string;
  title: string;
  author?: string | null;
  pages?: number | null;
  chapters?: number | null;
}): Promise<{ error: string | null }> {
  await requireInteractive();
  if (!input.userId) return { error: "Whose book is this?" };
  await requireCanActFor(input.userId);
  const res = await addBookCore(input);
  if (!res.ok) return { error: res.error };
  refresh();
  return { error: null };
}

/** Set the page/chapter the reader is up to. */
export async function logBookReading(bookId: string, page: number): Promise<void> {
  await requireInteractive();
  if (!(await ownerOrThrow(bookId))) return;
  await logBookCore(bookId, page);
  refresh();
}

export async function editBook(
  bookId: string,
  patch: {
    title?: string;
    author?: string | null;
    pages?: number | null;
    chapters?: number | null;
    position?: number;
  },
): Promise<void> {
  await requireInteractive();
  if (!(await ownerOrThrow(bookId))) return;
  await updateBookCore(bookId, patch);
  refresh();
}

export async function finishBook(bookId: string, finished: boolean): Promise<void> {
  await requireInteractive();
  if (!(await ownerOrThrow(bookId))) return;
  await finishBookCore(bookId, finished);
  refresh();
}

export async function shelveBook(bookId: string, shelved: boolean): Promise<void> {
  await requireInteractive();
  if (!(await ownerOrThrow(bookId))) return;
  await shelfBookCore(bookId, shelved);
  refresh();
}

export async function deleteBook(bookId: string): Promise<void> {
  await requireInteractive();
  if (!(await ownerOrThrow(bookId))) return;
  await deleteBookCore(bookId);
  refresh();
}
