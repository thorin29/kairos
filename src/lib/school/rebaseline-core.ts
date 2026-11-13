import "server-only";
// Re-baseline behind-schedule curriculum plans (v0.701). The database side of
// rebaseline.ts: loads every published plan, works out what a restart would do,
// and writes it. No auth here — the admin action (actions/class-plans.ts)
// guards it. Kept out of the "use server" module so these aren't callable as
// actions on their own (v0.699).
import { prisma } from "@/lib/prisma";
import { Category, Prisma, SchoolWorkType } from "@/generated/prisma/client";
import { todayISO, toDateColumn } from "@/lib/dates";
import { noSchoolDaysFor } from "@/lib/school/school-days";
import { rebaselinePlan, type RebaselineResult, type RebaselineUnit } from "@/lib/school/rebaseline";

function dISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export type RebaselineClass = {
  planId: string;
  className: string;
  /** "late": nothing overdue, but set to finish after its deadline. */
  status: RebaselineResult["status"] | "late";
  overdue: number;
  deadline: string | null;
  currentFinish: string | null;
  newFinish: string | null;
};

export type RebaselineStudent = {
  userId: string;
  name: string;
  /** Classes with overdue work (ready or past the deadline) or set to finish
   *  after their deadline, by name. */
  behind: RebaselineClass[];
  /** Overdue items across the ready classes. */
  overdue: number;
  /** When the ready classes restart (the earliest first date). */
  firstDate: string | null;
};

const planSelect = {
  id: true,
  perDay: true,
  weekdays: true,
  fitToTerm: true,
  bothTerms: true,
  class: {
    select: {
      id: true,
      name: true,
      userId: true,
      termId: true,
      user: { select: { name: true, sortOrder: true } },
      subject: { select: { name: true } },
    },
  },
  units: {
    orderBy: { seq: "asc" },
    select: {
      id: true,
      seq: true,
      label: true,
      type: true,
      load: true,
      done: true,
      scheduledDate: true,
      workId: true,
      work: {
        select: {
          id: true,
          task: { select: { id: true, status: true, dueDate: true, originalDueDate: true } },
        },
      },
    },
  },
} satisfies Prisma.ClassPlanSelect;

type LoadedPlan = Prisma.ClassPlanGetPayload<{ select: typeof planSelect }>;
type Worked = { plan: LoadedPlan; result: RebaselineResult };

/** Every published plan (one student's, or everyone's) with what a restart from
 *  the next school day would do to it. */
async function workOut(
  userId: string | null,
  today: string,
  only?: { planId: string; force: boolean },
): Promise<Worked[]> {
  const [plans, allTerms] = await Promise.all([
    prisma.classPlan.findMany({
      // Paused plans have no schedule to restart (v0.702); Resume handles them.
      where: only
        ? { id: only.planId, status: "PUBLISHED" }
        : { status: "PUBLISHED", paused: false, ...(userId ? { class: { userId } } : {}) },
      select: planSelect,
    }),
    prisma.term.findMany({
      orderBy: { startDate: "asc" },
      select: { id: true, startDate: true, endDate: true },
    }),
  ]);
  const wins = allTerms.map((t) => ({ id: t.id, start: dISO(t.startDate), end: dISO(t.endDate) }));
  // One no-school set over every term covers every plan's own windows.
  const holidays = wins.length ? await noSchoolDaysFor(wins) : new Set<string>();

  return plans.map((plan) => {
    const terms = (plan.bothTerms ? wins : wins.filter((w) => w.id === plan.class.termId)).map((w) => ({
      start: w.start,
      end: w.end,
    }));
    const units: RebaselineUnit[] = plan.units.map((u) => ({
      id: u.id,
      seq: u.seq,
      type: u.type as RebaselineUnit["type"],
      load: u.load,
      done: u.done || u.work?.task?.status === "COMPLETE",
      skipped: u.work?.task?.status === "SKIPPED",
      scheduledDate: u.scheduledDate ? dISO(u.scheduledDate) : null,
    }));
    const result = rebaselinePlan(units, {
      today,
      weekdays: plan.weekdays.split("").map(Number),
      perDay: plan.perDay,
      fitToTerm: plan.fitToTerm,
      terms,
      holidays,
      force: only?.force ?? false,
    });
    return { plan, result };
  });
}

/** Per student with published plans: which classes are behind and what a
 *  re-baseline would do. Feeds the Catch up section on Curriculum & schedule. */
export async function loadRebaselinePreview(): Promise<RebaselineStudent[]> {
  const worked = await workOut(null, todayISO());
  const byUser = new Map<string, RebaselineStudent & { sort: number }>();
  for (const { plan, result } of worked) {
    const u = plan.class;
    let s = byUser.get(u.userId);
    if (!s) {
      s = { userId: u.userId, name: u.user.name, behind: [], overdue: 0, firstDate: null, sort: u.user.sortOrder };
      byUser.set(u.userId, s);
    }
    // On schedule but set to finish after the deadline: nothing to restart, but
    // shown locked so every late class is in one place.
    const late =
      result.status === "onSchedule" &&
      result.currentFinish != null &&
      result.deadline != null &&
      result.currentFinish > result.deadline;
    if (result.status !== "ready" && result.status !== "pastDeadline" && !late) continue;
    s.behind.push({
      planId: plan.id,
      className: u.name,
      status: late ? "late" : result.status,
      overdue: result.overdue,
      deadline: result.deadline,
      currentFinish: result.currentFinish,
      newFinish: result.newFinish,
    });
    if (result.status === "ready") {
      s.overdue += result.overdue;
      if (result.firstDate && (!s.firstDate || result.firstDate < s.firstDate)) s.firstDate = result.firstDate;
    }
  }
  return [...byUser.values()]
    .sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name))
    .map(({ sort: _sort, ...s }) => ({ ...s, behind: s.behind.sort((a, b) => a.className.localeCompare(b.className)) }));
}

export type RebaselineOutcome = { classes: number; items: number; userIds: string[] };

/** Restart every ready plan (one student's, or everyone's) from the next school
 *  day. Worked out afresh here, so a stale preview can't move the wrong things;
 *  plans past their deadline or on schedule are left alone. */
export async function applyRebaseline(userId: string | null): Promise<RebaselineOutcome> {
  const today = todayISO();
  const worked = await workOut(userId, today);
  let classes = 0;
  let items = 0;
  const users = new Set<string>();

  for (const { plan, result } of worked) {
    // Done tasks whose unit flag never caught up: fix the flag while we're here,
    // so every admin screen agrees on what's finished.
    const stale = plan.units.filter((u) => !u.done && u.work?.task?.status === "COMPLETE").map((u) => u.id);
    if (stale.length) {
      await prisma.classPlanUnit.updateMany({ where: { id: { in: stale } }, data: { done: true } });
    }
    if (result.status !== "ready") continue;

    const moved = await applyMoves(plan, result.moves);
    classes += 1;
    items += moved;
    users.add(plan.class.userId);
  }
  return { classes, items, userIds: [...users] };
}

/** Write a plan's new dates: the task's due date (first planned date kept in
 *  originalDueDate), the school work's start date (null for tests) and the
 *  unit's scheduled date, creating work for any unit that never had it. */
async function applyMoves(plan: LoadedPlan, moves: { id: string; date: string }[]): Promise<number> {
  const byId = new Map(plan.units.map((u) => [u.id, u]));
  const subject = plan.class.subject?.name ?? null;
  let moved = 0;
  await prisma.$transaction(
    async (tx: Prisma.TransactionClient) => {
      for (const m of moves) {
        const unit = byId.get(m.id);
        if (!unit) continue;
        const date = toDateColumn(m.date);
        const isTest = unit.type === "TEST";
        const task = unit.work?.task;
        if (unit.work && task) {
          if (dISO(task.dueDate) === m.date && unit.scheduledDate && dISO(unit.scheduledDate) === m.date) continue;
          // Keep where it was FIRST planned (as "do some extra work" does), so a
          // lesson reads "moved from …" rather than losing its history.
          await tx.task.update({
            where: { id: task.id },
            data: { dueDate: date, originalDueDate: task.originalDueDate ?? task.dueDate },
          });
          await tx.schoolWork.update({ where: { id: unit.work.id }, data: { startDate: isTest ? null : date } });
        } else {
          // An item that never got its work (it didn't fit before) — create it.
          const created = await tx.task.create({
            data: {
              userId: plan.class.userId,
              title: unit.label,
              category: Category.SCHOOL,
              dueDate: date,
              schoolWork: {
                create: {
                  type: unit.type as SchoolWorkType,
                  subject,
                  classId: plan.class.id,
                  dateSpecific: isTest,
                  startDate: isTest ? null : date,
                },
              },
            },
            select: { schoolWork: { select: { id: true } } },
          });
          await tx.classPlanUnit.update({ where: { id: unit.id }, data: { workId: created.schoolWork!.id } });
        }
        await tx.classPlanUnit.update({ where: { id: unit.id }, data: { scheduledDate: date } });
        moved += 1;
      }
    },
    { timeout: 60_000 },
  );
  return moved;
}

/** Resume a paused plan (v0.702): lay out every undone unit from the next school
 *  day at the plan's own pace (re-fit if it's fit to term), even if that runs
 *  past the deadline. The caller clears the paused flag first. */
export async function resumePlanSchedule(planId: string): Promise<void> {
  const [w] = await workOut(null, todayISO(), { planId, force: true });
  if (w && w.result.status === "ready") await applyMoves(w.plan, w.result.moves);
}
