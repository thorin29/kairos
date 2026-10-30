/**
 * Records by rep count, from actual sets only (no estimates). Pure, shared by
 * the logger (both clients), the progress charts and their tests.
 *
 *   repRecords   the heaviest weight lifted at each exact rep count
 *   recordChips  the few of those worth showing at the top of the logger
 *   isNewBest    a set no earlier set matches: nothing as heavy for as many reps
 *   bandPoints   one point per day for a rep range, so a set of 5 is compared
 *                with other sets of 4–6, not with singles
 */

export type SetLike = { weight: number | null; reps: number | null };
export type DatedSet = SetLike & { date: string };
export type RepRecord = { reps: number; weight: number; date: string };

/** Heaviest weight per exact rep count; the first day it was lifted. */
export function repRecords(sets: readonly DatedSet[]): RepRecord[] {
  const best = new Map<number, RepRecord>();
  for (const s of sets) {
    if (s.weight == null || s.weight <= 0 || s.reps == null || s.reps <= 0) continue;
    const cur = best.get(s.reps);
    if (!cur || s.weight > cur.weight || (s.weight === cur.weight && s.date < cur.date)) {
      best.set(s.reps, { reps: s.reps, weight: s.weight, date: s.date });
    }
  }
  return [...best.values()].sort((a, b) => a.reps - b.reps);
}

/** The usual rep counts come first; others fill in up to `max`, in rep order. */
const USUAL = [1, 2, 3, 5, 8, 10];
export function recordChips(records: readonly RepRecord[], max = 4): RepRecord[] {
  const usual = records.filter((r) => USUAL.includes(r.reps));
  const other = records.filter((r) => !USUAL.includes(r.reps));
  return [...usual, ...other].slice(0, max).sort((a, b) => a.reps - b.reps);
}

/**
 * A new best: nothing earlier was as heavy for as many reps or more. With no
 * history at all nothing is a "best" (the first session would light up every
 * set). A first-ever set of 10 counts, as long as no earlier set of 10+ reps
 * was as heavy.
 */
export function isNewBest(set: SetLike, records: readonly RepRecord[]): boolean {
  if (records.length === 0) return false;
  const w = set.weight;
  const r = set.reps;
  if (w == null || w <= 0 || r == null || r <= 0) return false;
  let ceiling = 0;
  for (const rec of records) if (rec.reps >= r && rec.weight > ceiling) ceiling = rec.weight;
  return w > ceiling;
}

export type RepBand = { key: string; label: string; min: number; max: number };
export const REP_BANDS: readonly RepBand[] = [
  { key: "1-3", label: "1–3 reps", min: 1, max: 3 },
  { key: "4-6", label: "4–6 reps", min: 4, max: 6 },
  { key: "7-12", label: "7–12 reps", min: 7, max: 12 },
];

/** Per day, the heaviest set inside the band (more reps wins a tie). */
export function bandPoints(
  sets: readonly DatedSet[],
  band: RepBand,
): { date: string; value: number; reps: number }[] {
  const byDay = new Map<string, { value: number; reps: number }>();
  for (const s of sets) {
    if (s.weight == null || s.weight <= 0 || s.reps == null) continue;
    if (s.reps < band.min || s.reps > band.max) continue;
    const cur = byDay.get(s.date);
    if (!cur || s.weight > cur.value || (s.weight === cur.value && s.reps > cur.reps)) {
      byDay.set(s.date, { value: s.weight, reps: s.reps });
    }
  }
  return [...byDay.entries()]
    .map(([date, p]) => ({ date, value: p.value, reps: p.reps }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}

/**
 * Weeks trained in a row, newest first in `weeks`. A week counts when every
 * workout due in it was done or excused (skipped, rest day) and something was
 * logged or due; programs, light weeks and injuries never break it. The
 * current week is still in progress: it adds to the run once it qualifies but
 * never breaks it.
 */
export type WeekTrainingIn = { start: string; due: number; open: number; logged: boolean; current: boolean };
export function weeksInARow(weeks: readonly WeekTrainingIn[]): number {
  let run = 0;
  for (const w of weeks) {
    const qualifies = w.open === 0 && (w.due > 0 || w.logged);
    if (w.current) {
      if (qualifies) run++;
      continue;
    }
    if (!qualifies) break;
    run++;
  }
  return run;
}
