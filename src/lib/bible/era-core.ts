import "server-only";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { fromDateColumn, toDateColumn } from "@/lib/dates";
import { parsePassage, BOOK_BY_NAME } from "@/lib/bible/books";
import {
  decodeSnapshot,
  encodeSnapshot,
  isFullPass,
  sectionCounts,
  TOTAL_CHAPTERS,
  type SectionCount,
} from "@/lib/bible/eras";

/**
 * Reading eras: one pass at the Bible each. The open era's start is the floor
 * every coverage figure counts from — the family's plan days and hand marks,
 * or a person's own reads — so starting a new era resets the numbers to 0%
 * while the old era keeps a snapshot of where it got to. Rows are never
 * deleted to start an era (personal reads also feed Wisdom); re-reading a
 * chapter simply restamps it into the current era.
 */

export type EraFloor = { at: Date | null; on: string | null };

const NO_FLOOR: EraFloor = { at: null, on: null };

export async function eraFloor(ownerId: string | null): Promise<EraFloor> {
  const open = await prisma.readingEra.findFirst({
    where: { ownerId, endedAt: null },
    orderBy: { createdAt: "desc" },
    select: { startedAt: true, startedOn: true },
  });
  if (!open?.startedAt) return NO_FLOOR;
  return { at: open.startedAt, on: open.startedOn ? fromDateColumn(open.startedOn) : null };
}

/** The family's chapters this era: the published plan up to today plus the
 *  chapters an admin marked by hand. */
export async function familyEraSet(
  todayISO: string,
  floor?: EraFloor,
): Promise<{ seen: Set<string>; manual: { bookName: string; chapter: number }[] }> {
  const f = floor ?? (await eraFloor(null));
  const [days, manual] = await Promise.all([
    prisma.readingDay.findMany({
      where: {
        plan: { isPublished: true, ownerId: null },
        isExtra: false,
        day: { lte: toDateColumn(todayISO), ...(f.on ? { gte: toDateColumn(f.on) } : {}) },
      },
      select: { passage: true },
    }),
    prisma.chapterCompletion.findMany({
      where: f.at ? { completedAt: { gte: f.at } } : {},
      select: { bookName: true, chapter: true },
    }),
  ]);
  const seen = new Set<string>();
  for (const d of days) for (const r of parsePassage(d.passage)) seen.add(`${r.book}|${r.chapter}`);
  for (const m of manual) if (BOOK_BY_NAME.has(m.bookName)) seen.add(`${m.bookName}|${m.chapter}`);
  return { seen, manual };
}

/** One person's chapters this era. */
export async function personalEraSet(
  userId: string,
  floor?: EraFloor,
): Promise<{ seen: Set<string>; manual: { bookName: string; chapter: number }[] }> {
  const f = floor ?? (await eraFloor(userId));
  const manual = await prisma.userChapterRead.findMany({
    where: { userId, ...(f.at ? { completedAt: { gte: f.at } } : {}) },
    select: { bookName: true, chapter: true },
  });
  const seen = new Set<string>();
  for (const m of manual) if (BOOK_BY_NAME.has(m.bookName)) seen.add(`${m.bookName}|${m.chapter}`);
  return { seen, manual };
}

/** Restamp chapters read in an earlier era, so reading them again counts now. */
export async function restampFamily(refs: { book: string; chapter: number }[]): Promise<void> {
  const f = await eraFloor(null);
  if (!f.at || refs.length === 0) return;
  await prisma.chapterCompletion.updateMany({
    where: { completedAt: { lt: f.at }, OR: refs.map((r) => ({ bookName: r.book, chapter: r.chapter })) },
    data: { completedAt: new Date() },
  });
}

export async function restampPersonal(userId: string, refs: { book: string; chapter: number }[]): Promise<void> {
  const f = await eraFloor(userId);
  if (!f.at || refs.length === 0) return;
  await prisma.userChapterRead.updateMany({
    where: { userId, completedAt: { lt: f.at }, OR: refs.map((r) => ({ bookName: r.book, chapter: r.chapter })) },
    data: { completedAt: new Date() },
  });
}

export type EraSummary = {
  id: string;
  label: string;
  startISO: string | null;
  endISO: string | null;
  read: number;
  percent: number;
  full: boolean;
  sections: SectionCount[];
};

export type ErasPayload = {
  current: EraSummary;
  past: EraSummary[];
  passes: number;
};

function summary(id: string, label: string, startISO: string | null, endISO: string | null, read: Set<string>): EraSummary {
  return {
    id,
    label,
    startISO,
    endISO,
    read: read.size,
    percent: Math.floor((read.size / TOTAL_CHAPTERS) * 100),
    full: isFullPass(read),
    sections: sectionCounts(read),
  };
}

/** The open era and every closed one, newest first, with the full-pass count. */
export async function loadEras(ownerId: string | null, todayISO: string): Promise<ErasPayload> {
  const eras = await prisma.readingEra.findMany({
    where: { ownerId },
    orderBy: { createdAt: "asc" },
  });
  const floor = await eraFloor(ownerId);
  const { seen } = ownerId ? await personalEraSet(ownerId, floor) : await familyEraSet(todayISO, floor);

  let n = 0;
  const labelled = eras.map((e) => {
    const label = e.startedAt ? `Era ${++n}` : "Before eras";
    return { e, label };
  });

  const open = labelled.find((x) => x.e.endedAt === null);
  const current = summary(
    open?.e.id ?? "current",
    open?.label ?? "So far",
    open?.e.startedOn ? fromDateColumn(open.e.startedOn) : null,
    null,
    seen,
  );

  const past = labelled
    .filter((x) => x.e.endedAt !== null)
    .reverse()
    .map((x) =>
      summary(
        x.e.id,
        x.label,
        x.e.startedOn ? fromDateColumn(x.e.startedOn) : null,
        x.e.endedOn ? fromDateColumn(x.e.endedOn) : null,
        decodeSnapshot(x.e.snapshot),
      ),
    );

  const passes = past.filter((p) => p.full).length + (current.full ? 1 : 0);
  return { current, past, passes };
}

/** Close the open era (keeping a snapshot of it) and start a new one today.
 *  With no era yet, everything so far is kept as "Before eras". */
export async function startNewEra(ownerId: string | null, todayISO: string): Promise<void> {
  const floor = await eraFloor(ownerId);
  const { seen } = ownerId ? await personalEraSet(ownerId, floor) : await familyEraSet(todayISO, floor);
  const now = new Date();
  const today = toDateColumn(todayISO);

  await prisma.$transaction(async (tx) => {
    const open = await tx.readingEra.findFirst({
      where: { ownerId, endedAt: null },
      orderBy: { createdAt: "desc" },
    });
    if (open) {
      await tx.readingEra.update({
        where: { id: open.id },
        data: { endedAt: now, endedOn: today, snapshot: encodeSnapshot(seen) },
      });
    } else {
      await tx.readingEra.create({
        data: { ownerId, endedAt: now, endedOn: today, snapshot: encodeSnapshot(seen) },
      });
    }
    await tx.readingEra.create({ data: { ownerId, startedAt: now, startedOn: today } });
  });

  revalidatePath("/bible");
  revalidatePath("/admin/bible");
  if (ownerId) revalidatePath(`/person/${ownerId}`);
}
