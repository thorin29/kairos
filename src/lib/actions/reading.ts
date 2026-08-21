"use server";

import { revalidatePath } from "next/cache";
import { requireInteractive } from "@/lib/gate";
import { prisma } from "@/lib/prisma";
import { fromDateColumn, toDateColumn } from "@/lib/dates";
import { isAdmin, requireAdmin } from "@/lib/session";
import { generateReadingTasks } from "@/lib/bible/generate";
import { parsePassage } from "@/lib/bible/books";
import {
  buildPlan,
  decodeSegments,
  MAX_DAYS,
  type Extra,
  type Pace,
} from "@/lib/bible/plan-builder";
import { BOOK_BY_NAME } from "@/lib/bible/books";

export type ImportState = {
  error: string | null;
  imported: number;
  skipped: string[];
};

const empty: ImportState = { error: null, imported: 0, skipped: [] };

/**
 * Accepts the two things people actually have: a date and a passage per
 * line, comma or tab separated. Dates may be ISO or M/D/YYYY.
 *
 * Rows that can't be understood are reported back rather than dropped
 * silently — a plan with a hole in it is worse than a failed import.
 */
export async function importPlan(
  _prev: ImportState,
  formData: FormData,
): Promise<ImportState> {
  if (!(await isAdmin())) {
    return { ...empty, error: "Only a parent can import a plan." };
  }

  const name = String(formData.get("name") ?? "").trim().slice(0, 80);
  const raw = String(formData.get("csv") ?? "").trim();

  if (name.length < 2) return { ...empty, error: "Name the plan." };
  if (!raw) return { ...empty, error: "Paste the schedule first." };

  const rows: { day: Date; passage: string }[] = [];
  const skipped: string[] = [];
  const seen = new Set<string>();

  for (const line of raw.split(/\r?\n/)) {
    const text = line.trim();
    if (!text) continue;

    // Split on tab or the first comma, so "Jude, Revelation 1" survives.
    const parts = text.includes("\t")
      ? text.split("\t")
      : [text.slice(0, text.indexOf(",")), text.slice(text.indexOf(",") + 1)];

    const rawDate = (parts[0] ?? "").trim().replace(/^["']|["']$/g, "");
    const passage = (parts[1] ?? "").trim().replace(/^["']|["']$/g, "");

    if (!rawDate || !passage) {
      skipped.push(text.slice(0, 60));
      continue;
    }

    // Header rows and anything else non-datey.
    const iso = normalizeDate(rawDate);
    if (!iso) {
      if (!/^date$/i.test(rawDate)) skipped.push(text.slice(0, 60));
      continue;
    }

    if (parsePassage(passage).length === 0) {
      skipped.push(`${iso}: ${passage}`.slice(0, 60));
      continue;
    }

    if (seen.has(iso)) continue;
    seen.add(iso);

    rows.push({ day: toDateColumn(iso), passage: passage.slice(0, 120) });
  }

  if (rows.length === 0) {
    return { ...empty, error: "Nothing readable in that.", skipped };
  }

  const sorted = [...rows].sort((a, b) => a.day.getTime() - b.day.getTime());

  const plan = await prisma.readingPlan.create({
    data: {
      name,
      startDate: sorted[0].day,
      endDate: sorted[sorted.length - 1].day,
      days: { create: sorted },
    },
  });

  revalidatePath("/admin/bible");
  return {
    error: null,
    imported: rows.length,
    skipped: skipped.slice(0, 20),
  };
}

export type GenerateState = {
  error: string | null;
  created: number;
  name: string | null;
  startISO: string | null;
  endISO: string | null;
  leftover: number;
};

const emptyGenerate: GenerateState = {
  error: null,
  created: 0,
  name: null,
  startISO: null,
  endISO: null,
  leftover: 0,
};

/**
 * Builds a dated plan from a choice of books and a pace, and saves it as a
 * draft. The form previews with the same builder, but nothing it computed is
 * trusted here — only the inputs cross the wire, and the schedule is built
 * again on this side.
 */
export async function generatePlan(
  _prev: GenerateState,
  formData: FormData,
): Promise<GenerateState> {
  if (!(await isAdmin())) {
    return { ...emptyGenerate, error: "Only a parent can build a plan." };
  }

  const name = String(formData.get("name") ?? "").trim().slice(0, 80);
  if (name.length < 2) return { ...emptyGenerate, error: "Name the plan." };

  const segments = decodeSegments(String(formData.get("segments") ?? ""));
  const startISO = String(formData.get("start") ?? "");

  let pace: Pace;
  if (String(formData.get("paceKind") ?? "weekly") === "finish") {
    pace = {
      kind: "finish",
      endISO: String(formData.get("finish") ?? ""),
      weekdays: String(formData.get("weekdays") ?? "")
        .split(",")
        .map((d) => Number(d))
        .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6),
    };
  } else {
    // perWeekday arrives as "0:1,1:2,2:2,..." — weekday to chapters.
    const perWeekday: Record<number, number> = {};
    for (const pair of String(formData.get("perWeekday") ?? "").split(",")) {
      const [d, n] = pair.split(":").map(Number);
      if (Number.isInteger(d) && d >= 0 && d <= 6 && n > 0) perWeekday[d] = n;
    }
    pace = { kind: "weekly", perWeekday };
  }

  const extras: Extra[] = [];
  for (const line of String(formData.get("extras") ?? "").split("\n")) {
    const [iso, ...rest] = line.split("|");
    const passage = rest.join("|").trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(iso) && passage) {
      extras.push({ iso, passage });
    }
  }

  const built = buildPlan({
    segments,
    startISO,
    pace,
    keepBooksWhole: formData.get("whole") === "on",
    extras,
  });

  if (built.error) return { ...emptyGenerate, error: built.error };
  if (built.days.length === 0 || built.days.length > MAX_DAYS) {
    return { ...emptyGenerate, error: "That plan is empty or far too long." };
  }

  await prisma.readingPlan.create({
    data: {
      name,
      notes: `Generated ${built.totalChapters} chapters over ${built.days.length} days`,
      startDate: toDateColumn(built.days[0].iso),
      endDate: toDateColumn(built.days[built.days.length - 1].iso),
      days: {
        create: built.days.map((d) => ({
          day: toDateColumn(d.iso),
          passage: d.passage.slice(0, 120),
          isExtra: d.isExtra,
        })),
      },
    },
  });

  revalidatePath("/admin/bible");

  return {
    error: null,
    created: built.days.length,
    name,
    startISO: built.startISO,
    endISO: built.endISO,
    leftover: built.leftover,
  };
}

// ---------------------------------------------------------------
// Where the household is up to
//
// Marking chapters read seeds the coverage percentage with reading done
// before, or outside, this installation's plan — so the figure reflects
// reality rather than only what's been scheduled here. It's independent of
// whether anyone ticked their daily box: the assumption is everyone reads
// everything and catches up if they fall behind.
// ---------------------------------------------------------------

/** Every chapter of a book, as "Book|chapter" strings won't help here. */
function chaptersOf(bookName: string): number[] {
  const book = BOOK_BY_NAME.get(bookName);
  if (!book) return [];
  return Array.from({ length: book.chapters }, (_, i) => i + 1);
}

export async function setChapterRead(
  bookName: string,
  chapter: number,
  read: boolean,
): Promise<void> {
  await requireAdmin();
  const book = BOOK_BY_NAME.get(bookName);
  if (!book || chapter < 1 || chapter > book.chapters) return;

  if (read) {
    await prisma.chapterCompletion.upsert({
      where: { bookName_chapter: { bookName, chapter } },
      update: {},
      create: { bookName, chapter },
    });
  } else {
    await prisma.chapterCompletion.deleteMany({ where: { bookName, chapter } });
  }

  revalidatePath("/admin/bible");
  revalidatePath("/bible");
}

/**
 * Replace a book's hand-marked chapters with exactly this set — the whole
 * book's manual marks are deleted and rewritten. Lets the editor stage changes
 * and commit them in one go on Save, rather than saving every tap.
 */
export async function setBookChapters(
  bookName: string,
  chapters: number[],
): Promise<void> {
  await requireAdmin();
  const book = BOOK_BY_NAME.get(bookName);
  if (!book) return;

  const valid = [...new Set(chapters)].filter(
    (c) => Number.isInteger(c) && c >= 1 && c <= book.chapters,
  );

  await prisma.chapterCompletion.deleteMany({ where: { bookName } });
  if (valid.length > 0) {
    await prisma.chapterCompletion.createMany({
      data: valid.map((chapter) => ({ bookName, chapter })),
      skipDuplicates: true,
    });
  }

  revalidatePath("/admin/bible");
  revalidatePath("/admin/bible/progress");
  revalidatePath("/bible");
}

/** Mark or clear a whole book at once. */
export async function setBookRead(
  bookName: string,
  read: boolean,
): Promise<void> {
  await requireAdmin();
  const chapters = chaptersOf(bookName);
  if (chapters.length === 0) return;

  if (read) {
    await prisma.chapterCompletion.createMany({
      data: chapters.map((chapter) => ({ bookName, chapter })),
      skipDuplicates: true,
    });
  } else {
    await prisma.chapterCompletion.deleteMany({ where: { bookName } });
  }

  revalidatePath("/admin/bible");
  revalidatePath("/bible");
}

/** Mark or clear several whole books — Old or New Testament in one go. */
export async function setBooksRead(
  bookNames: string[],
  read: boolean,
): Promise<void> {
  await requireAdmin();
  const rows = bookNames.flatMap((bookName) =>
    chaptersOf(bookName).map((chapter) => ({ bookName, chapter })),
  );
  if (rows.length === 0) return;

  if (read) {
    await prisma.chapterCompletion.createMany({
      data: rows,
      skipDuplicates: true,
    });
  } else {
    await prisma.chapterCompletion.deleteMany({
      where: { bookName: { in: bookNames.filter((b) => BOOK_BY_NAME.has(b)) } },
    });
  }

  revalidatePath("/admin/bible");
  revalidatePath("/bible");
}

function normalizeDate(value: string): string | null {
  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const us = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (us) {
    return `${us[3]}-${us[1].padStart(2, "0")}-${us[2].padStart(2, "0")}`;
  }

  return null;
}

/** Only one plan is live; publishing a new one retires the old. */
export async function publishPlan(id: string): Promise<void> {
  await requireAdmin();

  // Multiple plans can be published at once, so a plan that starts when another
  // ends can be published ahead of time and the family reading rolls straight
  // on. Each day's reading comes from whichever published plan covers it.
  await prisma.readingPlan.update({
    where: { id },
    data: { isPublished: true },
  });

  await generateReadingTasks();

  revalidatePath("/admin/bible");
  revalidatePath("/bible");
  revalidatePath("/");
}

export async function unpublishPlan(id: string): Promise<void> {
  await requireAdmin();

  await prisma.readingPlan.update({
    where: { id },
    data: { isPublished: false },
  });

  // Pull unread rows; anything already ticked stays as a record.
  await prisma.task.deleteMany({
    where: {
      category: "BIBLE",
      generatedFrom: `plan:${id}`,
      status: "PENDING",
    },
  });

  revalidatePath("/admin/bible");
  revalidatePath("/bible");
  revalidatePath("/");
}

export async function deletePlan(id: string): Promise<void> {
  await requireAdmin();

  await prisma.task.deleteMany({
    where: { category: "BIBLE", generatedFrom: `plan:${id}`, status: "PENDING" },
  });
  await prisma.readingPlan.delete({ where: { id } });

  revalidatePath("/admin/bible");
  revalidatePath("/bible");
}

export type PlanPreview = {
  id: string;
  name: string;
  isPublished: boolean;
  dayCount: number;
  startISO: string | null;
  endISO: string | null;
};

export async function listPlans(): Promise<PlanPreview[]> {
  await requireInteractive();
  const plans = await prisma.readingPlan.findMany({
    where: { ownerId: null },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { days: true } } },
  });

  return plans.map((p) => ({
    id: p.id,
    name: p.name,
    isPublished: p.isPublished,
    dayCount: p._count.days,
    startISO: p.startDate ? fromDateColumn(p.startDate) : null,
    endISO: p.endDate ? fromDateColumn(p.endDate) : null,
  }));
}
