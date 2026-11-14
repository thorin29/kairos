import "server-only";
import { BOOKS, type Group } from "@/lib/bible/books";
import { familyEraSet, personalEraSet } from "@/lib/bible/era-core";

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

const GROUP_NAMES: Group[] = [
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

/** Coverage figures from a set of "Book|chapter" keys read, plus the hand-marked
 *  rows (a book counts as "already read" when all its chapters are marked). */
function statsFrom(
  todayISO: string,
  seen: Set<string>,
  manual: { bookName: string; chapter: number }[],
): ReadingStats {
  const byName = new Map(BOOKS.map((b) => [b.name, b]));
  const manualByBook = new Map<string, Set<number>>();
  for (const { bookName, chapter } of manual) {
    if (!byName.has(bookName)) continue;
    if (!manualByBook.has(bookName)) manualByBook.set(bookName, new Set());
    manualByBook.get(bookName)!.add(chapter);
  }

  const completedBooks = BOOKS.filter((b) => {
    const marked = manualByBook.get(b.name);
    return marked && marked.size >= b.chapters;
  }).map((b) => b.name);

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

  return {
    yearISO: todayISO.slice(0, 4),
    totalChapters: TOTAL,
    readChapters: seen.size,
    ot: { label: "Old Testament", ...countFor((n) => byName.get(n)!.testament === "OT") },
    nt: { label: "New Testament", ...countFor((n) => byName.get(n)!.testament === "NT") },
    groups: GROUP_NAMES.map((g) => ({
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

/**
 * Coverage from the scheduled plan up to today — what the household has been
 * *taken through*, which is what a schedule can honestly claim — plus the
 * chapters an admin marked by hand, both counted from the start of the current
 * reading era (v0.723). Extras (Christmas, Easter) are left out so a one-off
 * can't inflate the figure. Distinct chapters are counted, so a passage read
 * twice doesn't push the total past 100%.
 */
export async function loadReadingStats(
  todayISO: string,
): Promise<ReadingStats> {
  const { seen, manual } = await familyEraSet(todayISO);
  return statsFrom(todayISO, seen, manual);
}

/**
 * The same coverage figures, but for one person's own reading record
 * (UserChapterRead) in their current era, instead of the household plan +
 * shared marks.
 */
export async function loadPersonalReadingStats(
  userId: string,
  todayISO: string,
): Promise<ReadingStats> {
  const { seen, manual } = await personalEraSet(userId);
  return statsFrom(todayISO, seen, manual);
}

/** The "book|chapter" keys a person has personally read — for pre-filling the
 *  tracker editor. */
export async function loadPersonalReadKeys(userId: string): Promise<string[]> {
  const { manual } = await personalEraSet(userId);
  return manual.map((r) => `${r.bookName}|${r.chapter}`);
}
