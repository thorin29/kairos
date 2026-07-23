import "server-only";
import { prisma } from "@/lib/prisma";

export const SCORING_START = "scoringStart";

/**
 * Scores count only from this day forward. Nothing is deleted when it moves
 * — the tasks and their history stay intact, they just stop counting. That
 * makes it safe to run a long testing period and then start everyone even.
 */
export async function getScoringStart(): Promise<string | null> {
  const row = await prisma.appSetting.findUnique({
    where: { key: SCORING_START },
  });
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await prisma.appSetting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}

export async function clearSetting(key: string): Promise<void> {
  await prisma.appSetting.deleteMany({ where: { key } });
}
