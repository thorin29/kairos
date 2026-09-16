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
 * and ordered by date. Future items only — today's and overdue work is just
 * today's work. Window items (lessons/assignments) are always eligible; a
 * date-specific item (a quiz/test) is eligible when it comes from a published
 * class plan, since those courses are self-paced. A standalone, hand-added
 * test keeps a fixed date and is excluded.
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
      schoolWork: {
        is: { OR: [{ dateSpecific: false }, { planUnit: { isNot: null } }] },
      },
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
