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

export type GoalInput = { id?: string | null; target: unknown; dueDate: unknown };

/** Parse a request body's `goals` into GoalInput[]. Returns undefined when the
 *  field is absent/not an array (leave goals unchanged); an empty array clears
 *  them. Values are validated downstream in syncBookGoals. */
export function parseGoalsInput(raw: unknown): GoalInput[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  return raw.map((g) => {
    const o = (g ?? {}) as Record<string, unknown>;
    return {
      id: typeof o.id === "string" ? o.id : null,
      target: o.target,
      dueDate: o.dueDate,
    };
  });
}

/** Bring a book's goals in line with the given list: goals carrying an id are
 *  updated in place (so their completion survives an edit), new ones are created,
 *  and existing goals absent from the list are removed. Completion is recomputed
 *  separately, against the reader's position. */
async function syncBookGoals(bookId: string, goals: GoalInput[]): Promise<void> {
  const existing = await prisma.readingGoal.findMany({
    where: { bookId },
    select: { id: true },
  });
  const existingIds = new Set(existing.map((e) => e.id));
  const keep = new Set<string>();

  for (const g of goals) {
    const target = readCount(g.target);
    const dueMs = Date.parse(String(g.dueDate));
    if (target === null || !Number.isFinite(dueMs)) continue;
    const dueDate = new Date(dueMs);
    if (g.id && existingIds.has(g.id)) {
      keep.add(g.id);
      await prisma.readingGoal.update({ where: { id: g.id }, data: { target, dueDate } });
    } else {
      await prisma.readingGoal.create({ data: { bookId, target, dueDate } });
    }
  }

  const remove = [...existingIds].filter((id) => !keep.has(id));
  if (remove.length) {
    await prisma.readingGoal.deleteMany({ where: { id: { in: remove } } });
  }
}

/** A goal is met once the reader's position reaches its target; paging back below
 *  it un-meets it — the current position is always the truth. */
async function recomputeGoalCompletion(bookId: string, position: number): Promise<void> {
  const goals = await prisma.readingGoal.findMany({
    where: { bookId },
    select: { id: true, target: true, completed: true },
  });
  for (const g of goals) {
    const met = position >= g.target;
    if (met && !g.completed) {
      await prisma.readingGoal.update({
        where: { id: g.id },
        data: { completed: true, completedAt: new Date() },
      });
    } else if (!met && g.completed) {
      await prisma.readingGoal.update({
        where: { id: g.id },
        data: { completed: false, completedAt: null },
      });
    }
  }
}

export type BookResult = { ok: true } | { ok: false; error: string };

export async function addBookCore(input: {
  userId: string;
  title: string;
  author?: string | null;
  pages?: unknown;
  chapters?: unknown;
  goals?: GoalInput[];
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

  const book = await prisma.book.create({
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
  if (input.goals && input.goals.length) {
    await syncBookGoals(book.id, input.goals);
    await recomputeGoalCompletion(book.id, 0);
  }
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
  const position = clampInt(page, 0, MAX);
  await prisma.book.update({ where: { id: bookId }, data: { position } });
  await recomputeGoalCompletion(bookId, position);
}

export async function updateBookCore(
  bookId: string,
  patch: {
    title?: string;
    author?: string | null;
    pages?: unknown;
    chapters?: unknown;
    position?: unknown;
    goals?: GoalInput[];
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

  if (Object.keys(data).length > 0) {
    await prisma.book.update({ where: { id: bookId }, data });
  }
  if (patch.goals !== undefined) {
    await syncBookGoals(bookId, patch.goals);
  }
  if (patch.goals !== undefined || patch.position !== undefined) {
    const b = await prisma.book.findUnique({
      where: { id: bookId },
      select: { position: true },
    });
    if (b) await recomputeGoalCompletion(bookId, b.position);
  }
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
