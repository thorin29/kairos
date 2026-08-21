// Leisure reading feeds the Scholar stat, but only slightly. Pages and chapters
// are normalized to a common "unit" so the two ways of tracking a book earn
// comparably, credit is capped at the book's length (no reward past finishing),
// and the factor is gentle — a whole 300-page book is worth a handful of chores,
// spread across the days it took to read. The more you read (and the longer the
// book), the more it adds, which is the whole ask.

export const PAGES_PER_UNIT = 10;
export const READING_XP_PER_UNIT = 2;

export function readingXpForBook(
  unit: "PAGES" | "CHAPTERS",
  length: number,
  totalRead: number,
): number {
  const cap = length > 0 ? length : totalRead;
  const counted = Math.max(0, Math.min(totalRead, cap));
  const units = unit === "PAGES" ? counted / PAGES_PER_UNIT : counted;
  return Math.round(units * READING_XP_PER_UNIT);
}

// Personal Bible reading feeds the Wisdom stat the same slight way leisure
// reading feeds Scholar — a couple of XP per chapter read, capped at the whole
// Bible so it can't run past finishing it.
export const BIBLE_XP_PER_CHAPTER = 2;
export const TOTAL_BIBLE_CHAPTERS = 1189;

export function bibleXpForChapters(chaptersRead: number): number {
  const c = Math.max(0, Math.min(chaptersRead, TOTAL_BIBLE_CHAPTERS));
  return Math.round(c * BIBLE_XP_PER_CHAPTER);
}
