/**
 * Character growth: how much each day is worth, which companion it belongs to,
 * and what earned it. The one rule for the live read in progression, retiring
 * to the gallery, hatching, the family goal and the bar's colours.
 * docs/SCORING.md is the plain-language map of the whole system.
 *
 * Pure (no database) so it can be tested across whole histories.
 *
 * WHAT A DAY IS WORTH (v0.603)
 *   credit = effort finished / effort due that day, 0..1. Effort is the same
 *   weight as everywhere else (a chore its 1-5, anything else 1). A day with
 *   nothing due is worth nothing. Partial days count partly — before 0.603 a
 *   day counted only if EVERYTHING was done, which a long list almost never is.
 *   TODAY counts live: it rises as tasks are finished (and falls if one is
 *   unchecked or a new one lands today). Past days only rise (late finishes).
 *   A perfect WEEK (everything done) adds WEEK_GROWTH once it has ended.
 *
 * WHICH COMPANION IT BELONGS TO (v0.602)
 *   A day belongs to the companion active at its end: a tenure starts on the
 *   household day it was made active and counts that day; the companion it
 *   replaced banks only the SETTLED days before (never today — today moves
 *   with the new one). A perfect week belongs to whoever holds it when it ends:
 *   it counts if its last day is on or after the tenure's first day.
 *   No gaps, no overlaps: banked + live always equals everything earned.
 */

export type StatKey = "CHORE" | "EXERCISE" | "BIBLE" | "SCHOOL" | "TASK";
export const STAT_KEYS: StatKey[] = ["CHORE", "EXERCISE", "BIBLE", "SCHOOL", "TASK"];

export type DayBucket = {
  /** Task counts, for streaks and perfect days. */
  assigned: number;
  complete: number;
  missed: number;
  /** Effort due and effort finished — what a day's credit is made of. */
  effort: number;
  effortDone: number;
  /** Effort finished, by stat — what earned the day, for the bar's colours. */
  doneByStat: Record<StatKey, number>;
};
export type WeekBucket = { assigned: number; complete: number };

/** Growth points for a perfect week, on top of its days. */
export const WEEK_GROWTH = 2;

export function emptyDay(): DayBucket {
  return {
    assigned: 0,
    complete: 0,
    missed: 0,
    effort: 0,
    effortDone: 0,
    doneByStat: { CHORE: 0, EXERCISE: 0, BIBLE: 0, SCHOOL: 0, TASK: 0 },
  };
}

function addDaysISO(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** A day with everything due finished (streaks, "perfect"). */
export function isCleanDay(b: DayBucket): boolean {
  return b.assigned > 0 && b.missed === 0 && b.complete === b.assigned;
}

export function isPerfectWeek(b: WeekBucket): boolean {
  return b.assigned > 0 && b.complete === b.assigned;
}

/** What one day is worth: the share of its effort that got done, 0..1. */
export function dayCredit(b: DayBucket | undefined): number {
  if (!b || b.effort <= 0) return 0;
  return Math.max(0, Math.min(1, b.effortDone / b.effort));
}

type Range = { fromISO: string; today: string; includeToday: boolean };

function dayInRange(iso: string, r: Range): boolean {
  return iso >= r.fromISO && (iso < r.today || (r.includeToday && iso === r.today));
}

/**
 * Growth earned from `fromISO` (inclusive): each day's credit, plus
 * WEEK_GROWTH for each finished perfect week whose last day is on or after
 * `fromISO`. `includeToday` adds today's live credit — what the bar shows;
 * banking on retirement leaves it out, because today moves with the companion
 * that takes over.
 */
export function growthSince(
  days: Map<string, DayBucket>,
  weeks: Map<string, WeekBucket>,
  fromISO: string,
  today: string,
  includeToday = false,
): number {
  const r = { fromISO, today, includeToday };
  let g = 0;
  for (const [iso, b] of days) if (dayInRange(iso, r)) g += dayCredit(b);
  for (const [wkISO, b] of weeks) {
    const end = addDaysISO(wkISO, 6);
    if (end >= fromISO && end < today && isPerfectWeek(b)) g += WEEK_GROWTH;
  }
  return g;
}

/**
 * What earned the growth since `fromISO`, as shares by stat summing to 1 (all 0
 * when nothing has). Each day's credit is split by the effort finished in each
 * stat that day; a week bonus is split like the week's days.
 */
export function growthMix(
  days: Map<string, DayBucket>,
  fromISO: string,
  today: string,
  includeToday = true,
): Record<StatKey, number> {
  const r = { fromISO, today, includeToday };
  const mix: Record<StatKey, number> = { CHORE: 0, EXERCISE: 0, BIBLE: 0, SCHOOL: 0, TASK: 0 };
  for (const [iso, b] of days) {
    if (!dayInRange(iso, r) || b.effortDone <= 0) continue;
    const c = dayCredit(b);
    for (const k of STAT_KEYS) mix[k] += (c * b.doneByStat[k]) / b.effortDone;
  }
  const total = STAT_KEYS.reduce((n, k) => n + mix[k], 0);
  for (const k of STAT_KEYS) mix[k] = total > 0 ? mix[k] / total : 0;
  return mix;
}

/** Sum of day credits in [fromISO, toISO] up to today (today live): the family
 *  goal's "days" for one month. */
export function creditBetween(
  days: Map<string, DayBucket>,
  fromISO: string,
  toISO: string,
  today: string,
): number {
  let g = 0;
  for (const [iso, b] of days) if (iso >= fromISO && iso <= toISO && iso <= today) g += dayCredit(b);
  return g;
}

/**
 * Average credit over the last `n` SETTLED days that had anything due — how
 * steadily someone has been finishing their list lately. Drives egg luck.
 */
export function recentCompletion(
  days: Map<string, DayBucket>,
  today: string,
  n = 14,
): number {
  let sum = 0;
  let count = 0;
  for (let i = 1; i <= n; i++) {
    const b = days.get(addDaysISO(today, -i));
    if (!b || b.effort <= 0) continue;
    sum += dayCredit(b);
    count += 1;
  }
  return count > 0 ? sum / count : 0;
}

/**
 * Egg luck, 0..1, from recent completion: nothing at half your list or less,
 * full at everything done. Replaces the streak, which one missed chore reset —
 * a child with a long list almost never had any luck.
 */
export function luckFromCompletion(avg: number): number {
  return Math.max(0, Math.min(1, (avg - 0.5) / 0.5));
}

/** One decimal, for display ("7.4"). Whole numbers without the ".0". */
export function fmtGrowth(g: number): string {
  const r = Math.floor(g * 10 + 1e-9) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}
