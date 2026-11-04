/**
 * The body map's heat view (v0.635): how much hard work each muscle group has
 * had over a stretch of weeks, and how much of it was heavy. Pure — the server
 * passes every logged set, already resolved to its muscle groups.
 *
 * What counts, and why (the research this follows):
 *  - Size comes from sets taken reasonably close to failure, almost whatever
 *    the load (Schoenfeld 2017; Robinson 2024: 0–5 reps short of failure).
 *    So a set counts by how close it was: 1 when within about 5 reps of the
 *    limit, ½ when 6–9 short, nothing further off. A hundred easy sets do not
 *    make a muscle look worked.
 *  - The limit is estimated from the person's own best (Epley, from sets of
 *    12 or fewer) as of that day, so an early set is judged against what they
 *    could do then, not what they can do now.
 *  - How it felt overrides the estimate: Hard or Too hard counts in full,
 *    Easy counts at most half.
 *  - Muscles a movement only assists with get half (Pelland 2024).
 *  - Heavy sets (6 reps or fewer at 80% of the estimated max or more) are
 *    counted on their own, for the main muscle only: heavier loads build more
 *    strength (Schoenfeld 2017), and that is the part of progress this shows.
 *  - Ranges are averaged per week. About 10 or more counted sets a week is
 *    the band most studies find works well for size (Baz-Valle 2022); a
 *    program like 5/3/1 lands nearer 3–6 per main muscle, which still shows.
 */

export type HeatSet = {
  date: string;
  movement: string;
  name: string;
  /** The muscle group it mainly works, and the ones it assists. */
  primary: string | null;
  secondary: readonly string[];
  weight: number | null;
  reps: number | null;
  /** How the movement felt that day (EASY / SOLID / HARD / TOO_HARD). */
  effort?: string | null;
};

export type SetScore = { credit: number; heavy: boolean };

export const HEAT_RANGES = [
  { key: "1w", label: "1 week", short: "1 wk", days: 7 },
  { key: "4w", label: "4 weeks", short: "4 wk", days: 28 },
  { key: "12w", label: "12 weeks", short: "12 wk", days: 84 },
  { key: "6m", label: "6 months", short: "6 mo", days: 182 },
  { key: "all", label: "All", short: "All", days: null },
] as const;
export type HeatRangeKey = (typeof HEAT_RANGES)[number]["key"];
export const DEFAULT_HEAT_RANGE: HeatRangeKey = "12w";

export type HeatBest = {
  name: string;
  /** "weight": best weight at `reps`. "reps": best reps (no weight). */
  kind: "weight" | "reps";
  reps: number | null;
  from: number;
  to: number;
};
export type HeatGroup = {
  group: string;
  /** Counted sets a week, averaged over the range, one decimal. */
  perWeek: number;
  heavyPerWeek: number;
  /** 0 none, 1 under 4 a week, 2 4–9, 3 10 or more. */
  level: 0 | 1 | 2 | 3;
  bests: HeatBest[];
};
export type HeatRange = { key: HeatRangeKey; label: string; groups: HeatGroup[] };
export type HeatMap = { unit: string; ranges: HeatRange[] };

const MAX_REPS_FOR_ESTIMATE = 12;
const epley = (w: number, reps: number) => w * (1 + Math.min(reps, MAX_REPS_FOR_ESTIMATE) / 30);

/** Credit for a set that ended `rir` reps short of the limit. */
export function creditFor(rir: number): number {
  if (rir <= 5) return 1;
  if (rir <= 9) return 0.5;
  return 0;
}

export function levelFor(perWeek: number): 0 | 1 | 2 | 3 {
  if (perWeek <= 0) return 0;
  if (perWeek < 4) return 1;
  if (perWeek < 10) return 2;
  return 3;
}

function applyEffort(credit: number, effort: string | null | undefined): number {
  if (effort === "HARD" || effort === "TOO_HARD") return 1;
  if (effort === "EASY") return Math.min(credit, 0.5);
  return credit;
}

const byDate = <T extends { date: string }>(a: T, b: T) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0);

/**
 * Score every set, in order. Each movement's best is updated with the day's
 * sets before they are judged, so a record day counts its top set as all-out.
 * A set under half the day's heaviest (or, without weight, under half the
 * day's most reps) is a warm-up and counts for nothing, however it felt.
 */
export function scoreSets(sets: readonly HeatSet[]): SetScore[] {
  const order = sets.map((s, i) => ({ s, i })).sort((a, b) => byDate(a.s, b.s));
  const best = new Map<string, number>(); // movement -> best e1RM
  const bestReps = new Map<string, number>(); // movement -> most reps without weight
  const out: SetScore[] = sets.map(() => ({ credit: 0, heavy: false }));

  let k = 0;
  while (k < order.length) {
    const date = order[k].s.date;
    let end = k;
    while (end < order.length && order[end].s.date === date) end++;
    const day = order.slice(k, end);

    const top = new Map<string, number>();
    const topReps = new Map<string, number>();
    for (const { s } of day) {
      const reps = s.reps ?? 0;
      if (reps <= 0) continue;
      if (s.weight != null && s.weight > 0) {
        best.set(s.movement, Math.max(best.get(s.movement) ?? 0, epley(s.weight, reps)));
        top.set(s.movement, Math.max(top.get(s.movement) ?? 0, s.weight));
      } else {
        bestReps.set(s.movement, Math.max(bestReps.get(s.movement) ?? 0, reps));
        topReps.set(s.movement, Math.max(topReps.get(s.movement) ?? 0, reps));
      }
    }

    for (const { s, i } of day) {
      const reps = s.reps ?? 0;
      if (reps <= 0) continue;
      if (s.weight != null && s.weight > 0) {
        if (s.weight < 0.5 * (top.get(s.movement) ?? 0)) continue;
        const max = best.get(s.movement) ?? epley(s.weight, reps);
        const limit = 30 * (max / s.weight - 1);
        out[i] = {
          credit: applyEffort(creditFor(limit - reps), s.effort),
          heavy: reps <= 6 && s.weight >= 0.8 * max,
        };
      } else {
        if (reps < 0.5 * (topReps.get(s.movement) ?? 0)) continue;
        const limit = bestReps.get(s.movement) ?? reps;
        out[i] = { credit: applyEffort(creditFor(limit - reps), s.effort), heavy: false };
      }
    }
    k = end;
  }
  return out;
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const addDaysISO = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const daysBetween = (a: string, b: string) =>
  Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);

/** Best weight at the rep count done most in the range, then and now. */
function bestsFor(sets: readonly HeatSet[], group: string, from: string, today: string): HeatBest[] {
  const mine = sets.filter((s) => s.primary === group && (s.reps ?? 0) > 0 && s.date <= today);
  const inRange = mine.filter((s) => s.date >= from);
  const byMove = new Map<string, HeatSet[]>();
  for (const s of inRange) byMove.set(s.movement, [...(byMove.get(s.movement) ?? []), s]);

  const picks = [...byMove.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, 3);
  const out: HeatBest[] = [];
  for (const [movement, list] of picks) {
    const all = mine.filter((s) => s.movement === movement);
    const weighted = list.filter((s) => s.weight != null && s.weight > 0);
    if (weighted.length > 0) {
      const counts = new Map<number, number>();
      for (const s of weighted) counts.set(s.reps!, (counts.get(s.reps!) ?? 0) + 1);
      const reps = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0];
      const at = all.filter((s) => s.reps === reps && s.weight != null && s.weight > 0);
      const before = at.filter((s) => s.date < from);
      const firstDay = at.filter((s) => s.date >= from).sort(byDate)[0]?.date;
      const start = (before.length ? before : at.filter((s) => s.date === firstDay)).reduce(
        (m, s) => Math.max(m, s.weight!),
        0,
      );
      const now = at.reduce((m, s) => Math.max(m, s.weight!), 0);
      out.push({ name: list[0].name, kind: "weight", reps, from: start, to: now });
    } else {
      const before = all.filter((s) => s.date < from && (s.weight ?? 0) <= 0);
      const firstDay = list.slice().sort(byDate)[0].date;
      const start = (before.length ? before : list.filter((s) => s.date === firstDay)).reduce(
        (m, s) => Math.max(m, s.reps ?? 0),
        0,
      );
      const now = all.filter((s) => (s.weight ?? 0) <= 0).reduce((m, s) => Math.max(m, s.reps ?? 0), 0);
      out.push({ name: list[0].name, kind: "reps", reps: null, from: start, to: now });
    }
  }
  return out;
}

/** Every range, every group that has been trained, as of `today`. */
export function buildHeat(sets: readonly HeatSet[], today: string, unit = "lb"): HeatMap {
  const scores = scoreSets(sets);
  const first = sets.reduce<string | null>((m, s) => (m == null || s.date < m ? s.date : m), null);
  const groups = new Set<string>();
  for (const s of sets) {
    if (s.primary) groups.add(s.primary);
    for (const g of s.secondary) groups.add(g);
  }

  const ranges: HeatRange[] = HEAT_RANGES.map((r) => {
    const from = r.days != null ? addDaysISO(today, -(r.days - 1)) : (first ?? today);
    const days = r.days ?? Math.max(7, daysBetween(from, today) + 1);
    const weeks = days / 7;
    const credit = new Map<string, number>();
    const heavy = new Map<string, number>();
    sets.forEach((s, i) => {
      if (s.date < from || s.date > today) return;
      const sc = scores[i];
      if (s.primary) {
        credit.set(s.primary, (credit.get(s.primary) ?? 0) + sc.credit);
        if (sc.heavy) heavy.set(s.primary, (heavy.get(s.primary) ?? 0) + 1);
      }
      for (const g of s.secondary) {
        if (g === s.primary) continue;
        credit.set(g, (credit.get(g) ?? 0) + sc.credit / 2);
      }
    });
    return {
      key: r.key,
      label: r.label,
      groups: [...groups].sort().map((g) => {
        const perWeek = round1((credit.get(g) ?? 0) / weeks);
        return {
          group: g,
          perWeek,
          heavyPerWeek: round1((heavy.get(g) ?? 0) / weeks),
          level: levelFor(perWeek),
          bests: bestsFor(sets, g, from, today),
        };
      }),
    };
  });
  return { unit, ranges };
}
