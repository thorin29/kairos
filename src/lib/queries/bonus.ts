import "server-only";
import { TaskStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { toDateColumn, todayISO, fromDateColumn } from "@/lib/dates";
import { getScoringStart } from "@/lib/settings";
import { taskEffort } from "@/lib/scoring/weights";
import { computeTaskBonus, roundBonus } from "@/lib/scoring/bonus";

export type PersonBonus = {
  total: number;
  ahead: number;
  prompt: number;
};

/**
 * Initiative bonus points earned within a window, per person. Unlike the
 * fairness base — which counts by the day work was *due* — bonuses count by
 * the day work was *done*, so getting ahead on next week's chore rewards you
 * this week. Floored at the scoring-start line like everything else, so a
 * reset clears it too.
 */
export async function loadBonuses(
  fromISO: string,
  toISO: string,
): Promise<Map<string, PersonBonus>> {
  const startISO = await getScoringStart();
  const effectiveFrom = startISO && startISO > fromISO ? startISO : fromISO;
  const out = new Map<string, PersonBonus>();
  if (effectiveFrom > toISO) return out;

  // completedAt is a timestamp; widen the UTC window by a day either side and
  // then filter on the household-local completion date so a late-evening
  // finish lands on the right day.
  const lo = new Date(toDateColumn(effectiveFrom).getTime() - 86_400_000);
  const hi = new Date(toDateColumn(toISO).getTime() + 2 * 86_400_000);

  const rows = await prisma.task.findMany({
    where: {
      status: TaskStatus.COMPLETE,
      completedAt: { gte: lo, lt: hi },
    },
    select: {
      userId: true,
      dueDate: true,
      completedAt: true,
      weight: true,
      choreId: true,
      chore: { select: { effort: true, isPool: true, isAnytime: true } },
    },
  });

  for (const t of rows) {
    if (!t.completedAt) continue;
    const completionISO = todayISO(t.completedAt);
    if (completionISO < effectiveFrom || completionISO > toISO) continue;

    const bonus = computeTaskBonus({
      effort: taskEffort({
        choreEffort: t.chore?.effort ?? null,
        taskWeight: t.weight,
      }),
      isPool: t.chore?.isPool ?? false,
      isAnytime: t.chore?.isAnytime ?? false,
      hasChore: t.choreId != null,
      dueISO: fromDateColumn(t.dueDate),
      completionISO,
    });
    if (!bonus) continue;

    const row = out.get(t.userId) ?? { total: 0, ahead: 0, prompt: 0 };
    row.total += bonus.points;
    if (bonus.kind === "ahead") row.ahead += bonus.points;
    else row.prompt += bonus.points;
    out.set(t.userId, row);
  }

  // Round once, at the end, so summed thirds don't show a long tail.
  for (const [id, r] of out) {
    out.set(id, {
      total: roundBonus(r.total),
      ahead: roundBonus(r.ahead),
      prompt: roundBonus(r.prompt),
    });
  }
  return out;
}
