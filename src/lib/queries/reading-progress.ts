import "server-only";
import { prisma } from "@/lib/prisma";
import { fromDateColumn, toDateColumn } from "@/lib/dates";
import { parsePassage } from "@/lib/bible/books";
import { eraFloor } from "@/lib/bible/era-core";

export type ReadingProgress = {
  /** "Book|chapter" the published plan has scheduled up to today. Automatic. */
  planCovered: string[];
  /** "Book|chapter" an admin has ticked by hand. */
  manualCovered: string[];
};

/**
 * The two sources of coverage the check-off menu shows side by side: what the
 * plan has already taken the household through (filled in automatically as the
 * days pass, not editable) and what an admin has marked by hand. The reading
 * percentage is the union of the two; neither depends on whether any single
 * person ticked their daily box.
 */
export async function loadReadingProgress(
  todayISO: string,
): Promise<ReadingProgress> {
  // Both counted from the start of the current reading era (v0.723).
  const floor = await eraFloor(null);
  const [days, manual] = await Promise.all([
    prisma.readingDay.findMany({
      where: {
        plan: { isPublished: true, ownerId: null },
        isExtra: false,
        day: { lte: toDateColumn(todayISO), ...(floor.on ? { gte: toDateColumn(floor.on) } : {}) },
      },
      select: { passage: true, day: true },
    }),
    prisma.chapterCompletion.findMany({
      where: floor.at ? { completedAt: { gte: floor.at } } : {},
      select: { bookName: true, chapter: true },
    }),
  ]);

  const planCovered = new Set<string>();
  for (const d of days) {
    if (fromDateColumn(d.day) > todayISO) continue;
    for (const ref of parsePassage(d.passage)) {
      planCovered.add(`${ref.book}|${ref.chapter}`);
    }
  }

  return {
    planCovered: [...planCovered],
    manualCovered: manual.map((m) => `${m.bookName}|${m.chapter}`),
  };
}
