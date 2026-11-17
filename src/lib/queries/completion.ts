import "server-only";
import { prisma } from "@/lib/prisma";
import { addDays, fromDateColumn, toDateColumn, todayISO } from "@/lib/dates";

/**
 * The Summary page's completion grid (v0.733): each person's share of what
 * was due, day by day.
 *
 * A day counts what was due that day and done by its deadline (the due date,
 * or an anytime chore's last day), plus anything finished that day that was
 * late from an earlier day. Late work counts on the day it was finished, not
 * the day it was due: the due day shows it as missed, the day it was done
 * gets it and a mark. Skipped work is excused, open (unclaimed) chores don't
 * count. Nothing due and nothing finished late: null, drawn as "nothing due".
 */

export type CompletionDay = {
  date: string;
  /** 0–100, or null with nothing due. */
  pct: number | null;
  done: number;
  due: number;
  /** Late work from an earlier day was finished this day. */
  late: boolean;
  /** After today: nothing to show yet. */
  future: boolean;
};

export type CompletionRow = {
  id: string;
  name: string;
  color: string;
  avatarPath: string | null;
  avatarPosition: string;
  days: CompletionDay[];
  /** The range's share, done ÷ due over every day up to today; null with none. */
  total: number | null;
};

/** The grid's filters: All, or one area. */
export const COMPLETION_FILTERS = [
  { key: "all", label: "All", categories: null },
  { key: "chores", label: "Chores", categories: ["CHORE"] },
  { key: "bible", label: "Bible", categories: ["BIBLE"] },
  { key: "school", label: "School", categories: ["SCHOOL"] },
  { key: "workouts", label: "Workouts", categories: ["EXERCISE"] },
] as const;
export type CompletionFilter = (typeof COMPLETION_FILTERS)[number]["key"];

export function completionFilter(raw: unknown): CompletionFilter {
  return COMPLETION_FILTERS.some((f) => f.key === raw) ? (raw as CompletionFilter) : "all";
}

type TaskRow = {
  id: string;
  userId: string;
  title: string;
  category: string;
  status: string;
  dueDate: Date;
  lateAfter: Date | null;
  completedAt: Date | null;
};

/** The day a task's last on-time day is (an anytime chore's end, else due). */
const deadlineOf = (t: TaskRow) => fromDateColumn(t.lateAfter ?? t.dueDate);
/** The household day it was finished, or null. */
const doneDayOf = (t: TaskRow) => (t.status === "COMPLETE" && t.completedAt ? todayISO(t.completedAt) : null);
/** Finished after its deadline: the day it was finished, else null. */
export function lateDoneDay(t: TaskRow): string | null {
  const d = doneDayOf(t);
  return d && d > deadlineOf(t) ? d : null;
}

/** Tasks due in [from, to], plus tasks finished in [from, to] that were due before. */
async function tasksFor(userIds: string[], from: string, to: string, categories: readonly string[] | null): Promise<TaskRow[]> {
  if (userIds.length === 0) return [];
  // completedAt is an instant; a day's span in any household zone is within ±1 day.
  const lo = new Date(`${addDays(from, -1)}T00:00:00Z`);
  const hi = new Date(`${addDays(to, 2)}T00:00:00Z`);
  const rows = (await prisma.task.findMany({
    where: {
      userId: { in: userIds },
      isOpen: false,
      status: { not: "SKIPPED" },
      ...(categories ? { category: { in: categories as never } } : {}),
      OR: [
        { dueDate: { gte: toDateColumn(from), lte: toDateColumn(to) } },
        { status: "COMPLETE", dueDate: { lt: toDateColumn(from) }, completedAt: { gte: lo, lt: hi } },
      ],
    },
    select: { id: true, userId: true, title: true, category: true, status: true, dueDate: true, lateAfter: true, completedAt: true },
  })) as TaskRow[];
  return rows;
}

/** One person's day from their tasks. */
function dayOf(tasks: TaskRow[], date: string, today: string): CompletionDay {
  if (date > today) return { date, pct: null, done: 0, due: 0, late: false, future: true };
  let due = 0;
  let done = 0;
  let late = false;
  for (const t of tasks) {
    const dueDay = fromDateColumn(t.dueDate);
    const lateOn = lateDoneDay(t);
    if (dueDay === date) {
      due++;
      if (doneDayOf(t) && !lateOn) done++;
    } else if (lateOn === date && dueDay < date) {
      // Late from an earlier day, finished today: it counts here.
      due++;
      done++;
      late = true;
    }
  }
  return { date, pct: due > 0 ? Math.round((done / due) * 100) : null, done, due, late, future: false };
}

/** Every listed person's days from `from` to `to`. */
export async function loadCompletion(
  people: { id: string; name: string; color: string; avatarPath: string | null; avatarPosition: string }[],
  from: string,
  to: string,
  filter: CompletionFilter = "all",
): Promise<CompletionRow[]> {
  const today = todayISO();
  const cats = COMPLETION_FILTERS.find((f) => f.key === filter)?.categories ?? null;
  const tasks = await tasksFor(
    people.map((p) => p.id),
    from,
    to,
    cats,
  );
  const dates: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) dates.push(d);
  return people.map((p) => {
    const mine = tasks.filter((t) => t.userId === p.id);
    const days = dates.map((d) => dayOf(mine, d, today));
    const due = days.reduce((n, d) => n + d.due, 0);
    const done = days.reduce((n, d) => n + d.done, 0);
    return { ...p, days, total: due > 0 ? Math.round((done / due) * 100) : null };
  });
}

/** Who the grid lists for a viewer (v0.733): a parent or the shared screen
 *  sees everyone; a child sees only themselves. */
export async function completionPeople(viewer: { id: string; kind: string | null } | null) {
  const all = (await prisma.user.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true, displayName: true, color: true, avatarPath: true, avatarPosition: true, kind: true },
  })) as {
    id: string;
    name: string;
    displayName: string | null;
    color: string;
    avatarPath: string | null;
    avatarPosition: string;
    kind: string | null;
  }[];
  const shown = !viewer || viewer.kind !== "CHILD" ? all : all.filter((u) => u.id === viewer.id);
  return shown.map((u) => ({
    id: u.id,
    name: u.displayName ?? u.name,
    color: u.color,
    avatarPath: u.avatarPath,
    avatarPosition: u.avatarPosition,
  }));
}

/** A person's day log (v0.733): what was due that day, done or not, with work
 *  finished later marked "done on", and late work from earlier days that was
 *  finished this day ("from"). */
export async function dayLogFor(
  userId: string,
  dayISO: string,
): Promise<{
  items: { title: string; category: string; done: boolean; skipped: boolean; doneOn?: string; from?: string }[];
  doneCount: number;
  assigned: number;
}> {
  const all = (await prisma.task.findMany({
    where: {
      userId,
      isOpen: false,
      OR: [
        { dueDate: toDateColumn(dayISO) },
        {
          status: "COMPLETE",
          dueDate: { lt: toDateColumn(dayISO) },
          completedAt: { gte: new Date(`${addDays(dayISO, -1)}T00:00:00Z`), lt: new Date(`${addDays(dayISO, 2)}T00:00:00Z`) },
        },
      ],
    },
    orderBy: [{ category: "asc" }, { title: "asc" }],
    select: { id: true, userId: true, title: true, category: true, status: true, dueDate: true, lateAfter: true, completedAt: true },
  })) as TaskRow[];
  const items: { title: string; category: string; done: boolean; skipped: boolean; doneOn?: string; from?: string }[] = [];
  for (const t of all) {
    const dueDay = fromDateColumn(t.dueDate);
    const lateOn = lateDoneDay(t);
    if (dueDay === dayISO) {
      items.push({
        title: t.title,
        category: t.category,
        done: t.status === "COMPLETE" && !lateOn,
        skipped: t.status === "SKIPPED",
        ...(lateOn ? { doneOn: lateOn } : {}),
      });
    } else if (lateOn === dayISO) {
      items.push({ title: t.title, category: t.category, done: true, skipped: false, from: dueDay });
    }
  }
  const counted = items.filter((i) => !i.skipped);
  return { items, doneCount: counted.filter((i) => i.done).length, assigned: counted.length };
}
