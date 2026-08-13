import "server-only";
import { TaskStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { addDays, fromDateColumn, toDateColumn, todayISO } from "@/lib/dates";
import { GET_AHEAD_FACTOR, roundBonus } from "@/lib/scoring/bonus";

export type GetAheadChore = {
  taskId: string;
  title: string;
  dueDateISO: string;
  effort: number;
  bonus: number;
};

/** How far ahead to offer. The chore generator runs 14 days out, so a week is
 *  always populated. */
const HORIZON_DAYS = 7;

/**
 * Upcoming scheduled chores this person can knock out early for a small bonus.
 *
 * The gate keeps you from stealing someone else's turn: a chore is offered
 * only when you're the next one up for it — no live instance of the same chore
 * (anyone's) falls between today and your due date. Shared and "anytime"
 * chores are excluded (shared ones have their own promptness bonus; anytime
 * ones aren't early until their period closes), as is anything due today or
 * overdue — that's just today's work, not getting ahead.
 */
export async function loadGetAhead(
  userId: string,
  dayISO: string = todayISO(),
): Promise<GetAheadChore[]> {
  const horizon = addDays(dayISO, HORIZON_DAYS);

  // Every live instance of any scheduled chore across the window — needed both
  // for the candidates and to judge who's next up.
  const rows = await prisma.task.findMany({
    where: {
      choreId: { not: null },
      isOpen: false,
      status: TaskStatus.PENDING,
      dueDate: { gte: toDateColumn(dayISO), lte: toDateColumn(horizon) },
    },
    select: {
      id: true,
      userId: true,
      title: true,
      dueDate: true,
      choreId: true,
      chore: { select: { effort: true, isPool: true, isAnytime: true } },
    },
  });

  // Earliest live due date per chore (>= today), for the "next up" test.
  const earliestByChore = new Map<string, string>();
  for (const t of rows) {
    if (!t.choreId) continue;
    const due = fromDateColumn(t.dueDate);
    const cur = earliestByChore.get(t.choreId);
    if (!cur || due < cur) earliestByChore.set(t.choreId, due);
  }

  const out: GetAheadChore[] = [];
  for (const t of rows) {
    if (t.userId !== userId || !t.choreId) continue;
    if (t.chore?.isPool || t.chore?.isAnytime) continue;

    const due = fromDateColumn(t.dueDate);
    if (due <= dayISO) continue; // today's/overdue work isn't "ahead"

    // Next up only: nothing of this chore is due strictly before you.
    if (earliestByChore.get(t.choreId) !== due) continue;

    const effort = t.chore?.effort ?? 1;
    out.push({
      taskId: t.id,
      title: t.title,
      dueDateISO: due,
      effort,
      bonus: roundBonus(effort * GET_AHEAD_FACTOR),
    });
  }

  out.sort((a, b) => (a.dueDateISO < b.dueDateISO ? -1 : 1));
  return out;
}
