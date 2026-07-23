import { Category, TaskStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { toDateColumn } from "@/lib/dates";

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

  const [people, tasks] = await Promise.all([
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
      select: { userId: true, category: true, status: true, dueDate: true },
    }),
  ]);

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
      role: person.role,
      categories: categories.filter((c) => c.total > 0),
      total,
      complete,
      overdue,
      percent: total ? Math.round((complete / total) * 100) : null,
    };
  });
}

/** Full task rows for one person on one day, overdue items first. */
export async function loadPersonDay(userId: string, dayISO: string) {
  const day = toDateColumn(dayISO);

  return prisma.task.findMany({
    where: {
      userId,
      OR: [
        { dueDate: day },
        { dueDate: { lt: day }, status: TaskStatus.PENDING },
      ],
    },
    orderBy: [{ dueDate: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
  });
}
