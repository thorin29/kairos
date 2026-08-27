"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireInteractive, requireCanActFor } from "@/lib/gate";
import { BOOK_BY_NAME } from "@/lib/bible/books";

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
  if (!userId) return;
  const book = BOOK_BY_NAME.get(bookName);
  if (!book) return;

  const valid = [...new Set(chapters)].filter(
    (c) => Number.isInteger(c) && c >= 1 && c <= book.chapters,
  );

  await prisma.userChapterRead.deleteMany({ where: { userId, bookName } });
  if (valid.length > 0) {
    await prisma.userChapterRead.createMany({
      data: valid.map((chapter) => ({ userId, bookName, chapter })),
      skipDuplicates: true,
    });
  }
  revalidatePath("/bible");
  revalidatePath(`/person/${userId}`);
  revalidatePath("/");
}

/** Mark or clear several whole books at once for `userId`. */
export async function saveMyBooks(
  userId: string,
  bookNames: string[],
  read: boolean,
): Promise<void> {
  await requireInteractive();
  await requireCanActFor(userId);
  if (!userId) return;
  const names = bookNames.filter((b) => BOOK_BY_NAME.has(b));
  if (names.length === 0) return;

  if (read) {
    const rows = names.flatMap((bookName) => {
      const book = BOOK_BY_NAME.get(bookName)!;
      return Array.from({ length: book.chapters }, (_, i) => ({
        userId,
        bookName,
        chapter: i + 1,
      }));
    });
    await prisma.userChapterRead.createMany({ data: rows, skipDuplicates: true });
  } else {
    await prisma.userChapterRead.deleteMany({
      where: { userId, bookName: { in: names } },
    });
  }
  revalidatePath("/bible");
  revalidatePath(`/person/${userId}`);
  revalidatePath("/");
}
