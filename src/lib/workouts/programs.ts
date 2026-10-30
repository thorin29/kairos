/**
 * Workout programs: templates written as data, and the pure rules that turn a
 * program, its week and a person's numbers into each set's target. Shared by
 * the web, the phone API and the tests. Nothing here touches the database.
 *
 * A program writes an ordinary weekly plan (`PlannedWorkout` rows) when it's
 * started; each planned movement carries its set scheme in
 * `PlannedExercise.scheme`. The targets then fill the logger's greyed hints in
 * place of last time. Weights are actual numbers from the person (a training
 * max they gave, or what they lifted last time); nothing is estimated.
 */
import type { MuscleGroup } from "@/lib/workouts/catalog";

/** One set of a "work up to a top set" week: reps at a share of the training max. */
export type WaveSet = { reps: number; pct: number; top?: boolean };

/**
 * How a movement's sets are laid out (stored in PlannedExercise.scheme):
 *   wave            work up to a top set; reps and % of training max by program week
 *   range:3x8-12    one weight; reps up to the top of the range, then the weight goes up
 *   same:3x5        one weight for every set; all reps done → the weight goes up
 */
export type Scheme =
  | { kind: "WAVE" }
  | { kind: "RANGE"; sets: number; min: number; max: number }
  | { kind: "SAME"; sets: number; reps: number };

export function schemeKey(s: Scheme): string {
  if (s.kind === "WAVE") return "wave";
  if (s.kind === "RANGE") return `range:${s.sets}x${s.min}-${s.max}`;
  return `same:${s.sets}x${s.reps}`;
}

export function parseScheme(raw: string | null | undefined): Scheme | null {
  if (!raw) return null;
  if (raw === "wave") return { kind: "WAVE" };
  let m = /^range:(\d+)x(\d+)-(\d+)$/.exec(raw);
  if (m) return { kind: "RANGE", sets: +m[1], min: +m[2], max: +m[3] };
  m = /^same:(\d+)x(\d+)$/.exec(raw);
  if (m) return { kind: "SAME", sets: +m[1], reps: +m[2] };
  return null;
}

/** "Work up to a top set", "3 × 8–12", "3 × 5". */
export function schemeLabel(s: Scheme): string {
  if (s.kind === "WAVE") return "Work up to a top set";
  if (s.kind === "RANGE") return `${s.sets} × ${s.min}–${s.max}`;
  return `${s.sets} × ${s.reps}`;
}

/** A slot in a program day, filled with one pool movement when it starts. */
export type ProgramRole = {
  key: string;
  label: string;
  /** Which movements fit, for the picker and the default. */
  muscleGroup: MuscleGroup;
  /** Pool names that fill it by default, best first (case and plural ignored). */
  match: string[];
  scheme: Scheme;
  /** Lower-body lifts go up 10 lb at a time, the rest 5. */
  lower?: boolean;
  /** A main lift: asks for a starting weight and gets a training max. */
  main?: boolean;
  /** Optional: left out when nothing in the pool fits. */
  optional?: boolean;
};

export type ProgramDay = {
  name: string;
  roles: ProgramRole[];
  /** A rowing piece planned that day as Cardio (metres). */
  row?: boolean;
};

export type Program = {
  key: string;
  name: string;
  blurb: string;
  /** Weeks in a block; the targets cycle through them. */
  weeks: number;
  lightWeeks: number[];
  testWeeks: number[];
  /** Weekdays (0 = Sunday) the days land on by default, one per day. */
  defaultDays: number[];
  days: ProgramDay[];
  /** Waves only: per program week, the sets of a "work up to a top set". */
  wave?: WaveSet[][];
};

const SQUAT = ["back squat", "squat", "front squat", "goblet squat"];
const BENCH = ["bench press", "bench", "dumbbell bench press", "incline bench press"];
const DEAD = ["deadlift", "romanian deadlift", "trap bar deadlift"];
const PRESS = ["overhead press", "shoulder press", "military press", "press", "dumbbell shoulder press"];
const ROW = ["bent over row", "barbell row", "dumbbell row", "row", "seated row"];
const PULL = ["pull-up", "pull up", "chin-up", "lat pulldown"];
const LUNGE = ["lunge", "dumbbell lunge", "walking lunge", "split squat"];
const CURL = ["ez bar curl", "curl", "dumbbell curl", "barbell curl"];
const TRI = ["ez bar skull crusher", "skull crusher", "tricep extension", "dip"];
const CORE = ["plank", "sit-up", "sit up", "hanging knee raise"];

const r = (sets: number, min: number, max: number): Scheme => ({ kind: "RANGE", sets, min, max });
const same = (sets: number, reps: number): Scheme => ({ kind: "SAME", sets, reps });

export const PROGRAMS: readonly Program[] = [
  {
    key: "strength-waves",
    name: "Strength waves",
    blurb:
      "Four main lifts, one a day, working up to a top set that changes each week, with week 4 light. " +
      "Rows, curls and core as sets of 8–12. For a lift that has stalled.",
    weeks: 4,
    lightWeeks: [4],
    testWeeks: [],
    defaultDays: [1, 2, 4, 5],
    wave: [
      [{ reps: 5, pct: 0.65 }, { reps: 5, pct: 0.75 }, { reps: 5, pct: 0.85, top: true }],
      [{ reps: 3, pct: 0.7 }, { reps: 3, pct: 0.8 }, { reps: 3, pct: 0.9, top: true }],
      [{ reps: 5, pct: 0.75 }, { reps: 3, pct: 0.85 }, { reps: 1, pct: 0.95, top: true }],
      [{ reps: 5, pct: 0.4 }, { reps: 5, pct: 0.5 }, { reps: 5, pct: 0.6 }],
    ],
    days: [
      {
        name: "Squat day",
        roles: [
          { key: "squat", label: "Squat", muscleGroup: "LEGS", match: SQUAT, scheme: { kind: "WAVE" }, lower: true, main: true },
          { key: "lunge", label: "Single leg", muscleGroup: "LEGS", match: LUNGE, scheme: r(3, 8, 12), lower: true, optional: true },
          { key: "core", label: "Core", muscleGroup: "CORE", match: CORE, scheme: r(3, 8, 12), optional: true },
        ],
      },
      {
        name: "Bench day",
        roles: [
          { key: "bench", label: "Bench", muscleGroup: "CHEST", match: BENCH, scheme: { kind: "WAVE" }, main: true },
          { key: "row", label: "Row", muscleGroup: "BACK", match: ROW, scheme: r(3, 8, 12), optional: true },
          { key: "tri", label: "Triceps", muscleGroup: "ARMS", match: TRI, scheme: r(3, 8, 12), optional: true },
        ],
        row: true,
      },
      {
        name: "Deadlift day",
        roles: [
          { key: "deadlift", label: "Deadlift", muscleGroup: "LEGS", match: DEAD, scheme: { kind: "WAVE" }, lower: true, main: true },
          { key: "pull", label: "Pull", muscleGroup: "BACK", match: PULL, scheme: r(3, 6, 10), optional: true },
          { key: "core", label: "Core", muscleGroup: "CORE", match: CORE, scheme: r(3, 8, 12), optional: true },
        ],
      },
      {
        name: "Press day",
        roles: [
          { key: "press", label: "Press", muscleGroup: "SHOULDERS", match: PRESS, scheme: { kind: "WAVE" }, main: true },
          { key: "row", label: "Row", muscleGroup: "BACK", match: ROW, scheme: r(3, 8, 12), optional: true },
          { key: "curl", label: "Curl", muscleGroup: "ARMS", match: CURL, scheme: r(3, 8, 12), optional: true },
        ],
        row: true,
      },
    ],
  },
  {
    key: "sets-of-ten",
    name: "Sets of 10",
    blurb:
      "Three full-body days at 8–12 reps. The weight goes up once every set reaches 12. " +
      "Every 6th week is a test week: work up to a heavy 3. Good for younger lifters.",
    weeks: 6,
    lightWeeks: [],
    testWeeks: [6],
    defaultDays: [1, 3, 5],
    days: [
      {
        name: "Day A",
        roles: [
          { key: "squat", label: "Squat", muscleGroup: "LEGS", match: SQUAT, scheme: r(3, 8, 12), lower: true },
          { key: "bench", label: "Push", muscleGroup: "CHEST", match: BENCH, scheme: r(3, 8, 12) },
          { key: "row", label: "Row", muscleGroup: "BACK", match: ROW, scheme: r(3, 8, 12) },
        ],
      },
      {
        name: "Day B",
        roles: [
          { key: "deadlift", label: "Hinge", muscleGroup: "LEGS", match: DEAD, scheme: r(3, 8, 12), lower: true },
          { key: "press", label: "Press", muscleGroup: "SHOULDERS", match: PRESS, scheme: r(3, 8, 12) },
          { key: "pull", label: "Pull", muscleGroup: "BACK", match: PULL, scheme: r(3, 6, 10), optional: true },
        ],
      },
      {
        name: "Day C",
        roles: [
          { key: "lunge", label: "Single leg", muscleGroup: "LEGS", match: LUNGE, scheme: r(3, 8, 12), lower: true },
          { key: "bench", label: "Push", muscleGroup: "CHEST", match: BENCH, scheme: r(3, 8, 12) },
          { key: "curl", label: "Arms", muscleGroup: "ARMS", match: CURL, scheme: r(3, 8, 12), optional: true },
          { key: "core", label: "Core", muscleGroup: "CORE", match: CORE, scheme: r(3, 8, 12), optional: true },
        ],
      },
    ],
  },
  {
    key: "full-body-3",
    name: "In-season full body",
    blurb:
      "Three short full-body days with rowing twice, for a sports season. " +
      "3 × 5 on the main lifts, adding weight when every rep is done. Week 4 is light.",
    weeks: 4,
    lightWeeks: [4],
    testWeeks: [],
    defaultDays: [1, 3, 5],
    days: [
      {
        name: "Day A",
        roles: [
          { key: "squat", label: "Squat", muscleGroup: "LEGS", match: SQUAT, scheme: same(3, 5), lower: true },
          { key: "bench", label: "Push", muscleGroup: "CHEST", match: BENCH, scheme: same(3, 5) },
          { key: "row", label: "Row", muscleGroup: "BACK", match: ROW, scheme: r(3, 8, 12), optional: true },
        ],
        row: true,
      },
      {
        name: "Day B",
        roles: [
          { key: "deadlift", label: "Hinge", muscleGroup: "LEGS", match: DEAD, scheme: same(3, 5), lower: true },
          { key: "press", label: "Press", muscleGroup: "SHOULDERS", match: PRESS, scheme: same(3, 5) },
          { key: "core", label: "Core", muscleGroup: "CORE", match: CORE, scheme: r(3, 8, 12), optional: true },
        ],
      },
      {
        name: "Day C",
        roles: [
          { key: "lunge", label: "Single leg", muscleGroup: "LEGS", match: LUNGE, scheme: r(3, 8, 12), lower: true, optional: true },
          { key: "pull", label: "Pull", muscleGroup: "BACK", match: PULL, scheme: r(3, 6, 10), optional: true },
          { key: "bench", label: "Push", muscleGroup: "CHEST", match: BENCH, scheme: r(3, 8, 12) },
        ],
        row: true,
      },
    ],
  },
  {
    key: "get-moving",
    name: "Just get moving",
    blurb: "Three short days, two sets of 10–15 on a few movements. Easy to start and easy to keep.",
    weeks: 4,
    lightWeeks: [],
    testWeeks: [],
    defaultDays: [1, 3, 5],
    days: [
      {
        name: "Day A",
        roles: [
          { key: "squat", label: "Legs", muscleGroup: "LEGS", match: [...SQUAT, ...LUNGE], scheme: r(2, 10, 15), lower: true },
          { key: "bench", label: "Push", muscleGroup: "CHEST", match: BENCH, scheme: r(2, 10, 15) },
          { key: "core", label: "Core", muscleGroup: "CORE", match: CORE, scheme: r(2, 10, 15), optional: true },
        ],
      },
      {
        name: "Day B",
        roles: [
          { key: "row", label: "Pull", muscleGroup: "BACK", match: [...ROW, ...PULL], scheme: r(2, 10, 15) },
          { key: "press", label: "Press", muscleGroup: "SHOULDERS", match: PRESS, scheme: r(2, 10, 15) },
        ],
        row: true,
      },
      {
        name: "Day C",
        roles: [
          { key: "lunge", label: "Legs", muscleGroup: "LEGS", match: [...LUNGE, ...SQUAT], scheme: r(2, 10, 15), lower: true },
          { key: "curl", label: "Arms", muscleGroup: "ARMS", match: CURL, scheme: r(2, 10, 15), optional: true },
          { key: "core", label: "Core", muscleGroup: "CORE", match: CORE, scheme: r(2, 10, 15), optional: true },
        ],
      },
    ],
  },
  {
    key: "maintain",
    name: "Maintain",
    blurb: "Two days a week to hold on to what you've built: busy weeks, or working around something that hurts.",
    weeks: 4,
    lightWeeks: [],
    testWeeks: [],
    defaultDays: [2, 5],
    days: [
      {
        name: "Day A",
        roles: [
          { key: "squat", label: "Legs", muscleGroup: "LEGS", match: [...SQUAT, ...LUNGE], scheme: r(2, 8, 12), lower: true },
          { key: "bench", label: "Push", muscleGroup: "CHEST", match: BENCH, scheme: r(2, 8, 12) },
          { key: "row", label: "Pull", muscleGroup: "BACK", match: [...ROW, ...PULL], scheme: r(2, 8, 12) },
        ],
      },
      {
        name: "Day B",
        roles: [
          { key: "deadlift", label: "Hinge", muscleGroup: "LEGS", match: DEAD, scheme: r(2, 8, 12), lower: true },
          { key: "press", label: "Press", muscleGroup: "SHOULDERS", match: PRESS, scheme: r(2, 8, 12) },
          { key: "core", label: "Core", muscleGroup: "CORE", match: CORE, scheme: r(2, 8, 12), optional: true },
        ],
      },
    ],
  },
];

export function programByKey(key: string | null | undefined): Program | null {
  return PROGRAMS.find((p) => p.key === key) ?? null;
}

const norm = (s: string) => s.trim().toLowerCase().replace(/s$/, "");

/** The pool movement a role starts with: the first match in order, by name. */
export function defaultMovement<T extends { id: string; name: string; muscleGroup?: string | null }>(
  role: ProgramRole,
  pool: readonly T[],
): T | null {
  for (const m of role.match) {
    const hit = pool.find((p) => norm(p.name) === norm(m));
    if (hit) return hit;
  }
  return null;
}

// --- weeks ----------------------------------------------------------------------

/** Week of the block (1-based) a day falls in, from the block's start. */
export function programWeek(program: Program, blockStartISO: string, dateISO: string): number {
  const days = Math.floor((Date.parse(`${dateISO}T00:00:00Z`) - Date.parse(`${blockStartISO}T00:00:00Z`)) / 86_400_000);
  const w = Math.floor(Math.max(0, days) / 7);
  return (w % program.weeks) + 1;
}

/** Whole blocks finished since the block started (the end-of-block card). */
export function blocksDone(program: Program, blockStartISO: string, dateISO: string): number {
  const days = Math.floor((Date.parse(`${dateISO}T00:00:00Z`) - Date.parse(`${blockStartISO}T00:00:00Z`)) / 86_400_000);
  return Math.floor(Math.max(0, days) / 7 / program.weeks);
}

export type Intent = "LIGHT" | "TEST" | null;
export function weekIntent(program: Program, week: number): Intent {
  if (program.lightWeeks.includes(week)) return "LIGHT";
  if (program.testWeeks.includes(week)) return "TEST";
  return null;
}

/** "Week 2 of 4", "Week 4 of 4 · light", "Week 6 of 6 · test". */
export function weekLabel(program: Program, week: number): string {
  const intent = weekIntent(program, week);
  return `Week ${week} of ${program.weeks}${intent === "LIGHT" ? " · light" : intent === "TEST" ? " · test" : ""}`;
}

// --- targets --------------------------------------------------------------------

export type TargetSet = { weight: number | null; reps: number; top?: boolean };
export type LastSet = { weight: number | null; reps: number | null };

/** Round to the nearest loadable weight: 5 lb, or 2.5 kg. */
export function roundLoad(w: number, unit: string): number {
  const step = unit === "kg" ? 2.5 : 5;
  return Math.round(w / step) * step;
}

/** The step a lift goes up by: 10 lb lower body, 5 lb otherwise (half in kg). */
export function stepFor(lower: boolean | undefined, unit: string): number {
  return unit === "kg" ? (lower ? 5 : 2.5) : lower ? 10 : 5;
}

/**
 * Each set's target for a planned movement on a program day.
 *
 *   WAVE   the week's sets at a share of the training max. No max given yet:
 *          reps only, and the weights come from last time ("the first week
 *          finds your numbers").
 *   RANGE  last time's weight; up a step once every set reached the top of the
 *          range, reps back to the bottom. Otherwise aim for one more rep.
 *   SAME   last time's weight; up a step once every set got every rep.
 *
 * A light week: one set fewer (at least 2) at 80%. A test week: work up to a
 * heavy 3, with the top set at the best weight lifted for 3+ reps, to beat.
 */
export function targetsFor(input: {
  program: Program;
  week: number;
  scheme: Scheme;
  unit: string;
  lower?: boolean;
  trainingMax?: number | null;
  last: readonly LastSet[];
  /** Heaviest weight lifted for 3 or more reps, for a test week. */
  bestForThree?: number | null;
}): TargetSet[] {
  const { program, week, scheme, unit, lower, trainingMax, last } = input;
  const intent = weekIntent(program, week);

  if (intent === "TEST") {
    const best = input.bestForThree ?? null;
    const at = (pct: number) => (best ? roundLoad(best * pct, unit) : null);
    return [
      { weight: at(0.5), reps: 5 },
      { weight: at(0.7), reps: 3 },
      { weight: at(0.85), reps: 3 },
      { weight: best, reps: 3, top: true },
    ];
  }

  if (scheme.kind === "WAVE") {
    const sets = program.wave?.[week - 1] ?? program.wave?.[0] ?? [];
    return sets.map((s, i) => ({
      weight: trainingMax ? roundLoad(trainingMax * s.pct, unit) : (last[i]?.weight ?? null),
      reps: s.reps,
      top: s.top,
    }));
  }

  const lastWeights = last.map((s) => s.weight).filter((w): w is number => w != null && w > 0);
  const lastWeight = lastWeights.length ? Math.max(...lastWeights) : null;
  const step = stepFor(lower, unit);
  let sets: number;
  let reps: number;
  let weight = lastWeight;

  if (scheme.kind === "RANGE") {
    sets = scheme.sets;
    const lastReps = last.map((s) => s.reps ?? 0);
    const allTop = last.length >= scheme.sets && lastReps.slice(0, scheme.sets).every((x) => x >= scheme.max);
    if (weight != null && allTop) {
      weight += step;
      reps = scheme.min;
    } else {
      const lowest = last.length ? Math.min(...lastReps.slice(0, scheme.sets)) : scheme.min - 1;
      reps = Math.min(scheme.max, Math.max(scheme.min, lowest + 1));
    }
  } else {
    sets = scheme.sets;
    reps = scheme.reps;
    const allDone = last.length >= scheme.sets && last.slice(0, scheme.sets).every((s) => (s.reps ?? 0) >= scheme.reps);
    if (weight != null && allDone) weight += step;
  }

  if (intent === "LIGHT") {
    sets = Math.max(2, sets - 1);
    weight = weight != null ? roundLoad(weight * 0.8, unit) : null;
  }
  return Array.from({ length: sets }, () => ({ weight, reps }));
}

/** Training max from a recent top weight: 90%, rounded to a loadable weight. */
export function trainingMaxFrom(top: number, unit: string): number {
  return roundLoad(top * 0.9, unit);
}

/** The end-of-block raise: one step per lift (10 lb lower, 5 lb upper). */
export function raisedMaxes(
  maxes: Record<string, number>,
  lowerIds: ReadonlySet<string>,
  unit: string,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [id, w] of Object.entries(maxes)) out[id] = w + stepFor(lowerIds.has(id), unit);
  return out;
}
