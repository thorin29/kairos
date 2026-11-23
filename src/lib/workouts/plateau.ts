/**
 * Plateau (v0.752, plan-builder release 4): two or more main muscle groups
 * with no new best in 4 weeks. Pure, shared by the web, the phone API and the
 * tests. A program with training maxes is left to its What's next at the end
 * of each cycle; this is for your own plan and programs that run on.
 */
import { isNewBest, repRecords, type DatedSet, type RepRecord } from "@/lib/workouts/records";

export const PLATEAU = {
  /** No new best for this many weeks… */
  weeks: 4,
  /** …in at least this many main muscle groups. */
  groups: 2,
  /** A group counts only with this many days trained in the window, and
   *  sets before it to beat. */
  minDays: 3,
  /** Light week: the share of the usual weights, and for how many days. */
  light: 0.6,
  lightDays: 7,
  /** Keep going (or any answer): asked again this many weeks later. */
  snoozeWeeks: 4,
} as const;

/** The groups that count; arms, core and lower back don't. */
export const MAIN_GROUPS = ["CHEST", "BACK", "LEGS", "SHOULDERS", "DEADLIFT"] as const;

export type PlateauSet = DatedSet & { poolExerciseId: string; name: string; group: string };

export type PlateauGroup = {
  group: string;
  /** The group's most trained movement in the window, its best set there,
   *  and the day of its last new best. */
  movement: { poolExerciseId: string; name: string; weight: number; reps: number; since: string };
};

const minus = (iso: string, days: number) =>
  new Date(Date.parse(`${iso}T00:00:00Z`) - days * 86_400_000).toISOString().slice(0, 10);

/** The main groups with no new best in the window, or [] when fewer than
 *  PLATEAU.groups of them stalled. */
export function plateauGroups(sets: readonly PlateauSet[], today: string): PlateauGroup[] {
  const from = minus(today, PLATEAU.weeks * 7);
  const out: PlateauGroup[] = [];
  for (const group of MAIN_GROUPS) {
    const mine = sets.filter((s) => s.group === group && s.weight != null && s.weight > 0 && s.reps != null && s.reps > 0);
    const inWindow = mine.filter((s) => s.date >= from && s.date <= today);
    if (new Set(inWindow.map((s) => s.date)).size < PLATEAU.minDays) continue;
    let anyNew = false;
    let counted = false;
    const byMove = new Map<string, PlateauSet[]>();
    for (const s of mine) byMove.set(s.poolExerciseId, [...(byMove.get(s.poolExerciseId) ?? []), s]);
    for (const list of byMove.values()) {
      const before = list.filter((s) => s.date < from);
      if (before.length === 0) continue;
      counted = true;
      // Each day in the window against everything before that day.
      const days = [...new Set(list.filter((s) => s.date >= from).map((s) => s.date))].sort();
      for (const d of days) {
        const records = repRecords(list.filter((s) => s.date < d));
        if (list.filter((s) => s.date === d).some((s) => isNewBest(s, records))) {
          anyNew = true;
          break;
        }
      }
      if (anyNew) break;
    }
    if (!counted || anyNew) continue;
    // The most trained movement that had something to beat.
    const pick = [...byMove.entries()]
      .filter(([, l]) => l.some((s) => s.date < from) && l.some((s) => s.date >= from))
      .sort((a, b) => b[1].filter((s) => s.date >= from).length - a[1].filter((s) => s.date >= from).length)[0];
    if (!pick) continue;
    const [id, list] = pick;
    const recent = list.filter((s) => s.date >= from);
    const best = recent.reduce((b, s) => ((s.weight ?? 0) > (b.weight ?? 0) || ((s.weight ?? 0) === (b.weight ?? 0) && (s.reps ?? 0) > (b.reps ?? 0)) ? s : b));
    const since = lastBestOn(repRecords(list.filter((s) => s.date < from)));
    out.push({
      group,
      movement: { poolExerciseId: id, name: list[0].name, weight: best.weight ?? 0, reps: best.reps ?? 0, since: since ?? from },
    });
  }
  return out.length >= PLATEAU.groups ? out : [];
}

const lastBestOn = (records: readonly RepRecord[]): string | null =>
  records.reduce<string | null>((m, r) => (m == null || r.date > m ? r.date : m), null);

const GROUP_WORD: Record<string, string> = {
  CHEST: "Chest",
  BACK: "Back",
  LEGS: "Legs",
  SHOULDERS: "Shoulders",
  DEADLIFT: "Deadlift",
};

const shortDate = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

/** "Chest and legs haven't moved in 4 weeks" and "Bench press 185 × 8 and
 *  squat 225 × 8 since Oct 25." */
export function plateauText(groups: readonly PlateauGroup[]): { title: string; why: string } {
  const names = groups.map((g) => GROUP_WORD[g.group] ?? g.group);
  const list = (xs: string[]) => (xs.length <= 2 ? xs.join(" and ") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);
  const title = `${list(names.map((n, i) => (i === 0 ? n : n.toLowerCase())))} haven't moved in ${PLATEAU.weeks} weeks`;
  const moves = groups.map((g, i) => {
    const n = i === 0 ? g.movement.name : g.movement.name.toLowerCase();
    const first = n.charAt(0).toUpperCase() + n.slice(1);
    return `${i === 0 ? first : n} ${g.movement.weight} × ${g.movement.reps}`;
  });
  const since = groups.map((g) => g.movement.since).sort()[groups.length - 1];
  return { title, why: `${list(moves)} since ${shortDate(since)}.` };
}
