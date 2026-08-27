"use server";

import { prisma } from "@/lib/prisma";
import { requireInteractive, requireCanActFor } from "@/lib/gate";
import { toDateColumn } from "@/lib/dates";

export type DayLogItem = {
  title: string;
  category: string;
  done: boolean;
  skipped: boolean;
};

/** What a person actually did (and didn't) on a given day — for the summary
 *  card popup. Read-only. */
export async function personDayLog(
  userId: string,
  dayISO: string,
): Promise<{ items: DayLogItem[]; doneCount: number; assigned: number }> {
  await requireInteractive();
  await requireCanActFor(userId);
  if (!userId || !/^\d{4}-\d{2}-\d{2}$/.test(dayISO)) {
    return { items: [], doneCount: 0, assigned: 0 };
  }

  const rows = await prisma.task.findMany({
    where: { userId, isOpen: false, dueDate: toDateColumn(dayISO) },
    orderBy: [{ category: "asc" }, { title: "asc" }],
    select: { title: true, category: true, status: true },
  });

  const items: DayLogItem[] = rows.map((t) => ({
    title: t.title,
    category: t.category as string,
    done: t.status === "COMPLETE",
    skipped: t.status === "SKIPPED",
  }));

  const assigned = items.filter((i) => !i.skipped).length;
  const doneCount = items.filter((i) => i.done).length;
  return { items, doneCount, assigned };
}
