import "server-only";
import { prisma } from "@/lib/prisma";
import { fromDateColumn, todayISO } from "@/lib/dates";

export type BookProgress = {
  id: string;
  title: string;
  author: string | null;
  unit: "PAGES" | "CHAPTERS"; // the progress unit (derived; pages win)
  length: number;
  pages: number | null;
  chapters: number | null;
  read: number; // capped at length
  rawRead: number; // uncapped total
  todayAmount: number;
  finished: boolean;
  shelved: boolean;
  bookmarked: boolean;
};

export type PersonBooks = {
  id: string;
  name: string;
  color: string;
  avatarPath: string | null;
  avatarPosition: string | null;
  books: BookProgress[];
};

type BookRow = {
  id: string;
  userId: string;
  title: string;
  author: string | null;
  unit: "PAGES" | "CHAPTERS";
  length: number;
  pages: number | null;
  chapters: number | null;
  finishedAt: Date | null;
  shelved: boolean;
  bookmarked: boolean;
  logs: { day: Date; amount: number }[];
};

const bookSelect = {
  id: true,
  userId: true,
  title: true,
  author: true,
  unit: true,
  length: true,
  pages: true,
  chapters: true,
  finishedAt: true,
  shelved: true,
  bookmarked: true,
  logs: { select: { day: true, amount: true } },
} as const;

function toProgress(b: BookRow, today: string): BookProgress {
  const rawRead = b.logs.reduce((n, l) => n + l.amount, 0);
  const todayAmount =
    b.logs.find((l) => fromDateColumn(l.day) === today)?.amount ?? 0;
  return {
    id: b.id,
    title: b.title,
    author: b.author,
    unit: b.unit,
    length: b.length,
    pages: b.pages,
    chapters: b.chapters,
    read: Math.min(rawRead, b.length),
    rawRead,
    todayAmount,
    finished: b.finishedAt != null,
    shelved: b.shelved,
    bookmarked: b.bookmarked,
  };
}

/** The whole reading board: every active person with all their books (the board
 *  buckets into the reading queue and the shelf). The page then narrows to the
 *  signed-in person on a personal device. */
export async function loadReading(): Promise<PersonBooks[]> {
  const today = todayISO();
  const [people, books] = await Promise.all([
    prisma.user.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        name: true,
        displayName: true,
        color: true,
        avatarPath: true,
        avatarPosition: true,
      },
    }),
    prisma.book.findMany({
      orderBy: { createdAt: "desc" },
      select: bookSelect,
    }),
  ]);

  const byUser = new Map<string, BookProgress[]>();
  for (const p of people) byUser.set(p.id, []);
  for (const b of books as BookRow[]) {
    byUser.get(b.userId)?.push(toProgress(b, today));
  }

  return people.map((p) => ({
    id: p.id,
    name: p.displayName ?? p.name,
    color: p.color,
    avatarPath: p.avatarPath,
    avatarPosition: p.avatarPosition,
    books: byUser.get(p.id) ?? [],
  }));
}

/** One person's books for the device API (reading is self-only). */
export async function loadMyBooks(
  userId: string,
): Promise<{ today: string; books: BookProgress[] }> {
  const today = todayISO();
  const books = await prisma.book.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: bookSelect,
  });
  return { today, books: (books as BookRow[]).map((b) => toProgress(b, today)) };
}
