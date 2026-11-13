import "server-only";
// Plan rescheduling shared by the web actions (actions/class-plans.ts, which
// guard them) and the app's device-auth API route (which authorises first).
// Kept out of the "use server" module (v0.699): every export of a "use server"
// file is a callable server action, and these have no guard of their own.
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { Category, Prisma, SchoolWorkType, TaskStatus } from "@/generated/prisma/client";
import { todayISO, toDateColumn, addDays } from "@/lib/dates";
import { spreadUnits, spreadUnitsFit, type PlanUnit } from "@/lib/school/plan-builder";
import { noSchoolDaysFor } from "@/lib/school/school-days";

function dISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * After a student works ahead, pull the plan's remaining *future* work earlier
 * so it finishes sooner (and an overflowing plan can re-fit). Re-spreads undone
 * units dated today-or-later (plus any unscheduled overflow) from the next school
 * day at the plan's rate; overdue and today's items are left exactly where they
 * are — being behind never reshuffles the schedule. Published plans only.
 */
export async function reschedulePlanForward(planId: string, today: string): Promise<void> {
  const plan = await prisma.classPlan.findUnique({
    where: { id: planId },
    select: {
      id: true,
      status: true,
      paused: true,
      bothTerms: true,
      perDay: true,
      weekdays: true,
      fitToTerm: true,
      class: {
        select: { id: true, userId: true, termId: true, subject: { select: { name: true } } },
      },
      units: {
        orderBy: { seq: "asc" },
        select: {
          id: true,
          label: true,
          type: true,
          load: true,
          done: true,
          scheduledDate: true,
          workId: true,
          work: { select: { taskId: true } },
        },
      },
    },
  });
  // A paused plan has no schedule to pull in (v0.702).
  if (!plan || plan.status !== "PUBLISHED" || plan.paused) return;

  const allTerms = await prisma.term.findMany({
    orderBy: { startDate: "asc" },
    select: { id: true, startDate: true, endDate: true },
  });
  const windows = plan.bothTerms ? allTerms : allTerms.filter((t) => t.id === plan.class.termId);
  if (windows.length === 0) return;
  const terms = windows.map((t) => ({ start: dISO(t.startDate), end: dISO(t.endDate) }));
  const skip = await noSchoolDaysFor(terms);
  const weekdays = plan.weekdays.split("").map(Number);

  // Undone units that are today-or-future or unscheduled overflow. Overdue and
  // today's items keep their dates.
  const movable = plan.units.filter(
    (u) => !u.done && (u.scheduledDate == null || dISO(u.scheduledDate) > today),
  );
  if (movable.length === 0) return;

  const fromISO = addDays(today, 1);
  const asPlan = movable.map((u) => ({
    label: u.label,
    type: u.type as PlanUnit["type"],
    load: u.load,
  }));
  const sched = plan.fitToTerm
    ? spreadUnitsFit(asPlan, { startDate: fromISO, weekdays, holidays: skip, terms })
    : spreadUnits(asPlan, { startDate: fromISO, weekdays, holidays: skip, terms, perDay: plan.perDay });

  const subject = plan.class.subject?.name ?? null;
  const userId = plan.class.userId;
  const classId = plan.class.id;

  await prisma.$transaction(async (tx) => {
    for (let i = 0; i < movable.length; i++) {
      const unit = movable[i];
      const date = sched[i]?.date ?? null;
      if (!date) continue; // still doesn't fit — leave it
      const isTest = unit.type === "TEST";
      const already = unit.scheduledDate && dISO(unit.scheduledDate) === date;
      if (unit.workId && unit.work?.taskId) {
        if (already) continue;
        await tx.task.update({ where: { id: unit.work.taskId }, data: { dueDate: toDateColumn(date) } });
        await tx.schoolWork.update({
          where: { id: unit.workId },
          data: { startDate: isTest ? null : toDateColumn(date) },
        });
        await tx.classPlanUnit.update({
          where: { id: unit.id },
          data: { scheduledDate: toDateColumn(date) },
        });
      } else {
        // overflow that now fits — create its work
        const created = await tx.task.create({
          data: {
            userId,
            title: unit.label,
            category: Category.SCHOOL,
            dueDate: toDateColumn(date),
            schoolWork: {
              create: {
                type: unit.type as SchoolWorkType,
                subject,
                classId,
                dateSpecific: isTest,
                startDate: isTest ? null : toDateColumn(date),
              },
            },
          },
          select: { schoolWork: { select: { id: true } } },
        });
        await tx.classPlanUnit.update({
          where: { id: unit.id },
          data: { scheduledDate: toDateColumn(date), workId: created.schoolWork!.id },
        });
      }
    }
  });
}

/** Pull an upcoming piece of school work into today (from "do some extra work"),
 *  then compress the class's remaining future work so the finish pulls in. The
 *  item lands in today's list to be ticked off like anything else. */
/** Moves a school task's due date to today and reschedules its plan. No auth —
 *  callers must authorize first (the server action and the device API route do). */
export async function addSchoolWorkToTodayCore(taskId: string): Promise<string | null> {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: {
      userId: true,
      dueDate: true,
      originalDueDate: true,
      schoolWork: {
        select: { id: true, dateSpecific: true, planUnit: { select: { id: true, planId: true } } },
      },
    },
  });
  if (!task) return null;

  const today = todayISO();
  const d = toDateColumn(today);
  // Remember where it was PLANNED, once. Already set means this has been moved
  // before, and the first date is the one worth keeping — otherwise a second
  // move would quietly redefine "original" as "wherever it was last".
  const keepOriginal = task.originalDueDate ?? task.dueDate;
  // `tx` annotated because this callback now sits in changed code: its type
  // comes from the generated Prisma client, which does not exist in the
  // sandbox, so it reads as an implicit any here and as the real client in the
  // Docker build. Naming the type satisfies both.
  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.task.update({
      where: { id: taskId },
      data: { dueDate: d, originalDueDate: keepOriginal },
    });
    const sw = task.schoolWork;
    if (sw) {
      if (!sw.dateSpecific) await tx.schoolWork.update({ where: { id: sw.id }, data: { startDate: d } });
      if (sw.planUnit) await tx.classPlanUnit.update({ where: { id: sw.planUnit.id }, data: { scheduledDate: d } });
    }
  });

  const planId = task.schoolWork?.planUnit?.planId;
  if (planId) await reschedulePlanForward(planId, today);

  revalidatePath("/");
  revalidatePath(`/person/${task.userId}`);
  revalidatePath("/tasks");
  return task.userId;
}
