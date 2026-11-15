import "server-only";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { fromDateColumn, toDateColumn } from "@/lib/dates";
import { generateReadingTasks } from "@/lib/bible/generate";
import {
  addReadings,
  exportFileName,
  formatPlanText,
  parsePlanText,
  type AddMode,
  type AddResult,
  type ParsedPlan,
  type PlanDay,
} from "@/lib/bible/plan-edit";

/**
 * The guard-free core of changing a plan's days: adding readings, importing
 * and exporting. Shared by the web actions and the mobile API; callers check
 * who may touch the plan (a parent for a family plan, the owner for theirs).
 */

export type PlanRef = { id: string; name: string; ownerId: string | null; isPublished: boolean; endKind: string };

/** The family plan readings go into: the published plan whose dates bracket
 *  the day, else the one that ends last. */
export async function familyPlanFor(dayISO: string | null): Promise<PlanRef | null> {
  const plans = await prisma.readingPlan.findMany({
    where: { ownerId: null, isPublished: true },
    orderBy: { endDate: "asc" },
    select: { id: true, name: true, ownerId: true, isPublished: true, endKind: true, startDate: true, endDate: true },
  });
  if (plans.length === 0) return null;
  const hit = dayISO
    ? plans.find(
        (p) =>
          (!p.startDate || fromDateColumn(p.startDate) <= dayISO) &&
          (!p.endDate || fromDateColumn(p.endDate) >= dayISO),
      )
    : undefined;
  const p = hit ?? plans[plans.length - 1];
  return { id: p.id, name: p.name, ownerId: p.ownerId, isPublished: p.isPublished, endKind: p.endKind };
}

export async function personalPlanOf(userId: string): Promise<PlanRef | null> {
  const p = await prisma.readingPlan.findFirst({
    where: { ownerId: userId },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, ownerId: true, isPublished: true, endKind: true },
  });
  return p;
}

export async function planRef(planId: string): Promise<PlanRef | null> {
  return prisma.readingPlan.findUnique({
    where: { id: planId },
    select: { id: true, name: true, ownerId: true, isPublished: true, endKind: true },
  });
}

async function planDays(planId: string): Promise<PlanDay[]> {
  const rows = await prisma.readingDay.findMany({
    where: { planId },
    orderBy: { day: "asc" },
    select: { day: true, passage: true, isExtra: true, extra: true },
  });
  return rows.map((r) => ({ iso: fromDateColumn(r.day), passage: r.passage, isExtra: r.isExtra, extra: r.extra }));
}

/** Rewrite a plan's days from `fromISO` on, and keep its date range in step. */
async function replaceFrom(plan: PlanRef, fromISO: string, days: PlanDay[]): Promise<void> {
  const keep = days.filter((d) => d.iso >= fromISO);
  await prisma.$transaction(async (tx) => {
    await tx.readingDay.deleteMany({ where: { planId: plan.id, day: { gte: toDateColumn(fromISO) } } });
    if (keep.length > 0) {
      await tx.readingDay.createMany({
        data: keep.map((d) => ({
          planId: plan.id,
          day: toDateColumn(d.iso),
          passage: d.passage,
          isExtra: d.isExtra ?? false,
          extra: d.extra ?? null,
        })),
      });
    }
    const range = await tx.readingDay.aggregate({
      where: { planId: plan.id },
      _min: { day: true },
      _max: { day: true },
    });
    await tx.readingPlan.update({
      where: { id: plan.id },
      data: { startDate: range._min.day, endDate: range._max.day },
    });
  });
  await afterChange(plan);
}

async function afterChange(plan: PlanRef): Promise<void> {
  if (plan.ownerId === null && plan.isPublished) await generateReadingTasks();
  revalidatePath("/bible");
  revalidatePath("/admin/bible");
  revalidatePath("/");
  if (plan.ownerId) revalidatePath(`/person/${plan.ownerId}`);
}

export type AddInput = {
  readings: string[];
  startISO: string;
  mode: AddMode;
  preview?: boolean;
};

export async function addReadingsCore(plan: PlanRef, input: AddInput): Promise<AddResult> {
  const days = await planDays(plan.id);
  const res = addReadings(days, input.readings, input.startISO, input.mode);
  if (res.error || input.preview) return res;
  await replaceFrom(plan, input.startISO, res.days);
  // Inserting readings into a finished plan means it isn't finished after all.
  if (input.mode === "push") await prisma.readingPlanDone.deleteMany({ where: { planId: plan.id } });
  return res;
}

export type ImportInput = {
  text: string;
  startISO?: string;
  weekdays?: number[];
  /** Used when the text has no "#" name line. */
  name?: string;
  preview?: boolean;
};

export type ImportResult = ParsedPlan & { saved: boolean };

/**
 * Family: a new draft plan, or — given `into` — replace that plan's days from
 * the first date in the import. Personal: replace the person's plan from the
 * first date (or start one). Chapters already read stay read either way.
 */
export async function importPlanCore(
  owner: { ownerId: string | null; into?: PlanRef | null },
  input: ImportInput,
): Promise<ImportResult> {
  const parsed = parsePlanText(input.text, { startISO: input.startISO, weekdays: input.weekdays });
  if (parsed.error || input.preview) return { ...parsed, saved: false };

  const name = (parsed.name ?? input.name ?? "").trim().slice(0, 80) || "Imported plan";
  const target = owner.ownerId ? await personalPlanOf(owner.ownerId) : (owner.into ?? null);

  if (target) {
    await replaceFrom(target, parsed.days[0].iso, parsed.days);
    if (parsed.name && parsed.name !== target.name) {
      await prisma.readingPlan.update({ where: { id: target.id }, data: { name: parsed.name } });
    }
    return { ...parsed, saved: true };
  }

  const plan = await prisma.readingPlan.create({
    data: {
      name,
      ownerId: owner.ownerId,
      // A personal plan is live straight away; a family plan is a draft until
      // a parent publishes it.
      isPublished: owner.ownerId !== null,
      startDate: toDateColumn(parsed.days[0].iso),
      endDate: toDateColumn(parsed.days[parsed.days.length - 1].iso),
      days: {
        create: parsed.days.map((d) => ({
          day: toDateColumn(d.iso),
          passage: d.passage,
          isExtra: d.isExtra ?? false,
          extra: d.extra ?? null,
        })),
      },
    },
    select: { id: true, name: true, ownerId: true, isPublished: true, endKind: true },
  });
  await afterChange(plan);
  return { ...parsed, saved: true };
}

export async function exportPlanCore(plan: PlanRef): Promise<{ name: string; fileName: string; text: string }> {
  const days = await planDays(plan.id);
  return { name: plan.name, fileName: exportFileName(plan.name), text: formatPlanText(plan.name, days) };
}
