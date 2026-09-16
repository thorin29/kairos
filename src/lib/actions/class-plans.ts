"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/session";
import { requireInteractive, requireCanActFor } from "@/lib/gate";
import { prisma } from "@/lib/prisma";
import { parseClassPlanCsv, startIndexOf } from "@/lib/school/plan-csv";
import { Category, SchoolWorkType, TaskStatus } from "@/generated/prisma/client";
import { todayISO, toDateColumn, addDays } from "@/lib/dates";
import { spreadUnits, spreadUnitsFit, type PlanUnit } from "@/lib/school/plan-builder";
import { noSchoolDaysFor } from "@/lib/school/school-days";

function dISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export type ImportResult = { created: number; messages: string[] };

/** Import class plans from an uploaded/pasted CSV into DRAFT ClassPlans. Creates
 *  the SchoolClass (student + name + term) if needed, upserts the subject, and
 *  replaces an existing *draft* plan (never clobbers a published one). */
export async function importClassPlansFromCsv(csvText: string): Promise<ImportResult> {
  await requireAdmin();
  const { plans, errors } = parseClassPlanCsv(csvText);
  const messages: string[] = [...errors];
  let created = 0;

  const people = await prisma.user.findMany({
    where: { kind: "CHILD" },
    select: { id: true, name: true },
  });
  const byName = new Map(people.map((p) => [p.name.trim().toLowerCase(), p.id]));
  const terms = await prisma.term.findMany({
    orderBy: { startDate: "asc" },
    select: { id: true, name: true },
  });

  for (const p of plans) {
    const userId = byName.get(p.student.trim().toLowerCase());
    if (!userId) {
      messages.push(`No student named "${p.student}" — skipped ${p.className}.`);
      continue;
    }
    if (p.units.length === 0) {
      messages.push(`"${p.className}" has no units — skipped.`);
      continue;
    }

    let termId: string | null = null;
    if (p.term === "both") termId = terms[0]?.id ?? null;
    else termId = terms.find((t) => t.name.toLowerCase().includes(p.term))?.id ?? terms[0]?.id ?? null;

    let subjectId: string | null = null;
    if (p.subject) {
      const subj = await prisma.subject.upsert({
        where: { name: p.subject },
        update: {},
        create: { name: p.subject },
        select: { id: true },
      });
      subjectId = subj.id;
    }

    let cls = await prisma.schoolClass.findFirst({
      where: { userId, name: p.className, termId },
      select: { id: true, plan: { select: { id: true, status: true } } },
    });
    if (!cls) {
      cls = await prisma.schoolClass.create({
        data: { userId, name: p.className, termId, subjectId },
        select: { id: true, plan: { select: { id: true, status: true } } },
      });
    }

    if (cls.plan) {
      if (cls.plan.status === "PUBLISHED") {
        messages.push(`"${p.className}" already has a published plan — skipped (edit it instead).`);
        continue;
      }
      await prisma.classPlan.delete({ where: { id: cls.plan.id } }); // cascade drops old units
    }

    const startIndex = startIndexOf(p.units, p.startFrom);
    await prisma.classPlan.create({
      data: {
        classId: cls.id,
        bothTerms: p.term === "both",
        perDay: p.perDay,
        weekdays: p.weekdays.join(""),
        startIndex,
        startDate: p.startDate ? toDateColumn(p.startDate) : null,
        fitToTerm: p.fitToTerm,
        status: "DRAFT",
        units: {
          create: p.units.map((u, i) => ({
            seq: i,
            label: u.label,
            type: u.type as SchoolWorkType,
            load: u.load,
            done: i < startIndex,
          })),
        },
      },
    });
    created += 1;
  }

  revalidatePath("/admin/school");
  return { created, messages };
}

export async function deleteClassPlan(id: string): Promise<void> {
  await requireAdmin();
  // Remove the SchoolWork/Tasks this plan generated before dropping the plan —
  // otherwise they'd be orphaned on the student's card.
  const plan = await prisma.classPlan.findUnique({
    where: { id },
    select: {
      class: { select: { userId: true } },
      units: { select: { work: { select: { taskId: true } } } },
    },
  });
  const taskIds = (plan?.units ?? [])
    .map((u) => u.work?.taskId)
    .filter((t): t is string => Boolean(t));
  await prisma.$transaction([
    ...(taskIds.length ? [prisma.task.deleteMany({ where: { id: { in: taskIds } } })] : []),
    prisma.classPlan.delete({ where: { id } }),
  ]);
  revalidatePath("/");
  if (plan?.class.userId) revalidatePath(`/person/${plan.class.userId}`);
  revalidatePath("/admin/school");
}

export type SaveDraftInput = {
  planId: string;
  order: string[]; // unit ids, in the new order
  done: string[]; // unit ids marked done / skipped (won't be scheduled)
  perDay: number;
  weekdays: number[]; // ISO 1..7
  bothTerms: boolean;
  startDate: string; // YYYY-MM-DD, or "" to clear (start today)
  fitToTerm: boolean;
};

/** Persist a draft plan's manual edits: the reordered unit list, which units are
 *  marked done/skipped, and the spread settings (perDay, weekdays, both-terms).
 *  Never touches a published plan. */
export async function saveClassPlanDraft(input: SaveDraftInput): Promise<{ error: string | null }> {
  await requireAdmin();
  const plan = await prisma.classPlan.findUnique({
    where: { id: input.planId },
    select: { id: true, status: true, units: { select: { id: true } } },
  });
  if (!plan) return { error: "Plan not found." };
  if (plan.status === "PUBLISHED") {
    return { error: "A published plan can't be reordered — delete and re-import to change it." };
  }

  const ids = new Set(plan.units.map((u) => u.id));
  const order = input.order.filter((id) => ids.has(id));
  if (order.length !== plan.units.length) {
    return { error: "The unit list is out of sync — reload the page and try again." };
  }
  const doneSet = new Set(input.done.filter((id) => ids.has(id)));
  const weekdays = input.weekdays.filter((n) => n >= 1 && n <= 7).join("") || "12345";
  const perDay = Math.min(Math.max(1, Math.round(input.perDay) || 1), 20);
  const firstUndone = order.findIndex((id) => !doneSet.has(id));
  const startIndex = firstUndone < 0 ? order.length : firstUndone;
  const startDate = /^\d{4}-\d{2}-\d{2}$/.test(input.startDate) ? input.startDate : "";

  // Reassign seq in two phases so the @@unique([planId, seq]) never collides
  // mid-update: park every row at a distinct negative seq first, then set finals.
  await prisma.$transaction([
    ...order.map((id, i) => prisma.classPlanUnit.update({ where: { id }, data: { seq: -(i + 1) } })),
    ...order.map((id, i) =>
      prisma.classPlanUnit.update({ where: { id }, data: { seq: i, done: doneSet.has(id) } }),
    ),
    prisma.classPlan.update({
      where: { id: plan.id },
      data: {
        perDay,
        weekdays,
        bothTerms: input.bothTerms,
        startIndex,
        startDate: startDate ? toDateColumn(startDate) : null,
        fitToTerm: input.fitToTerm,
      },
    }),
  ]);

  revalidatePath("/admin/school");
  revalidatePath(`/admin/school/plan/${plan.id}`);
  return { error: null };
}

export type PublishResult = { error: string | null; created: number; unscheduled: number };

/** Publish a DRAFT plan: spread its undone units across the term's school days
 *  and generate one SchoolWork item per scheduled unit (a lesson is a window
 *  item shown from its day; a test is date-specific). Units that don't fit
 *  before the last term ends are left unscheduled and reported. */
export async function publishClassPlan(planId: string): Promise<PublishResult> {
  await requireAdmin();
  const plan = await prisma.classPlan.findUnique({
    where: { id: planId },
    select: {
      id: true,
      status: true,
      bothTerms: true,
      perDay: true,
      weekdays: true,
      startDate: true,
      fitToTerm: true,
      class: {
        select: { id: true, userId: true, termId: true, subject: { select: { name: true } } },
      },
      units: {
        orderBy: { seq: "asc" },
        select: { id: true, label: true, type: true, load: true, done: true },
      },
    },
  });
  if (!plan) return { error: "Plan not found.", created: 0, unscheduled: 0 };
  if (plan.status === "PUBLISHED") {
    return { error: "This plan is already published.", created: 0, unscheduled: 0 };
  }

  const allTerms = await prisma.term.findMany({
    orderBy: { startDate: "asc" },
    select: { id: true, startDate: true, endDate: true },
  });
  const windows = plan.bothTerms ? allTerms : allTerms.filter((t) => t.id === plan.class.termId);
  if (windows.length === 0) {
    return { error: "This class has no term dates to schedule against.", created: 0, unscheduled: 0 };
  }
  const terms = windows.map((t) => ({ start: dISO(t.startDate), end: dISO(t.endDate) }));
  const skip = await noSchoolDaysFor(terms);

  const undoneUnits = plan.units.filter((u) => !u.done);
  const undonePlan = undoneUnits.map((u) => ({
    label: u.label,
    type: u.type as PlanUnit["type"],
    load: u.load,
  }));
  const start = plan.startDate ? dISO(plan.startDate) : todayISO();
  const weekdays = plan.weekdays.split("").map(Number);
  const sched = plan.fitToTerm
    ? spreadUnitsFit(undonePlan, { startDate: start, weekdays, holidays: skip, terms })
    : spreadUnits(undonePlan, { startDate: start, weekdays, holidays: skip, terms, perDay: plan.perDay });

  const placed = undoneUnits
    .map((u, i) => ({ unit: u, date: sched[i]?.date ?? null }))
    .filter((x): x is { unit: (typeof undoneUnits)[number]; date: string } => x.date != null);
  const unscheduled = undoneUnits.length - placed.length;

  if (placed.length === 0) {
    return {
      error: "Nothing fits before the term ends — adjust the start, weekdays, or per-day and try again.",
      created: 0,
      unscheduled,
    };
  }

  const subject = plan.class.subject?.name ?? null;
  const userId = plan.class.userId;
  const classId = plan.class.id;

  await prisma.$transaction(async (tx) => {
    // The class owner must be a member for the work to file under the class
    // (CSV-created classes have no member row yet).
    await tx.classMember.upsert({
      where: { classId_userId: { classId, userId } },
      update: {},
      create: { classId, userId },
    });

    for (const { unit, date } of placed) {
      const isTest = unit.type === "TEST";
      const task = await tx.task.create({
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
        data: { scheduledDate: toDateColumn(date), workId: task.schoolWork!.id },
      });
    }

    await tx.classPlan.update({ where: { id: plan.id }, data: { status: "PUBLISHED" } });
  });

  revalidatePath("/");
  revalidatePath(`/person/${userId}`);
  revalidatePath("/admin/school");
  revalidatePath(`/admin/school/plan/${plan.id}`);
  return { error: null, created: placed.length, unscheduled };
}

/**
 * After a student works ahead, pull the plan's remaining *future* work earlier
 * so it finishes sooner (and an overflowing plan can re-fit). Re-spreads undone
 * units dated today-or-later (plus any unscheduled overflow) from the next school
 * day at the plan's rate; overdue and today's items are left exactly where they
 * are — being behind never reshuffles the schedule. Published plans only.
 */
async function reschedulePlanForward(planId: string, today: string): Promise<void> {
  const plan = await prisma.classPlan.findUnique({
    where: { id: planId },
    select: {
      id: true,
      status: true,
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
  if (!plan || plan.status !== "PUBLISHED") return;

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

/** Complete a piece of school work early (from "Get ahead in school") and pull
 *  the rest of that class's remaining work earlier so the plan finishes sooner. */
export async function completeSchoolAhead(taskId: string): Promise<void> {
  await requireInteractive();
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: {
      userId: true,
      schoolWork: { select: { planUnit: { select: { planId: true } } } },
    },
  });
  if (!task) return;
  await requireCanActFor(task.userId);

  await prisma.task.update({
    where: { id: taskId },
    data: { status: TaskStatus.COMPLETE, completedAt: new Date() },
  });

  const planId = task.schoolWork?.planUnit?.planId;
  if (planId) await reschedulePlanForward(planId, todayISO());

  revalidatePath("/");
  revalidatePath(`/person/${task.userId}`);
  revalidatePath("/tasks");
}
