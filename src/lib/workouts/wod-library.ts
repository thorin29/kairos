/**
 * The starting library of named conditioning workouts (v0.617): short daily
 * ones across the formats and the household's equipment, monthly benchmarks,
 * and heroes (picked by hand only). Each has a how-to, an Rx version and a
 * Scaled one. Added from Admin like the movement library: matched by
 * `libraryKey` (or name), never overwriting a workout someone made.
 *
 * Weights are pounds, distances miles. Movement names are the movement
 * library's (library.ts), plus "Run".
 */
import type { WorkoutType } from "@/lib/workouts/catalog";
import { LIBRARY, nameKey } from "@/lib/workouts/library";

export type WodKind = "DAILY" | "BENCHMARK" | "HERO";

export type WodMove = {
  name: string;
  reps: number | null;
  distance: number | null;
  weight: number | null;
};

export type WodEntry = {
  key: string;
  name: string;
  type: WorkoutType;
  /** AMRAP cap / EMOM length / seconds per timed station. */
  capSec: number | null;
  /** About how long it takes. */
  minutes: number;
  kind: WodKind;
  about: string;
  moves: WodMove[];
  /** The Scaled version: the same movements with these reps, weights or distances. */
  scaled: Partial<WodMove>[];
};

type M = [name: string, reps: number | null, rx: number | null, scaledReps?: number | null, scaledWeight?: number | null];
const mv = (list: M[]): { moves: WodMove[]; scaled: Partial<WodMove>[] } => ({
  moves: list.map(([name, reps, rx]) => ({ name, reps, distance: null, weight: rx })),
  scaled: list.map(([, reps, rx, sr, sw]) => ({ reps: sr === undefined ? reps : sr, weight: sw === undefined ? rx : sw })),
});
const run = (miles: number, scaledMiles: number) => ({
  move: { name: "Run", reps: null, distance: miles, weight: null } as WodMove,
  scaled: { reps: null, distance: scaledMiles, weight: null } as Partial<WodMove>,
});

function wod(
  key: string,
  name: string,
  type: WorkoutType,
  capMin: number | null,
  minutes: number,
  kind: WodKind,
  about: string,
  list: M[],
): WodEntry {
  const { moves, scaled } = mv(list);
  return { key, name, type, capSec: capMin != null ? capMin * 60 : null, minutes, kind, about, moves, scaled };
}

const DAILY: WodEntry[] = [
  wod("swing-and-push", "Swing and push", "AMRAP", 12, 12, "DAILY",
    "As many rounds as you can in 12 minutes. Move steadily; rest only when your form slips.",
    [["Kettlebell swing", 15, 35, 15, 18], ["Push-up", 10, null, 6], ["Air squat", 15, null]]),
  wod("slam-and-jump", "Slam and jump", "AMRAP", 10, 10, "DAILY",
    "As many rounds as you can in 10 minutes. Step down from the box, don't jump down.",
    [["Ball slam", 10, 30], ["Burpee", 6, null, 4], ["Box jump", 8, null, 8]]),
  wod("club-triplet", "Club triplet", "AMRAP", 12, 12, "DAILY",
    "As many rounds as you can in 12 minutes. Club mills alternate sides; keep the club close to the head.",
    [["Club mill", 10, 15, 10, 5], ["TRX row", 10, null], ["Sit-up", 15, null]]),
  wod("sandbag-grind", "Sandbag grind", "AMRAP", 15, 15, "DAILY",
    "As many rounds as you can in 15 minutes. Clean the bag from the floor to the chest every rep.",
    [["Sandbag clean", 5, 80, 5, 60], ["Pull-up", 5, null, 3], ["Mountain climber", 20, null]]),
  wod("wall-ball-pull", "Wall ball and pull", "AMRAP", 12, 12, "DAILY",
    "As many rounds as you can in 12 minutes. Wall balls to a target about 9 feet up.",
    [["Wall ball", 12, 10, 12, 6], ["Pull-up", 6, null, 3], ["Mountain climber", 20, null]]),
  wod("bodyweight-fifteen", "Bodyweight fifteen", "AMRAP", 15, 15, "DAILY",
    "As many rounds as you can in 15 minutes, no equipment. Good for travel days.",
    [["Push-up", 10, null, 6], ["Air squat", 15, null], ["Sit-up", 15, null], ["Burpee", 5, null, 3]]),
  wod("dumbbell-dozen", "Dumbbell dozen", "AMRAP", 12, 12, "DAILY",
    "As many rounds as you can in 12 minutes. Renegade rows: one per arm is one rep.",
    [["Dumbbell thruster", 10, 30, 10, 10], ["Renegade row", 8, 30, 8, 10], ["Box step-up", 10, null]]),
  wod("swing-burpee-emom", "Swing and burpee EMOM", "EMOM", 10, 10, "DAILY",
    "Odd minutes kettlebell swings, even minutes burpees. Rest what's left of each minute.",
    [["Kettlebell swing", 15, 35, 12, 18], ["Burpee", 8, null, 5]]),
  wod("four-corners-emom", "Four corners EMOM", "EMOM", 12, 12, "DAILY",
    "A different movement each minute, round and round for 12 minutes.",
    [["Goblet squat", 10, 35, 10, 18], ["Push-up", 10, null, 6], ["Ball slam", 10, 30], ["Sit-up", 15, null]]),
  wod("club-emom", "Club EMOM", "EMOM", 10, 10, "DAILY",
    "Odd minutes club swipes (both sides), even minutes TRX rows.",
    [["Club swipe", 10, 15, 10, 5], ["TRX row", 10, null, 8]]),
  wod("dumbbell-emom", "Dumbbell EMOM", "EMOM", 16, 16, "DAILY",
    "Four movements, one a minute, four times through. Snatches alternate arms.",
    [["Dumbbell snatch", 10, 30, 10, 10], ["Box jump", 8, null, 6], ["Mountain climber", 30, null, 20], ["Russian twist", 20, null]]),
  wod("tabata-squat-push", "Tabata squat and push", "TABATA", null, 8, "DAILY",
    "Eight rounds of 20 seconds on, 10 off for each movement. Count your reps each round; log the lowest.",
    [["Air squat", null, null], ["Push-up", null, null]]),
  wod("tabata-four", "Tabata four", "TABATA", null, 16, "DAILY",
    "Four Tabatas back to back. Log the lowest round of the whole thing.",
    [["Mountain climber", null, null], ["Air squat", null, null], ["Sit-up", null, null], ["Burpee", null, null]]),
  wod("tabata-bell-and-ball", "Tabata bell and ball", "TABATA", null, 8, "DAILY",
    "Eight rounds of kettlebell swings, then eight of ball slams.",
    [["Kettlebell swing", null, 26, null, 15], ["Ball slam", null, 30]]),
  wod("swing-burpee-21", "21-15-9 swing and burpee", "FOR_TIME", null, 10, "DAILY",
    "21 swings and 21 burpees, then 15 of each, then 9. Totals shown.",
    [["Kettlebell swing", 45, 35, 45, 18], ["Burpee", 45, null, 27]]),
  wod("wall-ball-pull-21", "21-15-9 wall ball and pull-up", "FOR_TIME", null, 12, "DAILY",
    "21 wall balls and 21 pull-ups, then 15, then 9. Scaled: 12-9-6 pull-ups.",
    [["Wall ball", 45, 10, 45, 6], ["Pull-up", 45, null, 27]]),
  wod("descending-ladder", "Descending ladder", "FOR_TIME", null, 15, "DAILY",
    "Pull-ups 10 down to 1, push-ups 1 up to 10: 10 pull-ups and 1 push-up, 9 and 2, and so on.",
    [["Pull-up", 55, null, 28], ["Push-up", 55, null]]),
  wod("short-chipper", "Short chipper", "FOR_TIME", null, 15, "DAILY",
    "Work down the list once, in order. Break the reps up however you like.",
    [["Air squat", 50, null], ["Sit-up", 40, null], ["Kettlebell swing", 30, 35, 30, 18], ["Push-up", 20, null, 12], ["Burpee", 10, null]]),
  wod("station-circuit", "Station circuit", "TIMED_STATIONS", null, 4, "DAILY",
    "45 seconds at each station, moving straight to the next. Count total reps.",
    [["Kettlebell swing", null, 35, null, 18], ["Ball slam", null, 30], ["Box step-up", null, null], ["Mountain climber", null, null]]),
];
DAILY.find((w) => w.key === "station-circuit")!.capSec = 45;

const helen = run(0.75, 0.5);
const murph = run(2, 1);

const BENCHMARKS: WodEntry[] = [
  wod("cindy", "Cindy", "AMRAP", 20, 20, "BENCHMARK",
    "A classic: 5 pull-ups, 10 push-ups, 15 air squats, as many rounds as you can in 20 minutes.",
    [["Pull-up", 5, null, 3], ["Push-up", 10, null, 6], ["Air squat", 15, null]]),
  {
    ...wod("helen", "Helen", "FOR_TIME", null, 12, "BENCHMARK",
      "Three rounds: run 400 m (a quarter mile), 21 kettlebell swings, 12 pull-ups. Totals shown.",
      [["Kettlebell swing", 63, 53, 63, 35], ["Pull-up", 36, null, 24]]),
  },
  wod("annie", "Annie", "FOR_TIME", null, 10, "BENCHMARK",
    "50-40-30-20-10 jump rope skips and sit-ups: 50 of each, then 40, and so on. Totals shown.",
    [["Jump rope", 150, null], ["Sit-up", 150, null, 100]]),
  wod("home-fran", "Fran (home)", "FOR_TIME", null, 8, "BENCHMARK",
    "21-15-9 thrusters and pull-ups. Fast and hard. Totals shown.",
    [["Thruster", 45, 95, 45, 45], ["Pull-up", 45, null, 27]]),
  wod("kettlebell-grace", "Grace (kettlebell)", "FOR_TIME", null, 8, "BENCHMARK",
    "30 kettlebell clean and presses for time, switching arms as you like.",
    [["Kettlebell clean and press", 30, 35, 30, 18]]),
  wod("karen", "Karen", "FOR_TIME", null, 12, "BENCHMARK",
    "150 wall balls for time. Break them up early.",
    [["Wall ball", 150, 10, 100, 6]]),
];
const helenEntry = BENCHMARKS.find((w) => w.key === "helen")!;
helenEntry.moves.unshift(helen.move);
helenEntry.scaled.unshift(helen.scaled);

const HEROES: WodEntry[] = [
  wod("murph", "Murph", "FOR_TIME", null, 50, "HERO",
    "Run 1 mile, 100 pull-ups, 200 push-ups, 300 air squats, run 1 mile. Split the middle any way you like. Scaled is the half Murph.",
    [["Pull-up", 100, null, 50], ["Push-up", 200, null, 100], ["Air squat", 300, null, 150]]),
  wod("kalsu", "Kalsu", "FOR_TIME", null, 30, "HERO",
    "100 thrusters for time, with 5 burpees at the top of every minute, starting with burpees. Scaled: 50 thrusters at 45 lb.",
    [["Thruster", 100, 135, 50, 45], ["Burpee", null, null]]),
];
const murphEntry = HEROES[0];
murphEntry.moves.unshift(murph.move);
murphEntry.scaled.unshift(murph.scaled);

export const WOD_LIBRARY: readonly WodEntry[] = [...DAILY, ...BENCHMARKS, ...HEROES];

/** The equipment a workout needs (library equipment keys). */
export function wodEquipment(w: Pick<WodEntry, "moves">): string[] {
  const out = new Set<string>();
  for (const m of w.moves) {
    const e = LIBRARY.find((l) => nameKey(l.name) === nameKey(m.name));
    for (const k of e?.equipment ?? []) out.add(k);
  }
  return [...out].sort();
}

/** The movements of a version: Rx as written, Scaled with its changes. */
export function versionMoves(moves: readonly WodMove[], scaled: readonly Partial<WodMove>[] | null | undefined, version: "RX" | "SCALED"): WodMove[] {
  if (version === "RX" || !scaled) return moves.map((m) => ({ ...m }));
  return moves.map((m, i) => ({ ...m, ...(scaled[i] ?? {}), name: m.name }));
}

/** Whether Scaled differs from Rx at all. */
export function hasScaled(moves: readonly WodMove[], scaled: readonly Partial<WodMove>[] | null | undefined): boolean {
  if (!scaled) return false;
  return versionMoves(moves, scaled, "SCALED").some(
    (m, i) => m.reps !== moves[i].reps || m.weight !== moves[i].weight || m.distance !== moves[i].distance,
  );
}

/** Younger people start on Scaled (they can switch). */
export const SCALED_UNDER_AGE = 16;
export function defaultVersion(birthdayISO: string | null, todayISO: string): "RX" | "SCALED" {
  if (!birthdayISO) return "RX";
  const [by, bm, bd] = birthdayISO.split("-").map(Number);
  const [ty, tm, td] = todayISO.split("-").map(Number);
  const age = ty - by - (tm < bm || (tm === bm && td < bd) ? 1 : 0);
  return age < SCALED_UNDER_AGE ? "SCALED" : "RX";
}

/** What adding the library would do: workouts to create (not already there
 *  by library key or by name among the shared ones). */
export function planWodMerge(
  existing: readonly { name: string; libraryKey: string | null; ownerId: string | null }[],
  library: readonly WodEntry[] = WOD_LIBRARY,
): WodEntry[] {
  const keys = new Set(existing.map((e) => e.libraryKey).filter(Boolean));
  const names = new Set(existing.filter((e) => !e.ownerId).map((e) => nameKey(e.name)));
  return library.filter((w) => !keys.has(w.key) && !names.has(nameKey(w.name)));
}

/** This month's benchmark: the benchmarks in turn, one a month. */
export function benchmarkForMonth(dateISO: string, benchmarks: readonly unknown[]): number {
  if (benchmarks.length === 0) return -1;
  const [y, m] = dateISO.split("-").map(Number);
  return (y * 12 + (m - 1)) % benchmarks.length;
}
