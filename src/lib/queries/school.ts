import "server-only";
import { prisma } from "@/lib/prisma";
import { fromDateColumn, todayISO } from "@/lib/dates";
import type { SchoolWorkType } from "@/generated/prisma/client";

export type SchoolItem = {
  id: string;
  title: string;
  type: SchoolWorkType;
  subject: string | null;
  dueISO: string;
  status: string;
  overdue: boolean;
};

export type PersonSchool = {
  id: string;
  name: string;
  color: string;
  avatarPath: string | null;
  pending: number;
  overdue: number;
  items: SchoolItem[];
};

/**
 * Everyone's active (not-yet-done) school work for the admin page, newest due
 * first, so a parent can see and manage assignments and tests across the house.
 */
export async function loadSchoolAdmin(): Promise<PersonSchool[]> {
  const today = todayISO();

  const [people, tasks] = await Promise.all([
    prisma.user.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        name: true,
        displayName: true,
        color: true,
        avatarPath: true,
      },
    }),
    prisma.task.findMany({
      where: {
        category: "SCHOOL",
        status: { not: "COMPLETE" },
        schoolWork: { isNot: null },
      },
      orderBy: [{ dueDate: "asc" }],
      select: {
        id: true,
        userId: true,
        title: true,
        dueDate: true,
        status: true,
        schoolWork: { select: { type: true, subject: true } },
      },
    }),
  ]);

  const byUser = new Map<string, SchoolItem[]>();
  for (const t of tasks) {
    if (!t.schoolWork) continue;
    const dueISO = fromDateColumn(t.dueDate);
    const item: SchoolItem = {
      id: t.id,
      title: t.title,
      type: t.schoolWork.type,
      subject: t.schoolWork.subject,
      dueISO,
      status: t.status as string,
      overdue: dueISO < today,
    };
    const list = byUser.get(t.userId) ?? [];
    list.push(item);
    byUser.set(t.userId, list);
  }

  return people.map((p) => {
    const items = byUser.get(p.id) ?? [];
    return {
      id: p.id,
      name: p.displayName ?? p.name,
      color: p.color,
      avatarPath: p.avatarPath,
      pending: items.length,
      overdue: items.filter((i) => i.overdue).length,
      items,
    };
  });
}
