import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * Leisure book-tracker operations shared by the web server actions (behind an
 * Authelia session) and the device API routes (behind a bearer token). Auth
 * lives with the caller — the web action runs `requireCanActFor`, the device
 * route checks the book is the enrolled person's own (reading is self-only).
 *
 * A book records its size in pages and/or chapters (at least one). Progress runs
 * on the single `unit`/`length` pair the scoring/progress code uses, derived here
 * with pages winning when both are set. `position` is the page/chapter the reader
 * is up to; how far they've read — and the Scholar XP — derives from it at read
 * time (capped at length), so setting the page back and forth never banks extra
 * credit: each page counts once, and the current position is all that matters.
 */

const MAX = 100000;

function clampInt(n: unknown, lo: number, hi: number): number {
  const v = Math.round(Number(n) || 0);
  return Math.max(lo, Math.min(hi, v));
}

/** pages/chapters -> the progress unit + length. Pages win when both are set. */
function derive(
  pages: number | null,
  chapters: number | null,
): { unit: "PAGES" | "CHAPTERS"; length: number } | null {
  if (pages && pages > 0) return { unit: "PAGES", length: pages };
  if (chapters && chapters > 0) return { unit: "CHAPTERS", length: chapters };
  return null;
}

function readCount(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Math.round(Number(v));
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.min(MAX, n);
}

export type BookResult = { ok: true } | { ok: false; error: string };

export async function addBookCore(input: {
  userId: string;
  title: string;
  author?: string | null;
  pages?: unknown;
  chapters?: unknown;
}): Promise<BookResult> {
  const userId = (input.userId ?? "").trim();
  if (!userId) return { ok: false, error: "Whose book is this?" };
  const title = (input.title ?? "").trim().slice(0, 120);
  if (title.length < 1) return { ok: false, error: "Give the book a title." };

  const pages = readCount(input.pages);
  const chapters = readCount(input.chapters);
  const primary = derive(pages, chapters);
  if (!primary) return { ok: false, error: "Enter a page or chapter count." };

  const author = (input.author ?? "").trim().slice(0, 120) || null;

  await prisma.book.create({
    data: {
      userId,
      title,
      author,
      unit: primary.unit,
      length: primary.length,
      pages,
      chapters,
      position: 0,
    },
  });
  return { ok: true };
}

/** Owner id for a book, or null - the route uses it to enforce self-only. */
export async function bookOwnerId(bookId: string): Promise<string | null> {
  if (!bookId) return null;
  const b = await prisma.book.findUnique({
    where: { id: bookId },
    select: { userId: true },
  });
  return b?.userId ?? null;
}

/** Set the page/chapter the reader is up to. This is the current position, not a
 *  per-day amount - scoring derives from it at read time, so re-entering it never
 *  double-counts. */
export async function logBookCore(bookId: string, page: number): Promise<void> {
  if (!bookId) return;
  await prisma.book.update({
    where: { id: bookId },
    data: { position: clampInt(page, 0, MAX) },
  });
}

export async function updateBookCore(
  bookId: string,
  patch: {
    title?: string;
    author?: string | null;
    pages?: unknown;
    chapters?: unknown;
    position?: unknown;
  },
): Promise<BookResult> {
  if (!bookId) return { ok: false, error: "Missing book." };
  const data: {
    title?: string;
    author?: string | null;
    unit?: "PAGES" | "CHAPTERS";
    length?: number;
    pages?: number | null;
    chapters?: number | null;
    position?: number;
  } = {};

  if (patch.title !== undefined) {
    const t = patch.title.trim().slice(0, 120);
    if (t.length < 1) return { ok: false, error: "Give the book a title." };
    data.title = t;
  }
  if (patch.author !== undefined) {
    data.author = (patch.author ?? "").trim().slice(0, 120) || null;
  }
  if (patch.position !== undefined) {
    data.position = clampInt(patch.position, 0, MAX);
  }

  // If either count is provided, re-derive size + progress unit from the pair.
  if (patch.pages !== undefined || patch.chapters !== undefined) {
    const current = await prisma.book.findUnique({
      where: { id: bookId },
      select: { pages: true, chapters: true },
    });
    const pages =
      patch.pages !== undefined ? readCount(patch.pages) : current?.pages ?? null;
    const chapters =
      patch.chapters !== undefined
        ? readCount(patch.chapters)
        : current?.chapters ?? null;
    const primary = derive(pages, chapters);
    if (!primary) return { ok: false, error: "Enter a page or chapter count." };
    data.pages = pages;
    data.chapters = chapters;
    data.unit = primary.unit;
    data.length = primary.length;
  }

  if (Object.keys(data).length === 0) return { ok: true };
  await prisma.book.update({ where: { id: bookId }, data });
  return { ok: true };
}

/** Finishing completes the reading - the position jumps to the full length (100%
 *  for scoring) - and takes the book off the shelf into the Read pile. Reopening
 *  drops it back in the queue at its current position. */
export async function finishBookCore(bookId: string, finished: boolean): Promise<void> {
  if (!bookId) return;
  if (finished) {
    const b = await prisma.book.findUnique({
      where: { id: bookId },
      select: { length: true },
    });
    await prisma.book.update({
      where: { id: bookId },
      data: { finishedAt: new Date(), shelved: false, position: b?.length ?? undefined },
    });
  } else {
    await prisma.book.update({
      where: { id: bookId },
      data: { finishedAt: null, shelved: false },
    });
  }
}

/** Shelve = "save for later" (To read). Progress is untouched, so moving a book
 *  back to the queue resumes from the same page. */
export async function shelfBookCore(bookId: string, shelved: boolean): Promise<void> {
  if (!bookId) return;
  await prisma.book.update({ where: { id: bookId }, data: { shelved } });
}

export async function deleteBookCore(bookId: string): Promise<void> {
  if (!bookId) return;
  await prisma.book.delete({ where: { id: bookId } }).catch(() => {});
}
