import "server-only";
import { BOOKS } from "@/lib/bible/books";
import { loadTrackerCore, manualKeys } from "@/lib/bible/tracker-core";
import type { Tracker } from "@/lib/bible/tracker";

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

/** The older coverage figures, now read from the tracker (v0.724): each level's
 *  progress toward its next time through. Kept for the app's summary cards. */
function statsFrom(todayISO: string, t: Tracker): ReadingStats {
  const g = (l: Tracker["bible"], label = l.label): GroupProgress => ({
    label,
    chapters: l.chapters,
    read: l.ahead,
    percent: l.progress,
  });
  return {
    yearISO: todayISO.slice(0, 4),
    totalChapters: TOTAL,
    readChapters: t.bible.ahead,
    ot: g(t.ot),
    nt: g(t.nt),
    groups: t.sections.map((s) => g(s, s.key)),
    booksTouched: t.books.filter((b) => b.ahead > 0).length,
    completedBooks: t.books.filter((b) => b.times > 0).map((b) => b.label),
    wholeBible: t.bible.times > 0,
  };
}

export async function loadReadingStats(todayISO: string): Promise<ReadingStats> {
  return statsFrom(todayISO, (await loadTrackerCore(null, todayISO)).tracker);
}

export async function loadPersonalReadingStats(userId: string, todayISO: string): Promise<ReadingStats> {
  return statsFrom(todayISO, (await loadTrackerCore(userId, todayISO)).tracker);
}

/** The chapters marked in this person's open manual run — for the checklist. */
export async function loadPersonalReadKeys(userId: string): Promise<string[]> {
  return manualKeys(userId);
}
