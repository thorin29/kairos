import { TaskStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { fromDateColumn, toDateColumn, todayISO } from "@/lib/dates";

export type AheadItem = { taskId: string; label: string; dueISO: string };
export type SchoolAheadSubject = { subject: string; items: AheadItem[] };

/** How many upcoming items to offer per subject in one sitting. Plenty for
 *  working ahead; more show up next time once these are done. */
const MAX_PER_SUBJECT = 30;

/**
 * A student's upcoming school work they can complete early, grouped by subject
 * and ordered by date. Only future window items (lessons/assignments) — today's
 * and overdue work is just today's work, and date-specific items (tests) aren't
 * something you do ahead of their day.
 */
export async function loadSchoolGetAhead(
  userId: string,
  dayISO: string = todayISO(),
): Promise<SchoolAheadSubject[]> {
  const rows = await prisma.task.findMany({
    where: {
      userId,
      category: "SCHOOL",
      status: TaskStatus.PENDING,
      dueDate: { gt: toDateColumn(dayISO) }, // strictly future
      schoolWork: { is: { dateSpecific: false } }, // window items only
    },
    orderBy: { dueDate: "asc" },
    select: {
      id: true,
      title: true,
      dueDate: true,
      schoolWork: { select: { subject: true, class: { select: { name: true } } } },
    },
  });

  const bySubject = new Map<string, AheadItem[]>();
  for (const t of rows) {
    const sw = t.schoolWork;
    if (!sw) continue;
    const subject = sw.class?.name ?? sw.subject ?? "School";
    const list = bySubject.get(subject) ?? [];
    if (list.length >= MAX_PER_SUBJECT) continue;
    list.push({ taskId: t.id, label: t.title, dueISO: fromDateColumn(t.dueDate) });
    bySubject.set(subject, list);
  }

  return [...bySubject.entries()]
    .map(([subject, items]) => ({ subject, items }))
    .sort((a, b) => a.subject.localeCompare(b.subject));
}
