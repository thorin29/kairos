/**
 * How much a companion has grown, and which companion a day or a week belongs
 * to. One rule for every path — the live read in progression, retiring to the
 * gallery, hatching — so swapping companions can never drop growth between them.
 *
 * Pure (no database) so it can be tested across whole swap histories.
 *
 * Attribution, with no gaps and no overlaps:
 *  - A clean DAY belongs to the companion that was active at the end of it.
 *    A companion's tenure starts on the household day it was made active and
 *    counts that day; the one it replaced banked only the days before.
 *  - A perfect WEEK belongs to the companion active when the week ended. A
 *    week counts if its last day is on or after the tenure's first day — so a
 *    week already under way when a companion arrives is credited to it; the
 *    one it replaced banked only weeks that had already finished.
 *
 * Before v0.602 the tenure day was read in UTC (an evening swap started the
 * next day, losing that day to both companions) and a week counted only if it
 * STARTED inside the tenure (a mid-week swap lost the week to both). That
 * growth was earned and never credited; `unclaimedGrowth` hands it back.
 */

export type DayBucket = { assigned: number; complete: number; missed: number };
export type WeekBucket = { assigned: number; complete: number };

/** Growth points per perfect week, on top of its clean days. */
export const WEEK_GROWTH = 2;

function addDaysISO(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function isCleanDay(b: DayBucket): boolean {
  return b.assigned > 0 && b.missed === 0 && b.complete === b.assigned;
}

export function isPerfectWeek(b: WeekBucket): boolean {
  return b.assigned > 0 && b.complete === b.assigned;
}

/**
 * Growth earned from `fromISO` (inclusive) up to, but not including, `today`:
 * resolved clean days, plus perfect weeks that have finished and whose last day
 * is on or after `fromISO`.
 */
export function growthSince(
  days: Map<string, DayBucket>,
  weeks: Map<string, WeekBucket>,
  fromISO: string,
  today: string,
): number {
  let g = 0;
  for (const [iso, b] of days) {
    if (iso >= fromISO && iso < today && isCleanDay(b)) g += 1;
  }
  for (const [wkISO, b] of weeks) {
    const end = addDaysISO(wkISO, 6);
    if (end >= fromISO && end < today && isPerfectWeek(b)) g += WEEK_GROWTH;
  }
  return g;
}

/**
 * Growth the person earned since their first companion hatched that no
 * companion holds: everything earned, less what the shelf has banked and what
 * the active one has. Never negative — older rows were floored up to the stage
 * the gallery showed (`bankedGrowthFloor`), which can only add.
 */
export function unclaimedGrowth(input: {
  earnedSinceFirstHatch: number;
  shelvedBanked: number;
  activeGrowth: number;
}): number {
  return Math.max(0, input.earnedSinceFirstHatch - input.shelvedBanked - input.activeGrowth);
}
