import "server-only";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { fromDateColumn, toDateColumn } from "@/lib/dates";
import { BOOK_BY_NAME, parsePassage, type ChapterRef } from "@/lib/bible/books";
import {
  buildTracker,
  planKind,
  PLAN_KIND_LABEL,
  type Level,
  type LevelKind,
  type ReadEvent,
  type Tracker,
} from "@/lib/bible/tracker";

/**
 * The Bible tracker's server side: the read ledger (BibleRead), manual runs,
 * finished plans, and the payload the web page and the app draw from. Shared
 * by the web actions and the mobile API; callers check who may act.
 */

export const FAMILY = "family";
export const scopeOf = (ownerId: string | null) => ownerId ?? FAMILY;

function refsOf(passage: string | null | undefined): ChapterRef[] {
  return passage ? parsePassage(passage) : [];
}

function revalidate(ownerId: string | null) {
  revalidatePath("/bible");
  revalidatePath("/admin/bible");
  revalidatePath("/admin/bible/progress");
  revalidatePath("/");
  if (ownerId) revalidatePath(`/person/${ownerId}`);
}

// ---------------------------------------------------------------
// Manual checklist: marks belong to the open run
// ---------------------------------------------------------------

async function openRun(scope: string, ownerId: string | null, create: boolean) {
  const open = await prisma.manualReadingRun.findFirst({
    where: { scope, endedAt: null },
    orderBy: { createdAt: "desc" },
    select: { id: true, startedAt: true },
  });
  if (open || !create) return open;
  return prisma.manualReadingRun.create({
    data: { scope, ownerId, startedAt: new Date() },
    select: { id: true, startedAt: true },
  });
}

/** "Book|chapter" keys marked in the open manual run — what the checklist shows. */
export async function manualKeys(ownerId: string | null): Promise<string[]> {
  const run = await openRun(scopeOf(ownerId), ownerId, false);
  if (!run) return [];
  const rows = await prisma.bibleRead.findMany({
    where: { runId: run.id },
    select: { bookName: true, chapter: true },
  });
  return rows.map((r) => `${r.bookName}|${r.chapter}`);
}

/** Make the open run's marks for `bookName` exactly `chapters`. */
export async function setManualChapters(ownerId: string | null, bookName: string, chapters: number[]): Promise<void> {
  const book = BOOK_BY_NAME.get(bookName);
  if (!book) return;
  const want = new Set(chapters.filter((c) => Number.isInteger(c) && c >= 1 && c <= book.chapters));
  const scope = scopeOf(ownerId);
  const run = await openRun(scope, ownerId, want.size > 0);
  if (!run) return;
  const have = await prisma.bibleRead.findMany({
    where: { runId: run.id, bookName },
    select: { id: true, chapter: true },
  });
  const haveSet = new Set(have.map((h) => h.chapter));
  const drop = have.filter((h) => !want.has(h.chapter)).map((h) => h.id);
  if (drop.length) await prisma.bibleRead.deleteMany({ where: { id: { in: drop } } });
  const add = [...want].filter((c) => !haveSet.has(c));
  if (add.length) {
    const now = new Date();
    await prisma.bibleRead.createMany({
      data: add.map((chapter) => ({ scope, ownerId, bookName, chapter, readAt: now, source: "manual", runId: run.id })),
    });
  }
  revalidate(ownerId);
}

export async function setManualChapter(ownerId: string | null, bookName: string, chapter: number, read: boolean) {
  const keys = new Set(await manualKeys(ownerId));
  const book = BOOK_BY_NAME.get(bookName);
  if (!book) return;
  const current = Array.from({ length: book.chapters }, (_, i) => i + 1).filter((c) => keys.has(`${bookName}|${c}`));
  const next = read ? [...current, chapter] : current.filter((c) => c !== chapter);
  await setManualChapters(ownerId, bookName, next);
}

/** Mark or clear whole books in the open run. */
export async function setManualBooks(ownerId: string | null, bookNames: string[], read: boolean): Promise<void> {
  for (const name of bookNames) {
    const book = BOOK_BY_NAME.get(name);
    if (!book) continue;
    await setManualChapters(ownerId, name, read ? Array.from({ length: book.chapters }, (_, i) => i + 1) : []);
  }
}

/** End the open manual run. What's marked stays counted; the checklist clears,
 *  and the next mark starts a new run (and its timing). */
export async function resetManual(ownerId: string | null): Promise<void> {
  const run = await openRun(scopeOf(ownerId), ownerId, false);
  if (!run) return;
  const chapters = await prisma.bibleRead.count({ where: { runId: run.id } });
  await prisma.manualReadingRun.update({ where: { id: run.id }, data: { endedAt: new Date(), chapters } });
  revalidate(ownerId);
}

// ---------------------------------------------------------------
// Plan days
// ---------------------------------------------------------------

function planRows(scope: string, ownerId: string | null, key: string, at: Date, d: { passage: string; extra: string | null; isExtra: boolean }) {
  const rows = [
    ...refsOf(d.passage).map((r) => ({ r, source: d.isExtra ? "extra" : "plan" })),
    ...refsOf(d.extra).map((r) => ({ r, source: "extra" })),
  ];
  return rows.map(({ r, source }) => ({
    scope,
    ownerId,
    bookName: r.book,
    chapter: r.chapter,
    readAt: at,
    source,
    sourceKey: key,
  }));
}

/** Tick or untick a day of a person's own plan: its plan reading and any extra. */
export async function markPlanDay(userId: string, planId: string, dayISO: string, read: boolean): Promise<void> {
  const key = `${planId}|${dayISO}`;
  if (read) {
    const d = await prisma.readingDay.findFirst({
      where: { planId, day: toDateColumn(dayISO) },
      select: { passage: true, extra: true, isExtra: true },
    });
    if (!d) return;
    await prisma.bibleRead.createMany({ data: planRows(userId, userId, key, new Date(), d), skipDuplicates: true });
  } else {
    await prisma.bibleRead.deleteMany({ where: { scope: userId, sourceKey: key } });
  }
  revalidate(userId);
}

/** The family's plan days become reads as they pass (later-starting plan wins a
 *  shared day). Only the last month is re-checked once anything is recorded. */
export async function syncFamilyPlanReads(todayISO: string): Promise<void> {
  const last = await prisma.bibleRead.findFirst({
    where: { scope: FAMILY, source: { in: ["plan", "extra"] } },
    orderBy: { readAt: "desc" },
    select: { readAt: true },
  });
  const fromISO = last ? new Date(last.readAt.getTime() - 30 * 86_400_000).toISOString().slice(0, 10) : null;
  const days = await prisma.readingDay.findMany({
    where: {
      plan: { isPublished: true, ownerId: null },
      day: { lte: toDateColumn(todayISO), ...(fromISO ? { gte: toDateColumn(fromISO) } : {}) },
    },
    orderBy: [{ plan: { startDate: "asc" } }, { day: "asc" }],
    select: { planId: true, day: true, passage: true, extra: true, isExtra: true },
  });
  const byDay = new Map<string, (typeof days)[number]>();
  for (const d of days) byDay.set(fromDateColumn(d.day), d);
  const rows = [...byDay.entries()].flatMap(([iso, d]) =>
    planRows(FAMILY, null, `${d.planId}|${iso}`, new Date(`${iso}T12:00:00.000Z`), d),
  );
  for (let i = 0; i < rows.length; i += 2000) {
    await prisma.bibleRead.createMany({ data: rows.slice(i, i + 2000), skipDuplicates: true });
  }
}

/** Once: the family's hand-marked chapters count once, untimed, in an open
 *  manual run — skipping chapters the published plan already took them through. */
async function seedFamilyOnce(todayISO: string): Promise<void> {
  const seeded = await prisma.manualReadingRun.findUnique({ where: { id: "seed_family" }, select: { id: true } });
  if (seeded) return;
  const [marks, planned] = await Promise.all([
    prisma.chapterCompletion.findMany({ select: { bookName: true, chapter: true, completedAt: true } }),
    prisma.bibleRead.findMany({ where: { scope: FAMILY, source: "plan" }, select: { bookName: true, chapter: true } }),
  ]);
  const covered = new Set(planned.map((p) => `${p.bookName}|${p.chapter}`));
  const rows = marks.filter((m) => BOOK_BY_NAME.has(m.bookName) && !covered.has(`${m.bookName}|${m.chapter}`));
  const open = await openRun(FAMILY, null, false);
  await prisma.manualReadingRun.create({
    data: {
      id: "seed_family",
      scope: FAMILY,
      startedAt: null,
      // Nothing to carry over, or a run is already open: keep the marker closed.
      ...(rows.length === 0 || open ? { endedAt: new Date(), chapters: rows.length } : {}),
    },
  });
  if (rows.length) {
    await prisma.bibleRead.createMany({
      data: rows.map((m) => ({
        scope: FAMILY,
        bookName: m.bookName,
        chapter: m.chapter,
        readAt: m.completedAt,
        source: "manual",
        runId: "seed_family",
        timed: false,
      })),
    });
  }
  void todayISO;
}

/** Record plans that have just finished. A family plan finishes when its last
 *  day passes; a person's when every one of its days is ticked. Extras don't
 *  count either way. */
async function recordPlanCompletions(ownerId: string | null, todayISO: string): Promise<void> {
  const scope = scopeOf(ownerId);
  const done = await prisma.readingPlanDone.findMany({ where: { scope }, select: { planId: true } });
  const plans = await prisma.readingPlan.findMany({
    where: {
      ownerId,
      ...(ownerId ? {} : { isPublished: true }),
      id: { notIn: done.map((d) => d.planId) },
    },
    select: {
      id: true,
      name: true,
      days: { where: { isExtra: false }, orderBy: { day: "asc" }, select: { day: true, passage: true } },
    },
  });
  for (const p of plans) {
    if (p.days.length === 0) continue;
    const first = fromDateColumn(p.days[0].day);
    const last = fromDateColumn(p.days[p.days.length - 1].day);
    let completedAt: Date | null = null;
    if (!ownerId) {
      if (last <= todayISO) completedAt = new Date(`${last}T12:00:00.000Z`);
    } else {
      const keys = p.days.map((d) => `${p.id}|${fromDateColumn(d.day)}`);
      const reads = await prisma.bibleRead.findMany({
        where: { scope, source: "plan", sourceKey: { in: keys } },
        select: { sourceKey: true, readAt: true },
      });
      const ticked = new Set(reads.map((r) => r.sourceKey));
      if (keys.every((k) => ticked.has(k))) {
        completedAt = new Date(Math.max(...reads.map((r) => r.readAt.getTime())));
      }
    }
    if (!completedAt) continue;
    const chapterKeys = new Set(p.days.flatMap((d) => refsOf(d.passage).map((r) => `${r.book}|${r.chapter}`)));
    await prisma.readingPlanDone.upsert({
      where: { planId: p.id },
      update: {},
      create: {
        scope,
        ownerId,
        planId: p.id,
        name: p.name,
        kind: planKind(chapterKeys),
        startOn: toDateColumn(first),
        endOn: toDateColumn(last),
        days: p.days.length,
        completedAt,
      },
    });
  }
}

/** Call before a plan is deleted or replaced, so a finished one is kept. */
export async function keepFinishedPlans(ownerId: string | null, todayISO: string): Promise<void> {
  await recordPlanCompletions(ownerId, todayISO);
}

// ---------------------------------------------------------------
// The payload
// ---------------------------------------------------------------

export type LevelView = Omit<Level, "completions">;

export type Milestone = {
  /** null: finished before tracking began. */
  atISO: string | null;
  kind: LevelKind | "plan" | "manual" | "reset";
  label: string;
  detail: string;
  days: number | null;
};

export type TrackerPayload = {
  bible: LevelView;
  ot: LevelView;
  nt: LevelView;
  sections: LevelView[];
  books: LevelView[];
  milestones: Milestone[];
  bests: { label: string; days: number }[];
  plansCompleted: number;
  manual: { open: boolean; startedISO: string | null; untimed: boolean; chapters: number };
};

async function readEvents(scope: string): Promise<ReadEvent[]> {
  const rows = await prisma.bibleRead.findMany({
    where: { scope },
    select: { bookName: true, chapter: true, readAt: true, timed: true },
  });
  return rows.map((r) => ({ key: `${r.bookName}|${r.chapter}`, at: r.readAt.getTime(), timed: r.timed }));
}

async function startedOverAt(scope: string): Promise<number | null> {
  const r = await prisma.trackerReset.findFirst({ where: { scope }, orderBy: { at: "desc" }, select: { at: true } });
  return r ? r.at.getTime() : null;
}

/** The tracker counts and the raw events, for callers that need both. */
export async function loadTrackerCore(
  ownerId: string | null,
  todayISO: string,
): Promise<{ tracker: Tracker; events: ReadEvent[]; startedOver: number | null }> {
  if (!ownerId) {
    await syncFamilyPlanReads(todayISO);
    await seedFamilyOnce(todayISO);
  }
  const scope = scopeOf(ownerId);
  const [events, startedOver] = await Promise.all([readEvents(scope), startedOverAt(scope)]);
  return { tracker: buildTracker(events, startedOver), events, startedOver };
}

/** "Start over": every bar back to 0%. Times read and milestones are kept. */
export async function startOver(ownerId: string | null): Promise<void> {
  await prisma.trackerReset.create({ data: { scope: scopeOf(ownerId) } });
  revalidate(ownerId);
}

const view = ({ completions: _c, ...rest }: Level): LevelView => rest;

export async function loadTracker(ownerId: string | null, todayISO: string): Promise<TrackerPayload> {
  const scope = scopeOf(ownerId);
  const { tracker: t } = await loadTrackerCore(ownerId, todayISO);
  await recordPlanCompletions(ownerId, todayISO);

  const [plansDone, runs, open, resets] = await Promise.all([
    prisma.readingPlanDone.findMany({ where: { scope }, orderBy: { completedAt: "desc" } }),
    prisma.manualReadingRun.findMany({ where: { scope, endedAt: { not: null }, chapters: { gt: 0 } } }),
    openRun(scope, ownerId, false),
    prisma.trackerReset.findMany({ where: { scope }, select: { at: true } }),
  ]);
  const openCount = open ? await prisma.bibleRead.count({ where: { runId: open.id } }) : 0;

  const milestones: Milestone[] = [];
  for (const l of [t.bible, t.ot, t.nt, ...t.sections, ...t.books]) {
    for (const c of l.completions) {
      milestones.push({
        atISO: c.beforeTracking ? null : c.atISO,
        kind: l.kind,
        label: l.kind === "book" ? `Finished ${l.label}` : l.label,
        detail: `×${c.n}`,
        days: c.days,
      });
    }
  }
  for (const p of plansDone) {
    milestones.push({
      atISO: p.completedAt.toISOString().slice(0, 10),
      kind: "plan",
      label: `Plan completed: ${p.name}`,
      detail: PLAN_KIND_LABEL[p.kind as keyof typeof PLAN_KIND_LABEL] ?? "Plan",
      days: p.days,
    });
  }
  for (const r of runs) {
    const end = r.endedAt!;
    milestones.push({
      atISO: end.toISOString().slice(0, 10),
      kind: "manual",
      label: `Manual reading ended: ${r.chapters} chapters`,
      detail: "",
      days: r.startedAt ? Math.max(1, Math.round((end.getTime() - r.startedAt.getTime()) / 86_400_000) + 1) : null,
    });
  }
  for (const r of resets) {
    milestones.push({ atISO: r.at.toISOString().slice(0, 10), kind: "reset", label: "Started over", detail: "", days: null });
  }
  milestones.sort((a, b) => (b.atISO ?? "").localeCompare(a.atISO ?? ""));

  const bests: { label: string; days: number }[] = [];
  for (const [l, label] of [
    [t.bible, "Fastest whole Bible"],
    [t.nt, "Fastest New Testament"],
    [t.ot, "Fastest Old Testament"],
  ] as const) {
    const ds = l.completions.map((c) => c.days).filter((d): d is number => d !== null);
    if (ds.length) bests.push({ label, days: Math.min(...ds) });
  }

  return {
    bible: view(t.bible),
    ot: view(t.ot),
    nt: view(t.nt),
    sections: t.sections.map(view),
    books: t.books.map(view),
    milestones: milestones.slice(0, 300),
    bests,
    plansCompleted: plansDone.length,
    manual: {
      open: !!open && openCount > 0,
      startedISO: open?.startedAt ? open.startedAt.toISOString().slice(0, 10) : null,
      untimed: !!open && !open.startedAt,
      chapters: openCount,
    },
  };
}

/** Chapters already read in this time through the whole Bible, since the last
 *  "Start over" (for the checklist's "covered" shading). */
export function aheadKeys(events: ReadEvent[], startedOver: number | null): string[] {
  const count = new Map<string, number>();
  for (const e of events) if (startedOver === null || e.at >= startedOver) count.set(e.key, (count.get(e.key) ?? 0) + 1);
  let floor = Infinity;
  for (const k of CANON) floor = Math.min(floor, count.get(k) ?? 0);
  return [...count.entries()].filter(([, n]) => n > floor).map(([k]) => k);
}

const CANON = [...BOOK_BY_NAME.values()].flatMap((b) => Array.from({ length: b.chapters }, (_, i) => `${b.name}|${i + 1}`));
