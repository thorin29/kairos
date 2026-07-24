"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { fromDateColumn, toDateColumn } from "@/lib/dates";
import { isAdmin, requireAdmin } from "@/lib/session";
import { generateReadingTasks } from "@/lib/bible/generate";
import { parsePassage } from "@/lib/bible/books";

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

  await prisma.$transaction([
    prisma.readingPlan.updateMany({
      where: { isPublished: true },
      data: { isPublished: false },
    }),
    prisma.readingPlan.update({
      where: { id },
      data: { isPublished: true },
    }),
  ]);

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
  const plans = await prisma.readingPlan.findMany({
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
