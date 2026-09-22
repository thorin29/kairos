import "server-only";
import { prisma } from "@/lib/prisma";
import { getReadingReminderLeadDays } from "@/lib/settings";

export type ReadingGoalView = {
  id: string;
  target: number; // the position (page/chapter) to reach
  dueDate: string; // ISO date to reach it by
  completed: boolean;
};

export type BookProgress = {
  id: string;
  title: string;
  author: string | null;
  unit: "PAGES" | "CHAPTERS"; // the progress unit (derived; pages win)
  length: number;
  pages: number | null;
  chapters: number | null;
  position: number; // the page/chapter the reader is up to
  read: number; // min(position, length)
  finished: boolean;
  shelved: boolean;
  goals: ReadingGoalView[];
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
  position: number;
  finishedAt: Date | null;
  shelved: boolean;
  goals: { id: string; target: number; dueDate: Date; completed: boolean }[];
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
  position: true,
  finishedAt: true,
  shelved: true,
  goals: {
    select: { id: true, target: true, dueDate: true, completed: true },
    orderBy: { dueDate: "asc" },
  },
} as const;

function toProgress(b: BookRow): BookProgress {
  return {
    id: b.id,
    title: b.title,
    author: b.author,
    unit: b.unit,
    length: b.length,
    pages: b.pages,
    chapters: b.chapters,
    position: b.position,
    read: Math.min(b.position, b.length),
    finished: b.finishedAt != null,
    shelved: b.shelved,
    goals: b.goals.map((g) => ({
      id: g.id,
      target: g.target,
      dueDate: g.dueDate.toISOString(),
      completed: g.completed,
    })),
  };
}

/** The whole reading board: every active person with all their books (the board
 *  buckets into the reading queue and the shelf). The page then narrows to the
 *  signed-in person on a personal device. */
export async function loadReading(): Promise<PersonBooks[]> {
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
    byUser.get(b.userId)?.push(toProgress(b));
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
): Promise<{ books: BookProgress[] }> {
  const books = await prisma.book.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: bookSelect,
  });
  return { books: (books as BookRow[]).map(toProgress) };
}

export type ReadingGoalItem = {
  bookId: string;
  bookTitle: string;
  unit: "PAGES" | "CHAPTERS";
  length: number;
  position: number;
  goalId: string;
  target: number;
  dueDate: string; // ISO
  /** True when it's surfaced early by the reminder lead rather than being the
   *  current (earliest unfinished) goal for its book. */
  upcoming: boolean;
};

/** The reading action items for the reading button: the current goal for each
 *  book (its earliest unfinished one), plus any later unfinished goal already
 *  within the reminder lead of its due date — a heads-up that more is coming.
 *  Empty when the person has no live goals, so the button can hide itself. */
export async function loadReadingGoalItems(userId: string): Promise<ReadingGoalItem[]> {
  const leadDays = await getReadingReminderLeadDays();
  const books = await prisma.book.findMany({
    where: {
      userId,
      finishedAt: null,
      shelved: false,
      goals: { some: { completed: false } },
    },
    select: {
      id: true,
      title: true,
      unit: true,
      length: true,
      position: true,
      goals: {
        where: { completed: false },
        select: { id: true, target: true, dueDate: true },
        orderBy: { dueDate: "asc" },
      },
    },
  });

  const now = Date.now();
  const leadMs = leadDays * 24 * 60 * 60 * 1000;
  const items: ReadingGoalItem[] = [];
  for (const b of books) {
    b.goals.forEach((g, i) => {
      const isCurrent = i === 0;
      const withinLead = leadDays > 0 && g.dueDate.getTime() - now <= leadMs;
      if (isCurrent || withinLead) {
        items.push({
          bookId: b.id,
          bookTitle: b.title,
          unit: b.unit,
          length: b.length,
          position: b.position,
          goalId: g.id,
          target: g.target,
          dueDate: g.dueDate.toISOString(),
          upcoming: !isCurrent,
        });
      }
    });
  }
  items.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  return items;
}
