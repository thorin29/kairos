import { Category, TaskStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { fromDateColumn, toDateColumn } from "@/lib/dates";
import { isStale, loadStaleContext } from "@/lib/chores/stale";

export type CategorySummary = {
  category: Category;
  total: number;
  complete: number;
  overdue: number;
  /** null when nothing is assigned — renders neutral, not failing. */
  percent: number | null;
};

export type PersonSummary = {
  id: string;
  name: string;
  color: string;
  avatarPath: string | null;
  role: string;
  categories: CategorySummary[];
  total: number;
  complete: number;
  overdue: number;
  percent: number | null;
};

/**
 * A day's tasks are everything due that day plus anything still pending
 * from an earlier day. Overdue work is never rewritten to a new date, so
 * the original due date survives for reporting.
 */
export async function loadDay(dayISO: string): Promise<PersonSummary[]> {
  const day = toDateColumn(dayISO);
  const stale = await loadStaleContext(dayISO);

  const [people, allTasks] = await Promise.all([
    prisma.user.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.task.findMany({
      where: {
        OR: [
          { dueDate: day },
          { dueDate: { lt: day }, status: TaskStatus.PENDING },
        ],
      },
      select: {
        userId: true,
        category: true,
        status: true,
        dueDate: true,
        choreId: true,
        isOpen: true,
      },
    }),
  ]);

  // Expired chores are no longer actionable, so they drop out of today's
  // numbers entirely rather than dragging the percentage down forever. The
  // rows survive against their original due date for weekly reporting.
  // Released chores belong to nobody right now, so they sit out of everyone's
  // score until someone claims them.
  const tasks = allTasks.filter(
    (t) => !t.isOpen && !isStale(t, dayISO, stale),
  );

  return people.map((person) => {
    const mine = tasks.filter((t) => t.userId === person.id);

    const categories = Object.values(Category).map((category) => {
      const inCat = mine.filter((t) => t.category === category);
      // Skipped tasks are excused: out of both numerator and denominator.
      const counted = inCat.filter((t) => t.status !== TaskStatus.SKIPPED);
      const complete = counted.filter(
        (t) => t.status === TaskStatus.COMPLETE,
      ).length;
      const overdue = counted.filter(
        (t) => t.status === TaskStatus.PENDING && t.dueDate < day,
      ).length;

      return {
        category,
        total: counted.length,
        complete,
        overdue,
        percent: counted.length
          ? Math.round((complete / counted.length) * 100)
          : null,
      };
    });

    const total = categories.reduce((n, c) => n + c.total, 0);
    const complete = categories.reduce((n, c) => n + c.complete, 0);
    const overdue = categories.reduce((n, c) => n + c.overdue, 0);

    return {
      id: person.id,
      name: person.displayName ?? person.name,
      color: person.color,
      avatarPath: person.avatarPath,
      role: person.role,
      categories: categories.filter((c) => c.total > 0),
      total,
      complete,
      overdue,
      percent: total ? Math.round((complete / total) * 100) : null,
    };
  });
}

export type OpenTask = {
  id: string;
  title: string;
  category: string;
  dueDateISO: string;
  isOverdue: boolean;
  releasedByName: string;
  /** Shared chores were never anyone's, so they read differently. */
  isShared: boolean;
};

/** Chores handed back to the household and waiting for someone to claim. */
export async function loadOpenTasks(dayISO: string): Promise<OpenTask[]> {
  const stale = await loadStaleContext(dayISO);
  const day = toDateColumn(dayISO);

  const rows = await prisma.task.findMany({
    where: {
      isOpen: true,
      status: TaskStatus.PENDING,
      dueDate: { lte: day },
    },
    orderBy: [{ dueDate: "asc" }, { sortOrder: "asc" }],
    include: {
      user: { select: { name: true, displayName: true } },
      chore: { select: { isPool: true, intervalDays: true } },
    },
  });

  return rows
    .filter((t) => !isStale(t, dayISO, stale))
    .map((t) => ({
      id: t.id,
      title: t.title,
      category: t.category as string,
      dueDateISO: fromDateColumn(t.dueDate),
      isOverdue: fromDateColumn(t.dueDate) < dayISO,
      releasedByName: t.user.displayName ?? t.user.name,
      isShared: Boolean(t.chore?.isPool),
    }));
}

/** Full task rows for one person on one day, overdue items first. */
export async function loadPersonDay(userId: string, dayISO: string) {
  const day = toDateColumn(dayISO);
  const stale = await loadStaleContext(dayISO);

  const rows = await prisma.task.findMany({
    where: {
      userId,
      isOpen: false,
      OR: [
        { dueDate: day },
        { dueDate: { lt: day }, status: TaskStatus.PENDING },
      ],
    },
    orderBy: [{ dueDate: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
  });

  return rows.map((t) => ({ ...t, stale: isStale(t, dayISO, stale) }));
}
