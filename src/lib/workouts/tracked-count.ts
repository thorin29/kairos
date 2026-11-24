import "server-only";
import { prisma } from "@/lib/prisma";
import { toDateColumn } from "@/lib/dates";

/** How many walks, runs, rucks and hikes tracked in the app (v0.777) and
 *  backpacking trip days logged (v0.778) a day holds: each is a workout of
 *  its own. */
export async function trackedCount(userId: string, dateISO: string): Promise<number> {
  const date = toDateColumn(dateISO);
  const [tracked, backpack] = (await Promise.all([
    prisma.workoutTrack.count({ where: { userId, session: { date, isRest: false } } }),
    prisma.backpackDay.count({ where: { userId, date, status: "logged", sessionId: { not: null } } }),
  ])) as [number, number];
  return tracked + backpack;
}
