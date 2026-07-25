import "server-only";
import { prisma } from "@/lib/prisma";
import { fromDateColumn, toDateColumn } from "@/lib/dates";
import { BOOKS, parsePassage, type Group } from "@/lib/bible/books";

export type GroupProgress = {
  label: string;
  chapters: number;
  read: number;
  percent: number;
};

export type ReadingStats = {
  yearISO: string;
  totalChapters: number;
  readChapters: number;
  ot: GroupProgress;
  nt: GroupProgress;
  groups: GroupProgress[];
  booksTouched: number;
  /** Whole books an admin has marked as already read. */
  completedBooks: string[];
  /** Every one of the 66 books covered — worth a badge. */
  wholeBible: boolean;
};

const TOTAL = BOOKS.reduce((n, b) => n + b.chapters, 0);

/**
 * Coverage from the scheduled plan up to today — what the household has been
 * *taken through*, which is what a schedule can honestly claim. Whether a
 * given person ticked their box is a separate number, on their own card.
 *
 * Distinct chapters are counted, so a passage read twice in a year doesn't
 * inflate the total past 100%.
 */
export async function loadReadingStats(
  todayISO: string,
): Promise<ReadingStats> {
  const year = todayISO.slice(0, 4);

  // Everything the published plan has taken the household through so far —
  // the whole run of it up to today, not just this calendar year — plus any
  // books an admin marked as already read. Extras (Christmas, Easter) are
  // left out so a one-off can't inflate the figure.
  const [days, completions] = await Promise.all([
    prisma.readingDay.findMany({
      where: {
        plan: { isPublished: true },
        isExtra: false,
        day: { lte: toDateColumn(todayISO) },
      },
      select: { passage: true, day: true },
    }),
    prisma.bookCompletion.findMany({ select: { bookName: true } }),
  ]);

  const byName = new Map(BOOKS.map((b) => [b.name, b]));
  const seen = new Set<string>();

  for (const d of days) {
    if (fromDateColumn(d.day) > todayISO) continue;
    for (const ref of parsePassage(d.passage)) {
      seen.add(`${ref.book}|${ref.chapter}`);
    }
  }

  // A completed book counts every chapter as read.
  const completedBooks: string[] = [];
  for (const { bookName } of completions) {
    const book = byName.get(bookName);
    if (!book) continue;
    completedBooks.push(bookName);
    for (let c = 1; c <= book.chapters; c++) seen.add(`${bookName}|${c}`);
  }

  const countFor = (predicate: (bookName: string) => boolean) => {
    const books = BOOKS.filter((b) => predicate(b.name));
    const chapters = books.reduce((n, b) => n + b.chapters, 0);
    let read = 0;
    for (const b of books) {
      for (let c = 1; c <= b.chapters; c++) {
        if (seen.has(`${b.name}|${c}`)) read += 1;
      }
    }
    return {
      chapters,
      read,
      percent: chapters ? Math.round((read / chapters) * 100) : 0,
    };
  };

  const groupNames: Group[] = [
    "Pentateuch",
    "History",
    "Wisdom",
    "Major Prophets",
    "Minor Prophets",
    "Gospels",
    "Acts",
    "Paul",
    "General Epistles",
    "Revelation",
  ];

  return {
    yearISO: year,
    totalChapters: TOTAL,
    readChapters: seen.size,
    ot: { label: "Old Testament", ...countFor((n) => byName.get(n)!.testament === "OT") },
    nt: { label: "New Testament", ...countFor((n) => byName.get(n)!.testament === "NT") },
    groups: groupNames.map((g) => ({
      label: g,
      ...countFor((n) => byName.get(n)!.group === g),
    })),
    booksTouched: new Set([...seen].map((k) => k.split("|")[0])).size,
    completedBooks,
    wholeBible: BOOKS.every((b) => {
      for (let c = 1; c <= b.chapters; c++) {
        if (!seen.has(`${b.name}|${c}`)) return false;
      }
      return true;
    }),
  };
}
