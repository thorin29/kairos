"use server";

import { revalidatePath } from "next/cache";
import { requireInteractive } from "@/lib/gate";
import { prisma } from "@/lib/prisma";
import { fromDateColumn, toDateColumn, todayISO } from "@/lib/dates";
import { isAdmin, requireAdmin } from "@/lib/session";
import { generateReadingTasks } from "@/lib/bible/generate";
import {
  buildPlan,
  decodeSegments,
  MAX_DAYS,
  type Extra,
  type Pace,
} from "@/lib/bible/plan-builder";
import { resetManual, setManualBooks, setManualChapter, setManualChapters, keepFinishedPlans } from "@/lib/bible/tracker-core";

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

  const appendTo = String(formData.get("appendTo") ?? "") || null;
  const name = String(formData.get("name") ?? "").trim().slice(0, 80);
  if (!appendTo && name.length < 2) return { ...emptyGenerate, error: "Name the plan." };

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
    balance: formData.get("balance") === "on" ? "verses" : "chapters",
  });

  if (built.error) return { ...emptyGenerate, error: built.error };
  if (built.days.length === 0 || built.days.length > MAX_DAYS) {
    return { ...emptyGenerate, error: "That plan is empty or far too long." };
  }

  // "Add to <plan>": the generated days extend that plan (replacing any of its
  // days from the first new one), so carrying on stays one plan.
  if (appendTo) {
    const target = await prisma.readingPlan.findFirst({
      where: { id: appendTo, ownerId: null },
      select: { id: true, name: true, isPublished: true },
    });
    if (!target) return { ...emptyGenerate, error: "That plan is gone." };
    const first = toDateColumn(built.days[0].iso);
    await prisma.$transaction(async (tx) => {
      await tx.readingDay.deleteMany({ where: { planId: target.id, day: { gte: first } } });
      await tx.readingDay.createMany({
        data: built.days.map((d) => ({
          planId: target.id,
          day: toDateColumn(d.iso),
          passage: d.passage.slice(0, 120),
          isExtra: d.isExtra,
        })),
      });
      const range = await tx.readingDay.aggregate({ where: { planId: target.id }, _min: { day: true }, _max: { day: true } });
      await tx.readingPlan.update({
        where: { id: target.id },
        data: { startDate: range._min.day, endDate: range._max.day },
      });
    });
    // It goes on, so it isn't finished after all.
    await prisma.readingPlanDone.deleteMany({ where: { planId: target.id } });
    if (target.isPublished) await generateReadingTasks();
    revalidatePath("/admin/bible");
    revalidatePath("/bible");
    return {
      error: null,
      created: built.days.length,
      name: target.name,
      startISO: built.startISO,
      endISO: built.endISO,
      leftover: built.leftover,
    };
  }

  await prisma.readingPlan.create({
    data: {
      name,
      endKind: pace.kind === "finish" ? "DATE" : "DONE",
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

export async function setChapterRead(bookName: string, chapter: number, read: boolean): Promise<void> {
  await requireAdmin();
  await setManualChapter(null, bookName, chapter, read);
}

/** Make the family's open manual run hold exactly these chapters of a book —
 *  the editor stages changes and commits them on Save. */
export async function setBookChapters(bookName: string, chapters: number[]): Promise<void> {
  await requireAdmin();
  await setManualChapters(null, bookName, chapters);
}

/** Mark or clear a whole book at once. */
export async function setBookRead(bookName: string, read: boolean): Promise<void> {
  await requireAdmin();
  await setManualBooks(null, [bookName], read);
}

/** Mark or clear several whole books — Old or New Testament in one go. */
export async function setBooksRead(bookNames: string[], read: boolean): Promise<void> {
  await requireAdmin();
  await setManualBooks(null, bookNames, read);
}

/** End the family's manual reading (marks stay counted). */
export async function resetFamilyManual(): Promise<void> {
  await requireAdmin();
  await resetManual(null);
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
  await keepFinishedPlans(null, todayISO());

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

/**
 * Combine a plan into the one it carries on from: its days move into `intoId`
 * (its own win on any shared date), it's deleted, and the earlier plan is no
 * longer counted as finished. The family's reads move with the days, so
 * nothing is counted twice.
 */
export async function combinePlans(intoId: string, fromId: string): Promise<{ error: string | null }> {
  await requireAdmin();
  if (intoId === fromId) return { error: "Pick another plan." };
  const [into, from] = await Promise.all([
    prisma.readingPlan.findFirst({ where: { id: intoId, ownerId: null }, select: { id: true, isPublished: true } }),
    prisma.readingPlan.findFirst({
      where: { id: fromId, ownerId: null },
      select: { id: true, isPublished: true, days: { select: { day: true, passage: true, isExtra: true, extra: true } } },
    }),
  ]);
  if (!into || !from) return { error: "That plan is gone." };

  await prisma.$transaction(async (tx) => {
    if (from.days.length) {
      await tx.readingDay.deleteMany({ where: { planId: into.id, day: { in: from.days.map((d) => d.day) } } });
      await tx.readingDay.createMany({
        data: from.days.map((d) => ({ planId: into.id, day: d.day, passage: d.passage, isExtra: d.isExtra, extra: d.extra })),
      });
    }
    // Family reads keyed to the old plan's days now belong to the combined one.
    await tx.$executeRaw`
      DELETE FROM "BibleRead" r
      WHERE r."scope" = 'family' AND r."sourceKey" LIKE ${from.id + "|%"}
        AND EXISTS (
          SELECT 1 FROM "BibleRead" o
          WHERE o."scope" = 'family' AND o."source" = r."source" AND o."bookName" = r."bookName"
            AND o."chapter" = r."chapter"
            AND o."sourceKey" = ${into.id} || substring(r."sourceKey" from ${from.id.length + 1}::int)
        )`;
    await tx.$executeRaw`
      UPDATE "BibleRead" SET "sourceKey" = ${into.id} || substring("sourceKey" from ${from.id.length + 1}::int)
      WHERE "scope" = 'family' AND "sourceKey" LIKE ${from.id + "|%"}`;
    await tx.readingPlanDone.deleteMany({ where: { planId: { in: [into.id, from.id] } } });
    await tx.readingPlan.delete({ where: { id: from.id } });
    const range = await tx.readingDay.aggregate({ where: { planId: into.id }, _min: { day: true }, _max: { day: true } });
    await tx.readingPlan.update({
      where: { id: into.id },
      data: { startDate: range._min.day, endDate: range._max.day, ...(from.isPublished ? { isPublished: true } : {}) },
    });
  });

  await generateReadingTasks();
  revalidatePath("/admin/bible");
  revalidatePath("/bible");
  revalidatePath("/");
  return { error: null };
}
