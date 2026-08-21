"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/user-session";
import { BOOK_BY_NAME } from "@/lib/bible/books";

// These act on the *signed-in* person's own record only — the userId comes from
// the session, never from the caller, so one person can't edit another's.

/** Replace a book's read chapters for the signed-in person with exactly this
 *  set (delete-and-rewrite, mirroring the household editor's save-on-commit). */
export async function saveMyBookChapters(
  bookName: string,
  chapters: number[],
): Promise<void> {
  const me = await requireUser();
  const book = BOOK_BY_NAME.get(bookName);
  if (!book) return;

  const valid = [...new Set(chapters)].filter(
    (c) => Number.isInteger(c) && c >= 1 && c <= book.chapters,
  );

  await prisma.userChapterRead.deleteMany({ where: { userId: me.id, bookName } });
  if (valid.length > 0) {
    await prisma.userChapterRead.createMany({
      data: valid.map((chapter) => ({ userId: me.id, bookName, chapter })),
      skipDuplicates: true,
    });
  }
  revalidatePath("/bible");
  revalidatePath("/");
}

/** Mark or clear several whole books at once (a testament in one go). */
export async function saveMyBooks(
  bookNames: string[],
  read: boolean,
): Promise<void> {
  const me = await requireUser();
  const names = bookNames.filter((b) => BOOK_BY_NAME.has(b));
  if (names.length === 0) return;

  if (read) {
    const rows = names.flatMap((bookName) => {
      const book = BOOK_BY_NAME.get(bookName)!;
      return Array.from({ length: book.chapters }, (_, i) => ({
        userId: me.id,
        bookName,
        chapter: i + 1,
      }));
    });
    await prisma.userChapterRead.createMany({ data: rows, skipDuplicates: true });
  } else {
    await prisma.userChapterRead.deleteMany({
      where: { userId: me.id, bookName: { in: names } },
    });
  }
  revalidatePath("/bible");
  revalidatePath("/");
}
