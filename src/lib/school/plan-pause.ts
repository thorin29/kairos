import "server-only";
// Paused classes (v0.702). A paused plan has no schedule: only its next undone
// unit has work, due on the next class day, and it rolls forward rather than
// going late. Finishing it brings the next one, due the class day after; the
// student can pull that into today ("do some extra work") to do more. No auth
// here — the admin action guards pause/resume, and the completion paths that
// call `afterPlanUnitChange` have authorised already.
import { prisma } from "@/lib/prisma";
import { Category, Prisma, SchoolWorkType } from "@/generated/prisma/client";
import { addDays, todayISO, toDateColumn } from "@/lib/dates";
import { noSchoolDaysFor } from "@/lib/school/school-days";

function dISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function isoDow(day: string): number {
  const wd = new Date(`${day}T00:00:00Z`).getUTCDay();
  return wd === 0 ? 7 : wd;
}

/** The first day on or after `from` that the class meets: one of its weekdays
 *  and not a no-school day. Falls back to `from` if none turns up in a year. */
export function nextClassDay(from: string, weekdays: number[], holidays: Set<string>): string {
  const wd = new Set(weekdays);
  let d = from;
  for (let i = 0; i < 366; i++) {
    if (wd.has(isoDow(d)) && !holidays.has(d)) return d;
    d = addDays(d, 1);
  }
  return from;
}

async function allNoSchoolDays(): Promise<Set<string>> {
  const terms = await prisma.term.findMany({ select: { startDate: true, endDate: true } });
  const wins = terms.map((t) => ({ start: dISO(t.startDate), end: dISO(t.endDate) }));
  return noSchoolDaysFor(wins);
}

/**
 * Bring a paused plan to its one-open-item state: the first undone unit (plan
 * order) has work, and no later unit does. A new item is due on the next class
 * day from `createFrom`; an existing one that has fallen behind today moves to
 * the next class day from today (`pullIn`: so does one dated later). A no-op for a plan that isn't paused.
 */
export async function ensurePausedNext(
  planId: string,
  opts: { today?: string; createFrom?: string; holidays?: Set<string>; pullIn?: boolean } = {},
): Promise<void> {
  const plan = await prisma.classPlan.findUnique({
    where: { id: planId },
    select: {
      status: true,
      paused: true,
      weekdays: true,
      class: { select: { id: true, userId: true, subject: { select: { name: true } } } },
      units: {
        orderBy: { seq: "asc" },
        select: {
          id: true,
          label: true,
          type: true,
          done: true,
          scheduledDate: true,
          workId: true,
          work: { select: { task: { select: { id: true, status: true, dueDate: true } } } },
        },
      },
    },
  });
  if (!plan || !plan.paused || plan.status !== "PUBLISHED") return;

  const today = opts.today ?? todayISO();
  const holidays = opts.holidays ?? (await allNoSchoolDays());
  const weekdays = plan.weekdays.split("").map(Number);

  const status = (u: (typeof plan.units)[number]) => u.work?.task?.status ?? null;
  const owed = plan.units.filter((u) => !u.done && status(u) !== "COMPLETE" && status(u) !== "SKIPPED");
  const [next, ...later] = owed;

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    // Completed tasks whose unit flag never caught up.
    const stale = plan.units.filter((u) => !u.done && status(u) === "COMPLETE").map((u) => u.id);
    if (stale.length) await tx.classPlanUnit.updateMany({ where: { id: { in: stale } }, data: { done: true } });

    // Only one open item: later units lose their (pending) work and dates.
    for (const u of later) {
      if (u.work?.task) await tx.task.delete({ where: { id: u.work.task.id } }); // cascades its SchoolWork
      if (u.workId || u.scheduledDate) {
        await tx.classPlanUnit.update({ where: { id: u.id }, data: { workId: null, scheduledDate: null } });
      }
    }
    if (!next) return;

    const isTest = next.type === "TEST";
    const task = next.work?.task;
    if (task && next.workId) {
      const due = dISO(task.dueDate);
      // On pause, an item dated further out comes in to the next class day.
      const pullTo = opts.pullIn ? nextClassDay(today, weekdays, holidays) : null;
      if (due >= today && !(pullTo && due > pullTo)) {
        if (!next.scheduledDate || dISO(next.scheduledDate) !== due) {
          await tx.classPlanUnit.update({ where: { id: next.id }, data: { scheduledDate: task.dueDate } });
        }
        return;
      }
      // Behind: roll it forward instead of letting it go late (or pull it in).
      const d = toDateColumn(pullTo ?? nextClassDay(today, weekdays, holidays));
      await tx.task.update({ where: { id: task.id }, data: { dueDate: d } });
      await tx.schoolWork.update({ where: { id: next.workId }, data: { startDate: isTest ? null : d } });
      await tx.classPlanUnit.update({ where: { id: next.id }, data: { scheduledDate: d } });
      return;
    }

    const d = toDateColumn(nextClassDay(opts.createFrom ?? today, weekdays, holidays));
    const created = await tx.task.create({
      data: {
        userId: plan.class.userId,
        title: next.label,
        category: Category.SCHOOL,
        dueDate: d,
        schoolWork: {
          create: {
            type: next.type as SchoolWorkType,
            subject: plan.class.subject?.name ?? null,
            classId: plan.class.id,
            dateSpecific: isTest,
            startDate: isTest ? null : d,
          },
        },
      },
      select: { schoolWork: { select: { id: true } } },
    });
    await tx.classPlanUnit.update({
      where: { id: next.id },
      data: { workId: created.schoolWork!.id, scheduledDate: d },
    });
  });
}

/** After a plan unit's task is completed or reopened: if its plan is paused,
 *  bring up the next item (due the class day after today) or, on a reopen, put
 *  the reopened one back as the only open item. */
export async function afterPlanUnitChange(planId: string): Promise<void> {
  const today = todayISO();
  await ensurePausedNext(planId, { today, createFrom: addDays(today, 1) });
}

let rolledFor = "";
let rolling: Promise<void> | null = null;

/**
 * Once a day per process, before anything reads school work: move each paused
 * plan's open item that's now in the past to the next class day, so a paused
 * class never shows as late. Cheap to call from every loader.
 */
export async function rollPausedPlans(): Promise<void> {
  const today = todayISO();
  if (rolledFor === today) return;
  if (rolling) return rolling;
  rolling = (async () => {
    const plans = await prisma.classPlan.findMany({
      where: {
        paused: true,
        status: "PUBLISHED",
        units: { some: { done: false, work: { task: { status: "PENDING", dueDate: { lt: toDateColumn(today) } } } } },
      },
      select: { id: true },
    });
    if (plans.length) {
      const holidays = await allNoSchoolDays();
      for (const p of plans) await ensurePausedNext(p.id, { today, holidays });
    }
    rolledFor = today;
  })().finally(() => {
    rolling = null;
  });
  return rolling;
}

/** Forget today's roll (pause/resume changes what there is to roll; tests). */
export function resetPausedRoll(): void {
  rolledFor = "";
}
