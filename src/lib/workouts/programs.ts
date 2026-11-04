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
import type { Pattern } from "@/lib/workouts/library";

/** One set of a "work up to a top set" week: reps at a share of the training
 *  max; `plus` is a 5/3/1 "+" set, as many good reps as you can (v0.620). */
export type WaveSet = { reps: number; pct: number; top?: boolean; plus?: boolean };

/**
 * How a movement's sets are laid out (stored in PlannedExercise.scheme):
 *   wave            work up to a top set; reps and % of training max by program week
 *   wave:2026-11-02 the same in a plan built by hand (v0.615): the 4-week wave
 *                   counted from that day, week 4 light
 *   range:3x8-12    one weight; reps up to the top of the range (a program's own
 *                   main lift then goes up a step; anything else holds)
 *   same:3x5        one weight for every set (a program's main lift goes up once
 *                   all reps are done; anything else holds)
 */
export type Scheme =
  | { kind: "WAVE"; start?: string }
  | { kind: "RANGE"; sets: number; min: number; max: number }
  | { kind: "SAME"; sets: number; reps: number }
  /** Timed holds (v0.637): sets of `min`–`max` seconds — a plank, a hollow hold. */
  | { kind: "HOLD"; sets: number; min: number; max: number };

export function schemeKey(s: Scheme): string {
  if (s.kind === "WAVE") return s.start ? `wave:${s.start}` : "wave";
  if (s.kind === "RANGE") return `range:${s.sets}x${s.min}-${s.max}`;
  if (s.kind === "HOLD") return `hold:${s.sets}x${s.min}-${s.max}`;
  return `same:${s.sets}x${s.reps}`;
}

export function parseScheme(raw: string | null | undefined): Scheme | null {
  if (!raw) return null;
  if (raw === "wave") return { kind: "WAVE" };
  let m: RegExpExecArray | null = /^wave:(\d{4}-\d{2}-\d{2})$/.exec(raw);
  if (m) return { kind: "WAVE", start: m[1] };
  m = /^range:(\d+)x(\d+)-(\d+)$/.exec(raw);
  if (m) return { kind: "RANGE", sets: +m[1], min: +m[2], max: +m[3] };
  m = /^hold:(\d+)x(\d+)-(\d+)$/.exec(raw);
  if (m) return { kind: "HOLD", sets: +m[1], min: +m[2], max: +m[3] };
  m = /^same:(\d+)x(\d+)$/.exec(raw);
  if (m) return { kind: "SAME", sets: +m[1], reps: +m[2] };
  return null;
}

/** The set structures a hand-built plan can pick (key as stored, "" = any
 *  sets; "wave" starts a 4-week 5/3/1 wave on the day it's chosen). */
export const SCHEME_CHOICES: readonly { key: string; label: string }[] = [
  { key: "", label: "Any sets" },
  { key: "same:3x5", label: "3 × 5" },
  { key: "same:5x5", label: "5 × 5" },
  { key: "range:3x8-12", label: "3 × 8–12" },
  { key: "range:3x10-15", label: "3 × 10–15" },
  { key: "wave", label: "5/3/1 wave" },
];

/** The choice a stored scheme shows as ("wave:2026-11-02" → "wave"). */
export function schemeChoiceKey(raw: string | null | undefined): string {
  const s = parseScheme(raw);
  if (!s) return "";
  return s.kind === "WAVE" ? "wave" : schemeKey(s);
}

/** A scheme sent from a plan editor, ready to store: a known structure or
 *  null; "wave" keeps the wave already running, else starts one today. */
export function cleanPlanScheme(raw: unknown, todayISO: string, current?: string | null): string | null {
  if (typeof raw !== "string" || raw === "") return null;
  const s = parseScheme(raw);
  if (!s) return null;
  if (s.kind === "WAVE") {
    const cur = parseScheme(current);
    if (cur?.kind === "WAVE" && cur.start) return schemeKey(cur);
    return `wave:${s.start ?? todayISO}`;
  }
  if (s.sets < 1 || s.sets > 10) return null;
  if (s.kind === "RANGE" && !(s.min >= 1 && s.max >= s.min && s.max <= 50)) return null;
  if (s.kind === "SAME" && !(s.reps >= 1 && s.reps <= 50)) return null;
  if (s.kind === "HOLD" && !(s.min >= 5 && s.max >= s.min && s.max <= 600)) return null;
  return schemeKey(s);
}

/** "Work up to a top set", "3 × 8–12", "3 × 5". */
export function schemeLabel(s: Scheme): string {
  if (s.kind === "WAVE") return s.start ? "5/3/1 · work up to a top set" : "Work up to a top set";
  if (s.kind === "RANGE") return `${s.sets} × ${s.min}–${s.max}`;
  if (s.kind === "HOLD") return s.min === s.max ? `${s.sets} × ${clock(s.min)}` : `${s.sets} × ${clock(s.min)}–${clock(s.max)}`;
  return `${s.sets} × ${s.reps}`;
}

/** Seconds as m:ss ("0:45", "1:10"). */
export const clock = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, "0")}`;

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
  /** A companion slot's kind of movement (v0.624): its choices are movements
   *  of these patterns (and, with `groups`, these muscle groups), never the
   *  program's main lifts, plus library movements the household could add. */
  patterns?: Pattern[];
  groups?: MuscleGroup[];
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
  /** 5/3/1 warm-up sets before the main sets (v0.621): 40/50/60% × 5/5/3 of
   *  the training max. Not in a light week. */
  warmupSets?: boolean;
  /** 5/3/1 supplemental work after the main sets of the same lift (v0.620):
   *  FSL 5 × 5 at the first set's %, BBB 5 × 10 at 50%. Not in a light week. */
  supplemental?: "FSL" | "BBB";
};

const SQUAT = ["back squat", "squat", "front squat", "goblet squat"];
const BENCH = ["bench press", "bench", "dumbbell bench press", "incline bench press"];
const DEAD = ["deadlift", "trap bar deadlift", "sumo deadlift"];
const PRESS = ["overhead press", "shoulder press", "military press", "press", "dumbbell shoulder press"];
const ROW = ["bent over row", "barbell row", "dumbbell row", "row", "seated row"];
const PULL = ["pull-up", "pull up", "chin-up", "chin up", "lat pulldown"];
const CHIN = ["chin-up", "chin up", "pull-up", "pull up", "lat pulldown"];
const LUNGE = ["lunge", "dumbbell lunge", "walking lunge", "split squat", "bulgarian split squat", "step-up"];
const CURL = ["ez bar curl", "curl", "dumbbell curl", "barbell curl"];
const TRI = ["ez bar skull crusher", "skull crusher", "tricep extension", "dip"];
const CORE = ["plank", "sit-up", "sit up", "hanging knee raise"];
const DIP = ["dip", "bench dip", "push-up", "push up"];
const PUSH = ["push-up", "push up", "dip", "dumbbell bench press"];
const GOOD_MORNING = ["good morning", "back extension", "romanian deadlift"];
const LEG_RAISE = ["hanging leg raise", "hanging knee raise", "ab wheel", "ab rollout", "sit-up", "plank"];
const DB_BENCH = ["dumbbell bench press", "incline dumbbell press", "dumbbell incline bench press", "push-up"];
const DB_ROW = ["dumbbell row", "one arm dumbbell row", "bent over row", "barbell row"];
const LEG_PRESS = ["leg press", "bulgarian split squat", "split squat", "lunge", "dumbbell lunge"];
const LEG_CURL = ["leg curl", "hamstring curl", "glute ham raise", "nordic curl", "romanian deadlift"];
const SINGLE_LEG_CORE = [...LUNGE, ...LEG_RAISE];

const r = (sets: number, min: number, max: number): Scheme => ({ kind: "RANGE", sets, min, max });
const same = (sets: number, reps: number): Scheme => ({ kind: "SAME", sets, reps });
const WAVE: Scheme = { kind: "WAVE" };

/** Wendler's 5/3/1 weeks, as a share of the training max; the last set of
 *  weeks 1–3 is a "+" set. Week 4 is the deload. */
export const WAVE_531: WaveSet[][] = [
  [{ reps: 5, pct: 0.65 }, { reps: 5, pct: 0.75 }, { reps: 5, pct: 0.85, top: true, plus: true }],
  [{ reps: 3, pct: 0.7 }, { reps: 3, pct: 0.8 }, { reps: 3, pct: 0.9, top: true, plus: true }],
  [{ reps: 5, pct: 0.75 }, { reps: 3, pct: 0.85 }, { reps: 1, pct: 0.95, top: true, plus: true }],
  [{ reps: 5, pct: 0.4 }, { reps: 5, pct: 0.5 }, { reps: 5, pct: 0.6 }],
];

/** Wave loading: two waves of 3, 2, 1 in one session, the second a little
 *  heavier; each week a little heavier again; week 4 light. */
const waveWeek = (base: number): WaveSet[] => [
  { reps: 3, pct: base },
  { reps: 2, pct: base + 0.05 },
  { reps: 1, pct: base + 0.1 },
  { reps: 3, pct: base + 0.025 },
  { reps: 2, pct: base + 0.075 },
  { reps: 1, pct: base + 0.125, top: true },
];
const WAVE_LOADING: WaveSet[][] = [
  waveWeek(0.75),
  waveWeek(0.775),
  waveWeek(0.8),
  [{ reps: 5, pct: 0.4 }, { reps: 5, pct: 0.5 }, { reps: 5, pct: 0.6 }],
];

const main = (key: string, label: string, muscleGroup: MuscleGroup, match: string[], lower = false): ProgramRole => ({
  key,
  label,
  muscleGroup,
  match,
  scheme: WAVE,
  main: true,
  ...(lower ? { lower: true } : {}),
});
const extra = (
  key: string,
  label: string,
  muscleGroup: MuscleGroup,
  match: string[],
  scheme: Scheme,
  lower = false,
  patterns?: Pattern[],
  groups?: MuscleGroup[],
): ProgramRole => ({
  key,
  label,
  muscleGroup,
  match,
  scheme,
  optional: true,
  ...(lower ? { lower: true } : {}),
  ...(patterns ? { patterns } : {}),
  ...(groups ? { groups } : {}),
});
const HINGE_GROUPS: MuscleGroup[] = ["LEGS", "DEADLIFT", "BACK"];
const HAM_GROUPS: MuscleGroup[] = ["LEGS", "DEADLIFT"];

export const PROGRAMS: readonly Program[] = [
  {
    key: "wendler-531",
    warmupSets: true,
    name: "5/3/1",
    blurb:
      "Jim Wendler's original 5/3/1: four days, one main lift a day, with a + set to finish weeks 1–3 and a deload in week 4. " +
      "Two assistance lifts a day, 5 sets each (the Triumvirate).",
    weeks: 4,
    lightWeeks: [4],
    testWeeks: [],
    defaultDays: [1, 2, 4, 5],
    wave: WAVE_531,
    days: [
      {
        name: "Press day",
        roles: [
          main("press", "Press", "SHOULDERS", PRESS),
          extra("dip", "Push", "CHEST", DIP, same(5, 15), false, ["PUSH"]),
          extra("chin", "Pull", "BACK", CHIN, same(5, 10), false, ["PULL"]),
        ],
      },
      {
        name: "Deadlift day",
        roles: [
          main("deadlift", "Deadlift", "DEADLIFT", DEAD, true),
          extra("goodmorning", "Hinge", "DEADLIFT", GOOD_MORNING, same(5, 12), true, ["HINGE"], HINGE_GROUPS),
          extra("legraise", "Core", "CORE", LEG_RAISE, same(5, 15), false, ["CORE"]),
        ],
      },
      {
        name: "Bench day",
        roles: [
          main("bench", "Bench", "CHEST", BENCH),
          extra("dbbench", "Push", "CHEST", DB_BENCH, same(5, 15), false, ["PUSH"]),
          extra("dbrow", "Pull", "BACK", DB_ROW, same(5, 10), false, ["PULL"]),
        ],
      },
      {
        name: "Squat day",
        roles: [
          main("squat", "Squat", "LEGS", SQUAT, true),
          extra("legpress", "Legs", "LEGS", LEG_PRESS, same(5, 15), true, ["SQUAT"]),
          extra("legcurl", "Hamstrings", "LEGS", LEG_CURL, same(5, 10), true, ["HINGE"], HAM_GROUPS),
        ],
      },
    ],
  },
  {
    key: "wendler-bbb",
    warmupSets: true,
    name: "Boring But Big",
    blurb:
      "5/3/1 with 5 sets of 10 of the same lift at 50% after the main sets, then one assistance lift. " +
      "Four days, a + set to finish weeks 1–3, deload in week 4.",
    weeks: 4,
    lightWeeks: [4],
    testWeeks: [],
    defaultDays: [1, 2, 4, 5],
    wave: WAVE_531,
    supplemental: "BBB",
    days: [
      { name: "Press day", roles: [main("press", "Press", "SHOULDERS", PRESS), extra("chin", "Pull", "BACK", CHIN, same(5, 10), false, ["PULL"])] },
      {
        name: "Deadlift day",
        roles: [main("deadlift", "Deadlift", "DEADLIFT", DEAD, true), extra("legraise", "Core", "CORE", LEG_RAISE, same(5, 15), false, ["CORE"])],
      },
      { name: "Bench day", roles: [main("bench", "Bench", "CHEST", BENCH), extra("dbrow", "Pull", "BACK", DB_ROW, same(5, 10), false, ["PULL"])] },
      {
        name: "Squat day",
        roles: [main("squat", "Squat", "LEGS", SQUAT, true), extra("legcurl", "Hamstrings", "LEGS", LEG_CURL, same(5, 10), true, ["HINGE"], HAM_GROUPS)],
      },
    ],
  },
  {
    key: "wendler-beginners",
    warmupSets: true,
    name: "5/3/1 for Beginners",
    blurb:
      "Three days, two main lifts a day, each with a + set and then 5 × 5 at the first set's weight (First Set Last). " +
      "3-week cycles with no deload. 50–100 reps each of push, pull and single-leg or core.",
    weeks: 3,
    lightWeeks: [],
    testWeeks: [],
    defaultDays: [1, 3, 5],
    wave: WAVE_531.slice(0, 3),
    supplemental: "FSL",
    days: [
      {
        name: "Day 1",
        roles: [
          main("squat", "Squat", "LEGS", SQUAT, true),
          main("bench", "Bench", "CHEST", BENCH),
          extra("push", "Push", "CHEST", PUSH, r(5, 10, 20), false, ["PUSH"]),
          extra("pull", "Pull", "BACK", PULL, r(5, 10, 20), false, ["PULL"]),
          extra("legcore", "Single leg or core", "CORE", SINGLE_LEG_CORE, r(5, 10, 20), false, ["SQUAT", "CORE"]),
        ],
      },
      {
        name: "Day 2",
        roles: [
          main("deadlift", "Deadlift", "DEADLIFT", DEAD, true),
          main("press", "Press", "SHOULDERS", PRESS),
          extra("push", "Push", "CHEST", PUSH, r(5, 10, 20), false, ["PUSH"]),
          extra("pull", "Pull", "BACK", ROW, r(5, 10, 20), false, ["PULL"]),
          extra("legcore", "Single leg or core", "LEGS", SINGLE_LEG_CORE, r(5, 10, 20), true, ["SQUAT", "CORE"]),
        ],
      },
      {
        name: "Day 3",
        roles: [
          main("bench", "Bench", "CHEST", BENCH),
          main("squat", "Squat", "LEGS", SQUAT, true),
          extra("push", "Push", "CHEST", PUSH, r(5, 10, 20), false, ["PUSH"]),
          extra("pull", "Pull", "BACK", PULL, r(5, 10, 20), false, ["PULL"]),
          extra("legcore", "Single leg or core", "CORE", SINGLE_LEG_CORE, r(5, 10, 20), false, ["SQUAT", "CORE"]),
        ],
      },
    ],
  },
  {
    key: "wave-loading",
    warmupSets: true,
    name: "Wave loading",
    blurb:
      "Four main lifts, one a day, as two waves of 3, 2 and 1 reps, the second wave a little heavier. " +
      "Each week heavier again, week 4 light. Rows, curls and core as sets of 8–12.",
    weeks: 4,
    lightWeeks: [4],
    testWeeks: [],
    defaultDays: [1, 2, 4, 5],
    wave: WAVE_LOADING,
    days: [
      {
        name: "Squat day",
        roles: [
          main("squat", "Squat", "LEGS", SQUAT, true),
          extra("lunge", "Single leg", "LEGS", LUNGE, r(3, 8, 12), true, ["SQUAT"]),
          extra("core", "Core", "CORE", CORE, r(3, 8, 12), false, ["CORE"]),
        ],
      },
      {
        name: "Bench day",
        roles: [
          main("bench", "Bench", "CHEST", BENCH),
          extra("row", "Row", "BACK", ROW, r(3, 8, 12), false, ["PULL"]),
          extra("tri", "Triceps", "ARMS", TRI, r(3, 8, 12)),
        ],
      },
      {
        name: "Deadlift day",
        roles: [
          main("deadlift", "Deadlift", "DEADLIFT", DEAD, true),
          extra("pull", "Pull", "BACK", PULL, r(3, 6, 10), false, ["PULL"]),
          extra("core", "Core", "CORE", CORE, r(3, 8, 12), false, ["CORE"]),
        ],
      },
      {
        name: "Press day",
        roles: [
          main("press", "Press", "SHOULDERS", PRESS),
          extra("row", "Row", "BACK", ROW, r(3, 8, 12), false, ["PULL"]),
          extra("curl", "Curl", "ARMS", CURL, r(3, 8, 12)),
        ],
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
          { key: "deadlift", label: "Hinge", muscleGroup: "DEADLIFT", match: DEAD, scheme: r(3, 8, 12), lower: true },
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
          { key: "deadlift", label: "Hinge", muscleGroup: "DEADLIFT", match: DEAD, scheme: same(3, 5), lower: true },
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
    blurb: "Three short days, two sets of 10–15 on a few movements, and an easy row on day B. Easy to start and easy to keep.",
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
          { key: "deadlift", label: "Hinge", muscleGroup: "DEADLIFT", match: DEAD, scheme: r(2, 8, 12), lower: true },
          { key: "press", label: "Press", muscleGroup: "SHOULDERS", match: PRESS, scheme: r(2, 8, 12) },
          { key: "core", label: "Core", muscleGroup: "CORE", match: CORE, scheme: r(2, 8, 12), optional: true },
        ],
      },
    ],
  },
];

/** Programs renamed since they were started (a running one keeps working). */
const RENAMED: Record<string, string> = { "strength-waves": "wendler-531" };

/** The 5/3/1 wave on its own, for a movement given a wave in a plan built by
 *  hand: the four weeks (week 4 light, no + sets), counted from the day the
 *  wave was chosen. */
export const HAND_WAVE: Program = {
  key: "",
  name: "5/3/1",
  blurb: "",
  weeks: 4,
  lightWeeks: [4],
  testWeeks: [],
  defaultDays: [],
  days: [],
  wave: WAVE_531.map((w) => w.map(({ plus: _plus, ...s }) => s)),
};

export function programByKey(key: string | null | undefined): Program | null {
  const k = key ? (RENAMED[key] ?? key) : key;
  return PROGRAMS.find((p) => p.key === k) ?? null;
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

/** A set to aim for; `pct` is its share of the training max on a 5/3/1 set,
 *  shown under the set number (v0.619). */
export type TargetSet = {
  weight: number | null;
  reps: number;
  top?: boolean;
  pct?: number;
  plus?: boolean;
  /** A warm-up set before the main sets (v0.621). */
  warmup?: boolean;
  /** A supplemental set after them, BBB or FSL (v0.623). */
  supplemental?: boolean;
  /** A timed hold's target, seconds (v0.637); reps is 0 then. */
  seconds?: number;
};
export type LastSet = { weight: number | null; reps: number | null; seconds?: number | null };

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
 *   RANGE  the weight done for these reps last time; aim for one more rep than
 *          the lowest set, up to the top.
 *   SAME   the weight done for these reps last time.
 *   The weight holds until the person changes it, except a program's own main
 *   lift (`progress`), which steps up once every set got every rep.
 *   Either, after heavier lower-rep work: what that allows for these reps.
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
  /** A program's own main lift on a rep scheme (Sets of ten, Full body): the
   *  weight steps up once every set got every rep, as the program says. Off,
   *  the weight holds until the person changes it (companion lifts, own plans). */
  progress?: boolean;
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

  if (scheme.kind === "HOLD") {
    // Timed holds: five seconds past last time's shortest hold, within the
    // range; no light or test weeks (v0.637).
    const held = last.map((s) => s.seconds ?? 0).filter((x) => x > 0).slice(0, scheme.sets);
    const shortest = held.length ? Math.min(...held) : scheme.min - 5;
    const seconds = Math.min(scheme.max, Math.max(scheme.min, shortest + 5));
    return Array.from({ length: scheme.sets }, () => ({ weight: null, reps: 0, seconds }));
  }

  if (scheme.kind === "WAVE") {
    const main = program.wave?.[week - 1] ?? program.wave?.[0] ?? [];
    const warm: (WaveSet & { warmup?: boolean })[] =
      intent === "LIGHT" || !program.warmupSets || main.length === 0
        ? []
        : [
            { reps: 5, pct: 0.4, warmup: true },
            { reps: 5, pct: 0.5, warmup: true },
            { reps: 3, pct: 0.6, warmup: true },
          ];
    const extra: (WaveSet & { supplemental?: boolean })[] =
      intent === "LIGHT" || !program.supplemental || main.length === 0
        ? []
        : program.supplemental === "FSL"
          ? Array.from({ length: 5 }, () => ({ reps: 5, pct: main[0].pct, supplemental: true }))
          : Array.from({ length: 5 }, () => ({ reps: 10, pct: 0.5, supplemental: true }));
    return [...warm, ...main, ...extra].map((s: WaveSet & { warmup?: boolean; supplemental?: boolean }, i) => ({
      weight: trainingMax ? roundLoad(trainingMax * s.pct, unit) : (last[i]?.weight ?? null),
      reps: s.reps,
      top: s.top,
      pct: s.pct,
      ...(s.plus ? { plus: true } : {}),
      ...(s.warmup ? { warmup: true } : {}),
      ...(s.supplemental ? { supplemental: true } : {}),
    }));
  }

  // The weight comes from what last time says about these reps (v0.627): the
  // weight already done for them holds until the person changes it (no step
  // up by itself). When last time was heavier and lower-rep (a 165 × 3, a new
  // best), what that strength allows for this many sets of these reps
  // (weightForReps), if that's more. Never last time's top weight for 3 × as many reps.
  const aimReps = scheme.kind === "RANGE" ? scheme.min : scheme.reps;
  const proven = last
    .filter((s) => s.weight != null && s.weight > 0 && (s.reps ?? 0) >= aimReps)
    .map((s) => s.weight as number);
  let weight: number | null = proven.length ? Math.max(...proven) : null;
  const estimate = weightForReps(last, aimReps, unit, scheme.sets);
  if (estimate != null && (weight == null || estimate > weight)) weight = estimate;
  let sets = scheme.sets;
  let reps: number;
  const lastReps = last.map((s) => s.reps ?? 0).slice(0, scheme.sets);
  const step = stepFor(lower, unit);
  if (scheme.kind === "RANGE") {
    // A rep range: aim for one more rep than last time's lowest set, up to the
    // top; a program's main lift then steps up and starts the range again.
    const allTop = lastReps.length >= scheme.sets && lastReps.every((x) => x >= scheme.max);
    if (input.progress && weight != null && allTop) {
      weight += step;
      reps = scheme.min;
    } else {
      const lowest = lastReps.length ? Math.min(...lastReps) : scheme.min - 1;
      reps = Math.min(scheme.max, Math.max(scheme.min, lowest + 1));
    }
  } else {
    reps = scheme.reps;
    const allDone = lastReps.length >= scheme.sets && lastReps.every((x) => x >= scheme.reps);
    if (input.progress && weight != null && allDone) weight += step;
  }

  if (intent === "LIGHT") {
    sets = Math.max(2, sets - 1);
    weight = weight != null ? roundLoad(weight * 0.8, unit) : null;
  }
  return Array.from({ length: sets }, () => ({ weight, reps }));
}

/**
 * A weight for `setCount` sets of `reps`, from the best set in `sets`
 * (v0.632, v0.633). Its estimated max (Epley: weight × (1 + reps / 30)) gives the most
 * you could do once for these reps (max ÷ (1 + reps / 30)); every set after
 * the first costs a little more, so that's taken down 5% a set (to at most
 * 30% off; v0.633, 4% asked a little too much), then rounded down to a
 * loadable weight. From 165 × 3: 100 for 5 × 10 (about 55% of the max), 115
 * for 3 × 10, 115 for 5 × 5. Null with nothing to go by.
 */
export function weightForReps(sets: readonly LastSet[], reps: number, unit: string, setCount = 1): number | null {
  let max = 0;
  for (const s of sets) {
    if (!s.weight || s.weight <= 0 || !s.reps || s.reps <= 0) continue;
    max = Math.max(max, s.weight * (1 + Math.min(s.reps, 12) / 30));
  }
  if (max <= 0) return null;
  const inc = unit === "kg" ? 2.5 : 5;
  const volume = Math.max(0.7, 1 - 0.05 * Math.max(1, setCount));
  const w = Math.floor((max / (1 + reps / 30)) * volume / inc) * inc;
  return w > 0 ? w : null;
}

/** Training max from a recent top weight: 90%, rounded to a loadable weight. */
export function trainingMaxFrom(top: number, unit: string): number {
  return roundLoad(top * 0.9, unit);
}

/** The end-of-block raise: one step per lift (10 lb lower, 5 lb upper).
 *  The default for each lift on the end-of-cycle pop-up. */
export function raisedMaxes(
  maxes: Record<string, number>,
  lowerIds: ReadonlySet<string>,
  unit: string,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [id, w] of Object.entries(maxes)) out[id] = w + stepFor(lowerIds.has(id), unit);
  return out;
}
