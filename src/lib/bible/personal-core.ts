import "server-only";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { toDateColumn } from "@/lib/dates";
import { buildPlan, type Selection } from "@/lib/bible/plan-builder";
import { parsePassage, BOOK_BY_NAME } from "@/lib/bible/books";

/**
 * The guard-free core of personal Bible reading, shared by the web server
 * actions (src/lib/actions/personal-plan.ts, personal-bible.ts) and the mobile
 * API (/api/v1/reading/*), so the plan/mark rules live in exactly one place.
 * Callers add their own authorization: the web actions check the session gate
 * (requireInteractive + requireCanActFor); the API checks the device token's
 * person. Both re-validate the shared views here so a phone action still
 * refreshes the wall tablet.
 */

const MAX_DAYS = 1500;

/** Generate a personal reading plan for `userId` from a set of books, a start
 *  date and a chapters-per-day pace. Replaces any existing personal plan (the
 *  chapters already read are kept — they live in the person's own record, not on
 *  the plan). */
export async function generatePersonalPlanCore(
  userId: string,
  input: {
    name: string;
    bookNames: string[];
    startISO: string;
    chaptersPerDay: number;
  },
): Promise<{ error: string | null }> {
  if (!userId) return { error: "Whose plan is this?" };
  const name = input.name.trim().slice(0, 80) || "My reading plan";
  const books = [...new Set(input.bookNames)].filter(Boolean);
  if (books.length === 0) return { error: "Pick at least one book." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.startISO))
    return { error: "Pick a start date." };
  const cpd = Math.max(1, Math.min(50, Math.round(input.chaptersPerDay) || 1));

  const segments: Selection[] = books.map((book) => ({ book }));
  const perWeekday: Record<number, number> = {
    0: cpd,
    1: cpd,
    2: cpd,
    3: cpd,
    4: cpd,
    5: cpd,
    6: cpd,
  };
  const built = buildPlan({
    segments,
    startISO: input.startISO,
    pace: { kind: "weekly", perWeekday },
    keepBooksWhole: false,
  });
  if (built.error) return { error: built.error };
  if (built.days.length === 0 || built.days.length > MAX_DAYS)
    return { error: "That plan is empty or far too long." };

  await prisma.readingPlan.deleteMany({ where: { ownerId: userId } });
  await prisma.readingPlan.create({
    data: {
      name,
      ownerId: userId,
      isPublished: true,
      notes: `${built.totalChapters} chapters over ${built.days.length} days`,
      startDate: toDateColumn(built.days[0].iso),
      endDate: toDateColumn(built.days[built.days.length - 1].iso),
      days: {
        create: built.days.map((d) => ({
          day: toDateColumn(d.iso),
          passage: d.passage.slice(0, 120),
          isExtra: d.isExtra,
        })),
      },
    },
  });

  revalidatePath("/bible");
  revalidatePath(`/person/${userId}`);
  return { error: null };
}

export async function deletePersonalPlanCore(userId: string): Promise<void> {
  if (!userId) return;
  await prisma.readingPlan.deleteMany({ where: { ownerId: userId } });
  revalidatePath("/bible");
  revalidatePath(`/person/${userId}`);
}

/** Tick (or untick) a day's reading: mark exactly that passage's chapters in the
 *  person's own record, which feeds their coverage stats and Wisdom. */
export async function markPersonalReadingCore(
  userId: string,
  passage: string,
  read: boolean,
): Promise<void> {
  if (!userId) return;
  const refs = parsePassage(passage);
  if (refs.length === 0) return;

  if (read) {
    await prisma.userChapterRead.createMany({
      data: refs.map((r) => ({ userId, bookName: r.book, chapter: r.chapter })),
      skipDuplicates: true,
    });
  } else {
    await prisma.userChapterRead.deleteMany({
      where: {
        userId,
        OR: refs.map((r) => ({ bookName: r.book, chapter: r.chapter })),
      },
    });
  }
  revalidatePath("/bible");
  revalidatePath(`/person/${userId}`);
  revalidatePath("/");
}

/** Replace a book's read chapters for `userId` with exactly this set. */
export async function saveMyBookChaptersCore(
  userId: string,
  bookName: string,
  chapters: number[],
): Promise<void> {
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
export async function saveMyBooksCore(
  userId: string,
  bookNames: string[],
  read: boolean,
): Promise<void> {
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
