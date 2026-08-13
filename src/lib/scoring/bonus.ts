/**
 * Initiative bonuses — the small extra that separates a caught-up family at
 * the top of the board. Kept pure and dependency-free.
 *
 * Two kinds, both a light top-up on the fairness base, never a replacement:
 *
 *   - Get ahead: finishing a scheduled chore before its due date. Worth a
 *     slight, effort-scaled bump — a heavier chore done early is worth a bit
 *     more — but flat regardless of how many days early, so it never rivals
 *     just doing the chore. Not for "anytime" chores (they aren't early until
 *     their period closes) or shared ones (those have their own bonus below).
 *
 *   - Promptness: grabbing an up-for-grabs (shared/pool) chore quickly. Sooner
 *     is worth more — full the day it's available or before, half a day later,
 *     nothing after that.
 *
 * The base credit for a chore always lands in the week it was due; these
 * bonuses land in the week the work was actually done, so getting ahead shows
 * its reward now.
 */

export const GET_AHEAD_FACTOR = 0.25;
export const PROMPTNESS_FACTOR = 0.5;

export type BonusKind = "ahead" | "prompt";

export type BonusInput = {
  effort: number;
  isPool: boolean;
  isAnytime: boolean;
  hasChore: boolean;
  dueISO: string;
  completionISO: string;
};

export type BonusResult = { kind: BonusKind; points: number } | null;

function dayDelta(fromISO: string, toISO: string): number {
  const a = Date.parse(`${fromISO}T00:00:00Z`);
  const b = Date.parse(`${toISO}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

/** Promptness decay: full on/before the day it's available, half a day late,
 *  nothing after. */
function promptnessDecay(delayDays: number): number {
  if (delayDays <= 0) return 1;
  if (delayDays === 1) return 0.5;
  return 0;
}

export function computeTaskBonus(input: BonusInput): BonusResult {
  const { effort, isPool, isAnytime, hasChore, dueISO, completionISO } = input;

  if (isPool) {
    const decay = promptnessDecay(dayDelta(dueISO, completionISO));
    if (decay <= 0) return null;
    return { kind: "prompt", points: effort * PROMPTNESS_FACTOR * decay };
  }

  if (hasChore && !isAnytime && completionISO < dueISO) {
    return { kind: "ahead", points: effort * GET_AHEAD_FACTOR };
  }

  return null;
}

/** One decimal is plenty for a light top-up, and keeps the board tidy. */
export function roundBonus(points: number): number {
  return Math.round(points * 10) / 10;
}
