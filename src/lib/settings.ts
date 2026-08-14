import "server-only";
import { prisma } from "@/lib/prisma";
import { DEFAULT_FAMILY_COLOR } from "@/lib/palette";

export const SCORING_START = "scoringStart";
export const FAMILY_COLOR = "familyColor";
export const CAL_NOW_COLOR = "calendar.nowColor";
export const CAL_RESET_SEC = "calendar.scrollResetSec";
export const CAL_BLOCK_MINUTES = "calendar.blockMinutes";
export const WORKOUT_OVERDUE_DAYS = "workout.overdueDays";
export const SCHOOL_ROLLOVER_INTERVAL = "school.rolloverIntervalDays";
export const SCHOOL_ROLLOVER_SNOOZE = "school.rolloverSnoozeUntil";
export const BIBLE_BONUS_CENTS = "money.bibleBonusCents";
export const BIBLE_GRACE_DAYS = "money.bibleGraceDays";
export const BIBLE_GRACE_DEFAULT = 3;
export const BIBLE_GRACE_MAX = 31;
export const ROLLOVER_INTERVAL_DEFAULT = 7;
export const ROLLOVER_INTERVAL_MAX = 90;

/** Longest a workout prompt can stay overdue before it expires. */
export const WORKOUT_OVERDUE_MAX = 6;
export const WORKOUT_OVERDUE_DEFAULT = 6;

// Season length. "month" follows the calendar month (the original behaviour);
// "weeks" runs fixed N-week seasons from an anchor date, so a household with a
// lighter workload can run longer seasons to reach a fuller ladder.
export const SEASON_MODE = "season.mode";
export const SEASON_WEEKS = "season.weeks";
export const SEASON_ANCHOR = "season.anchor";
export const SEASON_WEEKS_DEFAULT = 4;
export const SEASON_WEEKS_MAX = 26;

// The season tier every child must reach for the family co-op reward to unlock.
export const SEASON_COOP_FLOOR = "season.coopFloor";
export const SEASON_COOP_FLOOR_DEFAULT = 6;

export async function getCoopFloor(): Promise<number> {
  const raw = await getSetting(SEASON_COOP_FLOOR);
  const n = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(n)) return SEASON_COOP_FLOOR_DEFAULT;
  return Math.min(10, Math.max(1, n));
}

export type CalendarPrefs = {
  nowColor: string;
  scrollResetSec: number;
  blockMinutes: number;
};

/** Now-line colour, the inactivity reset for manual scrolling, and the default
 *  length of the block a tap/click drops on the grid. */
export async function getCalendarPrefs(): Promise<CalendarPrefs> {
  const [c, r, b] = await Promise.all([
    getSetting(CAL_NOW_COLOR),
    getSetting(CAL_RESET_SEC),
    getSetting(CAL_BLOCK_MINUTES),
  ]);
  const sec = r != null ? parseInt(r, 10) : 60;
  const block = b != null ? parseInt(b, 10) : 30;
  return {
    nowColor: c ?? "#ef4444",
    scrollResetSec: Number.isFinite(sec) ? sec : 60,
    blockMinutes: Number.isFinite(block) && block > 0 ? block : 30,
  };
}

/**
 * How many days a workout prompt keeps showing as overdue before it expires
 * (greys out, stops counting, drops off "Carried over"). Clamped to
 * 0..WORKOUT_OVERDUE_MAX; the max is the day before the same weekday's workout
 * comes round again, so at the top of the range a missed workout lives exactly
 * until it's due again — pure succession. Defaults to that top value.
 */
export async function getWorkoutOverdueDays(): Promise<number> {
  const row = await prisma.appSetting.findUnique({
    where: { key: WORKOUT_OVERDUE_DAYS },
  });
  if (row?.value == null) return WORKOUT_OVERDUE_DEFAULT;
  const n = parseInt(row.value, 10);
  if (!Number.isFinite(n)) return WORKOUT_OVERDUE_DEFAULT;
  return Math.max(0, Math.min(WORKOUT_OVERDUE_MAX, n));
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

/** How often the "start a new semester" reminder resurfaces once a term has
 *  ended and nothing newer is set up. Clamped to a sane range. */
export async function getRolloverIntervalDays(): Promise<number> {
  const raw = await getSetting(SCHOOL_ROLLOVER_INTERVAL);
  const n = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(n)) return ROLLOVER_INTERVAL_DEFAULT;
  return Math.min(ROLLOVER_INTERVAL_MAX, Math.max(1, n));
}

/** The household-wide group-completion bonus (whole cents) added on top of
 *  each person's base Bible reward when everyone opted-in finishes within
 *  grace. */
export async function getBibleBonusCents(): Promise<number> {
  const raw = await getSetting(BIBLE_BONUS_CENTS);
  const n = Number.parseInt(raw ?? "", 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/** Days after a month ends during which finishing still counts toward the
 *  group bonus. Clamped to a sane range. */
export async function getBibleGraceDays(): Promise<number> {
  const raw = await getSetting(BIBLE_GRACE_DAYS);
  const n = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(n)) return BIBLE_GRACE_DEFAULT;
  return Math.min(BIBLE_GRACE_MAX, Math.max(0, n));
}

export type SeasonConfig = {
  mode: "month" | "weeks";
  weeks: number;
  anchor: string | null;
};

/** How long a season runs. Defaults to the calendar month. */
export async function getSeasonConfig(): Promise<SeasonConfig> {
  const [modeRaw, weeksRaw, anchor] = await Promise.all([
    getSetting(SEASON_MODE),
    getSetting(SEASON_WEEKS),
    getSetting(SEASON_ANCHOR),
  ]);
  const mode = modeRaw === "weeks" ? "weeks" : "month";
  let weeks = Number.parseInt(weeksRaw ?? "", 10);
  if (!Number.isFinite(weeks)) weeks = SEASON_WEEKS_DEFAULT;
  weeks = Math.min(SEASON_WEEKS_MAX, Math.max(1, weeks));
  return { mode, weeks, anchor: anchor ?? null };
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
