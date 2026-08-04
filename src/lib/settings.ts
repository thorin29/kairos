import "server-only";
import { prisma } from "@/lib/prisma";
import { DEFAULT_FAMILY_COLOR } from "@/lib/palette";

export const SCORING_START = "scoringStart";
export const FAMILY_COLOR = "familyColor";
export const CAL_NOW_COLOR = "calendar.nowColor";
export const CAL_RESET_SEC = "calendar.scrollResetSec";
export const CAL_ALLDAY_WASH = "calendar.allDayWash";

export type CalendarPrefs = {
  nowColor: string;
  scrollResetSec: number;
  allDayWash: boolean;
};

/** Now-line colour, the inactivity reset for manual scrolling, and whether an
 * all-day event tints its whole day column. */
export async function getCalendarPrefs(): Promise<CalendarPrefs> {
  const [c, r, w] = await Promise.all([
    getSetting(CAL_NOW_COLOR),
    getSetting(CAL_RESET_SEC),
    getSetting(CAL_ALLDAY_WASH),
  ]);
  const sec = r != null ? parseInt(r, 10) : 60;
  return {
    nowColor: c ?? "#ef4444",
    scrollResetSec: Number.isFinite(sec) ? sec : 60,
    // Unset means on — the wash shipped before the toggle existed.
    allDayWash: w == null ? true : w === "1",
  };
}

/** Read any stored setting by key. */
export async function getSetting(key: string): Promise<string | null> {
  const row = await prisma.appSetting.findUnique({ where: { key } });
  return row?.value ?? null;
}

/** The colour of the shared Family calendar identity (birthdays, etc.). */
export async function getFamilyColor(): Promise<string> {
  const row = await prisma.appSetting.findUnique({
    where: { key: FAMILY_COLOR },
  });
  return row?.value ?? DEFAULT_FAMILY_COLOR;
}

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
