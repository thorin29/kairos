/**
 * The workouts file (v0.618): a person's weekly plan, their own named
 * workouts and, if they ask, everything they've logged, as one JSON file they
 * can keep, move to another household or bring back. The same shape is what
 * a shared household plan stores.
 *
 * Nothing in it is an id: movements and workouts go by name (and category),
 * so a file works in any household. Pure: build, check and plan an import.
 */
import { CATEGORY_LABEL, MUSCLE_GROUP_LABEL, type WorkoutType } from "@/lib/workouts/catalog";
import { nameKey } from "@/lib/workouts/library";
import { SECTION_KINDS } from "@/lib/workouts/blocks";

export const FILE_KIND = "kairos-workouts";
export const FILE_FORMAT = 1;

export type FileMovement = {
  name: string;
  category: string;
  muscleGroup: string | null;
  /** How it's logged in this plan (WEIGHT, REPS…); null = the movement's own. */
  metric: string | null;
  tracked: boolean;
  /** Set structure ("same:3x5", "range:3x8-12", "wave"); null = free. */
  scheme: string | null;
};

export type FilePlanEntry = {
  /** 0 = Sunday … 6 = Saturday. */
  day: number;
  name: string;
  category: string | null;
  muscleGroup: string | null;
  rest: boolean;
  /** A named workout, by name (one of `workouts`, or one the household has). */
  workout: string | null;
  /** A Warm-up's routine id ("lib:<key>" or the owner's own; v0.622). */
  warmup?: string | null;
  movements: FileMovement[];
};

export type FileWorkout = {
  name: string;
  type: WorkoutType;
  capSec: number | null;
  pyramidStart: number | null;
  pyramidEnd: number | null;
  pyramidStep: number | null;
  about: string | null;
  minutes: number | null;
  scaled: unknown;
  movements: { name: string; category: string; reps: number | null; distance: number | null; weight: number | null }[];
};

export type FileSet = {
  movement: string | null;
  weight: number | null;
  reps: number | null;
  seconds: number | null;
  distance: number | null;
  meters: number | null;
  unit: string | null;
};

export type FileSession = {
  date: string;
  name: string | null;
  category: string | null;
  type: string | null;
  rest: boolean;
  version: string | null;
  sets: FileSet[];
};

export type WorkoutsFile = {
  kind: typeof FILE_KIND;
  format: number;
  exportedAt: string;
  /** A name for the plan (a shared plan's, or the person's choice). */
  name: string | null;
  plan: FilePlanEntry[];
  /** The day page's section order: every day, and weekdays with their own. */
  order: { everyDay: string[]; days: Record<string, string[]> } | null;
  workouts: FileWorkout[];
  /** Everything logged, when asked for. Never imported. */
  history?: FileSession[];
};

const WORKOUT_TYPES: readonly string[] = [
  "AMRAP",
  "FOR_TIME",
  "MAX_SETS",
  "FOR_REPS",
  "STATIONS",
  "TIMED_STATIONS",
  "PYRAMID",
  "TABATA",
  "EMOM",
];
const METRICS: readonly string[] = ["WEIGHT", "DISTANCE", "METERS", "DURATION", "REPS"];
const CATEGORIES = Object.keys(CATEGORY_LABEL);
const GROUPS = Object.keys(MUSCLE_GROUP_LABEL);

const str = (v: unknown, max: number): string | null => {
  if (typeof v !== "string") return null;
  const s = v.trim().slice(0, max);
  return s.length ? s : null;
};
const num = (v: unknown, max: number): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) && n > 0 && n <= max ? Math.round(n * 100) / 100 : null;
};
const int = (v: unknown, max: number): number | null => {
  const n = num(v, max);
  return n == null ? null : Math.round(n);
};
const oneOf = (v: unknown, list: readonly string[]): string | null => (typeof v === "string" && list.includes(v) ? v : null);
const obj = (v: unknown): Record<string, unknown> | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null);
const arr = (v: unknown, max: number): unknown[] => (Array.isArray(v) ? v.slice(0, max) : []);

/** Scheme strings the plan understands; anything else is free. */
function cleanScheme(v: unknown): string | null {
  if (typeof v !== "string") return null;
  if (/^wave(:\d{4}-\d{2}-\d{2})?$/.test(v)) return "wave";
  if (/^same:\d{1,2}x\d{1,3}$/.test(v) || /^range:\d{1,2}x\d{1,3}-\d{1,3}$/.test(v)) return v;
  return null;
}

/**
 * Check a file someone hands in. Anything it doesn't recognise is left out
 * rather than refused; a file with nothing usable is refused.
 */
export function readWorkoutsFile(raw: unknown): { ok: true; file: WorkoutsFile } | { ok: false; error: string } {
  let data = raw;
  if (typeof raw === "string") {
    try {
      data = JSON.parse(raw);
    } catch {
      return { ok: false, error: "That isn't a workouts file." };
    }
  }
  const o = obj(data);
  if (!o || o.kind !== FILE_KIND) return { ok: false, error: "That isn't a workouts file." };
  if (typeof o.format !== "number" || o.format > FILE_FORMAT) {
    return { ok: false, error: "That file is from a newer Kairos. Update first." };
  }

  const movement = (m: unknown): FileMovement | null => {
    const x = obj(m);
    const name = str(x?.name, 60);
    const category = oneOf(x?.category, CATEGORIES);
    if (!x || !name || !category) return null;
    return {
      name,
      category,
      muscleGroup: oneOf(x.muscleGroup, GROUPS),
      metric: oneOf(x.metric, METRICS),
      tracked: x.tracked !== false,
      scheme: cleanScheme(x.scheme),
    };
  };

  const plan: FilePlanEntry[] = [];
  for (const e of arr(o.plan, 200)) {
    const x = obj(e);
    if (!x) continue;
    const day = typeof x.day === "number" && Number.isInteger(x.day) && x.day >= 0 && x.day <= 6 ? x.day : null;
    if (day == null) continue;
    const rest = x.rest === true;
    const name = str(x.name, 40) ?? (rest ? "Rest day" : null);
    if (!name) continue;
    plan.push({
      day,
      name,
      category: rest ? null : oneOf(x.category, CATEGORIES),
      muscleGroup: rest ? null : oneOf(x.muscleGroup, GROUPS),
      rest,
      workout: rest ? null : str(x.workout, 60),
      ...(str(x.warmup, 60) ? { warmup: str(x.warmup, 60) } : {}),
      movements: rest ? [] : arr(x.movements, 30).map(movement).filter((m): m is FileMovement => !!m),
    });
  }

  const workouts: FileWorkout[] = [];
  for (const w of arr(o.workouts, 200)) {
    const x = obj(w);
    const name = str(x?.name, 60);
    const type = oneOf(x?.type, WORKOUT_TYPES) as WorkoutType | null;
    if (!x || !name || !type) continue;
    const movements = arr(x.movements, 20)
      .map((m) => {
        const y = obj(m);
        const mn = str(y?.name, 60);
        if (!y || !mn) return null;
        return {
          name: mn,
          category: oneOf(y.category, CATEGORIES) ?? "HIIT",
          reps: int(y.reps, 10000),
          distance: num(y.distance, 1000),
          weight: num(y.weight, 2000),
        };
      })
      .filter((m): m is FileWorkout["movements"][number] => !!m);
    if (movements.length === 0) continue;
    workouts.push({
      name,
      type,
      capSec: int(x.capSec, 36000),
      pyramidStart: int(x.pyramidStart, 1000),
      pyramidEnd: int(x.pyramidEnd, 1000),
      pyramidStep: int(x.pyramidStep, 100),
      about: str(x.about, 600),
      minutes: int(x.minutes, 600),
      scaled: Array.isArray(x.scaled) ? x.scaled.slice(0, movements.length) : null,
      movements,
    });
  }

  let order: WorkoutsFile["order"] = null;
  const ord = obj(o.order);
  if (ord) {
    const clean = (v: unknown) => arr(v, 10).filter((k): k is string => typeof k === "string" && (SECTION_KINDS as readonly string[]).includes(k));
    const days: Record<string, string[]> = {};
    const d = obj(ord.days);
    if (d) for (const k of Object.keys(d)) if (/^[0-6]$/.test(k)) days[k] = clean(d[k]);
    order = { everyDay: clean(ord.everyDay), days };
  }

  if (plan.length === 0 && workouts.length === 0) return { ok: false, error: "There's no plan or workout in that file." };
  return {
    ok: true,
    file: {
      kind: FILE_KIND,
      format: FILE_FORMAT,
      exportedAt: str(o.exportedAt, 40) ?? "",
      name: str(o.name, 60),
      plan,
      order,
      workouts,
    },
  };
}

export type ImportPool = { id: string; name: string; category: string; ownerId: string | null }[];
export type ImportWorkouts = { id: string; name: string; ownerId: string | null; approved: boolean }[];

export type ImportPlan = {
  /** Movements to add to the person's own pool (not in the household's). */
  newMovements: { name: string; category: string; muscleGroup: string | null }[];
  /** Workouts to add as the person's own (no workout by that name to use). */
  newWorkouts: string[];
  /** Plan entries by weekday, and how many days have something. */
  entries: number;
  days: number;
};

/**
 * What importing would do, given what the household has and what the person
 * can use: movements matched by name (ignoring case, plurals and hyphens)
 * within their category, shared ones first; workouts by name among the
 * approved ones and the person's own.
 */
export function planImport(file: WorkoutsFile, pool: ImportPool, workouts: ImportWorkouts, userId: string): ImportPlan {
  const known = new Set(
    pool.filter((p) => p.ownerId == null || p.ownerId === userId).map((p) => `${p.category}|${nameKey(p.name)}`),
  );
  const newMovements: ImportPlan["newMovements"] = [];
  const add = (name: string, category: string, muscleGroup: string | null) => {
    const k = `${category}|${nameKey(name)}`;
    if (known.has(k)) return;
    known.add(k);
    newMovements.push({ name, category, muscleGroup });
  };
  // A workout movement matches in any category (Pull-up is a Weights
  // movement and a HIIT one); a new one goes under HIIT.
  const anyCat = new Set(pool.filter((p) => p.ownerId == null || p.ownerId === userId).map((p) => nameKey(p.name)));
  for (const e of file.plan) for (const m of e.movements) add(m.name, m.category, m.muscleGroup);
  const visible = new Set(
    workouts.filter((w) => w.approved || w.ownerId === userId).map((w) => nameKey(w.name)),
  );
  const newWorkouts: string[] = [];
  for (const w of file.workouts) {
    if (visible.has(nameKey(w.name))) continue;
    visible.add(nameKey(w.name));
    newWorkouts.push(w.name);
    for (const m of w.movements) {
      if (anyCat.has(nameKey(m.name))) continue;
      anyCat.add(nameKey(m.name));
      add(m.name, "HIIT", null);
    }
  }
  return {
    newMovements,
    newWorkouts,
    entries: file.plan.length,
    days: new Set(file.plan.filter((e) => !e.rest).map((e) => e.day)).size,
  };
}

const DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "Mon Chest · Wed Legs, Conditioning · Fri Back": a plan in a line. */
export function planSummary(plan: readonly FilePlanEntry[]): string {
  const byDay = new Map<number, string[]>();
  for (const e of plan) {
    if (e.rest) continue;
    byDay.set(e.day, [...(byDay.get(e.day) ?? []), e.name]);
  }
  return [...byDay.entries()]
    .sort((a, b) => ((a[0] + 6) % 7) - ((b[0] + 6) % 7))
    .map(([d, names]) => `${DAY[d]} ${[...new Set(names)].join(", ")}`)
    .join(" · ");
}

/** A file name for the download: "kairos-workouts-2026-11-02.json". */
export function fileNameFor(dateISO: string, name?: string | null): string {
  const slug = (name ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 30);
  return `kairos-workouts${slug ? `-${slug}` : ""}-${dateISO}.json`;
}
