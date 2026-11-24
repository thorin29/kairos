import "server-only";
import { prisma } from "@/lib/prisma";
import { toDateColumn } from "@/lib/dates";

/** How many walks, runs, rucks and hikes tracked in the app (v0.777) a day
 *  holds: each is a workout of its own. */
export async function trackedCount(userId: string, dateISO: string): Promise<number> {
  return (await prisma.workoutTrack.count({
    where: { userId, session: { date: toDateColumn(dateISO), isRest: false } },
  })) as number;
}
