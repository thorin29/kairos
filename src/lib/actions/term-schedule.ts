"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { toDateColumn } from "@/lib/dates";

export type TermMove = {
  unitId: string;
  workId: string;
  taskId: string;
  isTest: boolean;
  date: string; // YYYY-MM-DD
};

export type PublishTermResult = { error: string | null; updated: number };

/** Apply a term's redistributed schedule: write each moved item's new date back
 *  to its plan unit, its Task (the due date on the card), and — for window items
 *  (not tests) — the SchoolWork start date. Only the items that actually moved
 *  are passed in. The work is already on the cards from class-publish; this just
 *  shifts the dates. */
export async function publishTermSchedule(input: {
  termId: string;
  studentId: string;
  moves: TermMove[];
}): Promise<PublishTermResult> {
  await requireAdmin();

  const moves = input.moves.filter((m) => /^\d{4}-\d{2}-\d{2}$/.test(m.date));
  if (moves.length === 0) return { error: null, updated: 0 };

  await prisma.$transaction(async (tx) => {
    for (const m of moves) {
      const d = toDateColumn(m.date);
      await tx.classPlanUnit.update({ where: { id: m.unitId }, data: { scheduledDate: d } });
      await tx.task.update({ where: { id: m.taskId }, data: { dueDate: d } });
      if (!m.isTest) {
        await tx.schoolWork.update({ where: { id: m.workId }, data: { startDate: d } });
      }
    }
  });

  revalidatePath("/");
  revalidatePath(`/person/${input.studentId}`);
  revalidatePath("/admin/school");
  revalidatePath(`/admin/school/term/${input.termId}/${input.studentId}`);
  return { error: null, updated: moves.length };
}
