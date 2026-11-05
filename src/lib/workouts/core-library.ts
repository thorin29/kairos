/**
 * Core days (v0.637): ready-made core workouts, a person's own, and the
 * rotation a Core plan entry runs through. Pure — core-run.ts does the
 * database work.
 *
 * Each workout covers the core's jobs (research summary in DECISIONS.md):
 * resisting arching (fallouts, hollow holds), resisting twisting (Pallof
 * press, one-sided carries), resisting side-bending (side plank, suitcase
 * carry), bending forward under load (leg raises, crunches) and rotating
 * with power (med-ball throws, slams). Every movement says how it's logged:
 * reps, a timed hold, or a weight with reps. A carry's "reps" are yards walked.
 *
 * The Marine Corps PFT plank (1:10 to pass, 3:45 for full marks) is the
 * monthly test: done first, fresh, on the first core day of the month, and
 * the week's workout follows as usual.
 */
import { LIBRARY, nameKey } from "@/lib/workouts/library";
import { PFT_PLANK_MAX_SEC, PFT_PLANK_MIN_SEC } from "@/lib/workouts/heat";

/** How a movement is logged in a core workout. */
export type CoreKind = "REPS" | "TIME" | "WEIGHT";
export const CORE_KINDS: readonly CoreKind[] = ["REPS", "TIME", "WEIGHT"];
export const CORE_KIND_LABEL: Record<CoreKind, string> = { REPS: "Reps", TIME: "Hold", WEIGHT: "Weight" };

export type CoreMove = {
  name: string;
  /** A person's own workout points at their pool movement. */
  poolExerciseId?: string | null;
  kind: CoreKind;
  sets: number;
  /** Reps (REPS, WEIGHT) or seconds (TIME). */
  min: number;
  max: number;
};

export type CoreWorkout = {
  /** "lib:<key>" for the library's, else the person's own id. */
  id: string;
  name: string;
  minutes: number;
  /** "No equipment", "Pull-up bar"… */
  gear: string;
  moves: CoreMove[];
  mine: boolean;
};

export const CORE_LIB_PREFIX = "lib:";

type M = [name: string, kind: CoreKind, sets: number, min: number, max: number];
const moves = (list: M[]): CoreMove[] => list.map(([name, kind, sets, min, max]) => ({ name, kind, sets, min, max }));
const lib = (key: string, name: string, minutes: number, gear: string, list: M[]): CoreWorkout => ({
  id: CORE_LIB_PREFIX + key,
  name,
  minutes,
  gear,
  moves: moves(list),
  mine: false,
});

export const CORE_LIBRARY: readonly CoreWorkout[] = [
  lib("strength", "Core strength", 25, "TRX, kettlebell, pull-up bar, back extension chair", [
    ["TRX fallout", "REPS", 3, 8, 12],
    ["Hanging leg raise", "REPS", 3, 8, 12],
    ["Suitcase carry", "WEIGHT", 4, 40, 40],
    ["Side plank", "TIME", 4, 30, 60],
    ["Weighted back extension", "WEIGHT", 3, 8, 12],
  ]),
  lib("rotation", "Rotation and power", 20, "Med ball, slam ball, TRX, kettlebell", [
    ["Rotational throw", "REPS", 4, 6, 8],
    ["Rotational slam", "REPS", 3, 8, 10],
    ["TRX Pallof press", "REPS", 3, 10, 12],
    ["Kettlebell windmill", "WEIGHT", 3, 5, 8],
    ["TRX pike", "REPS", 3, 8, 12],
  ]),
  lib("bodyweight", "Bodyweight core", 15, "No equipment", [
    ["Reverse crunch", "REPS", 3, 12, 15],
    ["Bicycle crunch", "REPS", 3, 20, 30],
    ["V-up", "REPS", 3, 8, 12],
    ["Flutter kick", "REPS", 3, 20, 30],
    ["Hollow hold", "TIME", 3, 20, 40],
    ["Side plank", "TIME", 2, 30, 45],
  ]),
  lib("hanging", "Hanging core", 15, "Pull-up bar", [
    ["Hanging knee raise", "REPS", 3, 10, 15],
    ["Hanging leg raise", "REPS", 3, 6, 10],
    ["Toes-to-bar", "REPS", 3, 5, 8],
    ["Hollow hold", "TIME", 3, 30, 45],
  ]),
  lib("kettlebell", "Kettlebell core", 20, "Kettlebells", [
    ["Turkish get-up", "WEIGHT", 3, 2, 3],
    ["Kettlebell windmill", "WEIGHT", 3, 5, 8],
    ["Overhead carry", "WEIGHT", 4, 40, 40],
    ["Suitcase carry", "WEIGHT", 4, 40, 40],
  ]),
  lib("situps", "Sit-up and crunch circuit", 12, "No equipment", [
    ["Sit-up", "REPS", 3, 20, 25],
    ["Crunch", "REPS", 3, 20, 30],
    ["Reverse crunch", "REPS", 3, 15, 20],
    ["Bicycle crunch", "REPS", 3, 20, 30],
    ["Dead bug", "REPS", 3, 12, 16],
  ]),
  lib("slam-clubs", "Slam ball and clubs", 15, "Slam ball, clubs", [
    ["Rotational slam", "REPS", 3, 8, 10],
    ["Ball slam", "REPS", 3, 10, 15],
    ["Club swipe", "WEIGHT", 3, 8, 10],
    ["Russian twist", "REPS", 3, 20, 30],
  ]),
  lib("mcgill", "McGill Big 3", 10, "No equipment", [
    ["McGill curl-up", "REPS", 3, 5, 6],
    ["Side plank", "TIME", 4, 10, 30],
    ["Bird dog", "REPS", 3, 5, 6],
  ]),
];

export function libraryCoreWorkout(id: string | null | undefined): CoreWorkout | null {
  return CORE_LIBRARY.find((w) => w.id === id) ?? null;
}

/** The monthly test: one max plank, scored on the PFT. */
export const PLANK_TEST: CoreMove = {
  name: "Plank",
  kind: "TIME",
  sets: 1,
  min: PFT_PLANK_MIN_SEC,
  max: PFT_PLANK_MAX_SEC,
};

/** The library entry for a movement name, for adding it to the pool. */
export function libraryKeyFor(name: string): string | null {
  const k = nameKey(name);
  return LIBRARY.find((e) => nameKey(e.name) === k)?.key ?? null;
}

/** A move's set scheme, as plan entries store it (programs.ts). */
export function coreScheme(m: CoreMove): string {
  if (m.kind === "TIME") return `hold:${m.sets}x${m.min}-${m.max}`;
  return m.min === m.max ? `same:${m.sets}x${m.min}` : `range:${m.sets}x${m.min}-${m.max}`;
}

export function coreMetric(m: CoreMove): "REPS" | "DURATION" | "WEIGHT" {
  return m.kind === "TIME" ? "DURATION" : m.kind;
}

const clock = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;

/**
 * A movement done one side at a time, a set per side (v0.642): a side plank,
 * a one-handed carry. Its sets come in pairs, so both sides get the same
 * work, and its timer switches sides.
 */
export const switchesSides = (name: string) =>
  /side plank|suitcase|overhead carry|waiter|single[- ]arm|one[- ]arm|copenhagen/i.test(name);

/** "3 × 8–12", "3 × 0:30–0:45", "1 × 1:10–3:45", "3 × 40 yd" (a carry). */
export function coreMoveLabel(m: CoreMove): string {
  const f = m.kind === "TIME" ? clock : String;
  const base = m.min === m.max ? `${m.sets} × ${f(m.min)}` : `${m.sets} × ${f(m.min)}–${f(m.max)}`;
  return m.kind === "WEIGHT" && /\bcarry\b|farmer/i.test(m.name) ? `${base} yd` : base;
}

/** Clean moves sent from an editor: known kinds, sane numbers, at most 12. */
export function cleanCoreMoves(raw: unknown): CoreMove[] {
  if (!Array.isArray(raw)) return [];
  const out: CoreMove[] = [];
  for (const r of raw.slice(0, 12)) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    const name = typeof o.name === "string" ? o.name.trim().slice(0, 60) : "";
    const kind = CORE_KINDS.includes(o.kind as CoreKind) ? (o.kind as CoreKind) : null;
    const int = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.round(v) : NaN);
    const sets = int(o.sets);
    let min = int(o.min);
    let max = int(o.max);
    if (!name || !kind || !(sets >= 1 && sets <= 10)) continue;
    if (!(min >= 1)) continue;
    if (!(max >= min)) max = min;
    const cap = kind === "TIME" ? 600 : 100;
    if (min > cap || max > cap) continue;
    if (kind === "TIME" && min < 5) min = 5;
    out.push({
      name,
      kind,
      // A set per side: always pairs.
      sets: switchesSides(name) && sets % 2 === 1 ? Math.min(10, sets + 1) : sets,
      min,
      max: Math.max(min, max),
      poolExerciseId: typeof o.poolExerciseId === "string" && o.poolExerciseId ? o.poolExerciseId : null,
    });
  }
  return out;
}

/** A Core plan entry's rotation and where it is. */
export type CoreDay = {
  /** Workout ids in order ("lib:<key>" or the person's own). */
  rotation: string[];
  /** The monthly plank test on the first core day of the month. */
  test: boolean;
  /** Position in the rotation of the workout now planned. */
  at: number;
  /** The day the current workout was put in place (YYYY-MM-DD). */
  since: string;
  /** The month ("YYYY-MM") the plank test was last done. */
  testedMonth: string | null;
  /** Whether the current plan includes the test. */
  withTest: boolean;
  /** 2 once stored by v0.644+ (moves on a week after the log, not the day after). */
  v?: number;
};

export function cleanCoreDay(raw: unknown, todayISO: string): CoreDay | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const rotation = Array.isArray(o.rotation)
    ? [...new Set(o.rotation.filter((x): x is string => typeof x === "string" && !!x))].slice(0, 12)
    : [];
  if (rotation.length === 0) return null;
  const at = typeof o.at === "number" && Number.isInteger(o.at) && o.at >= 0 ? o.at % rotation.length : 0;
  const iso = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
  return {
    rotation,
    test: o.test !== false,
    at,
    since: iso(o.since) ?? todayISO,
    testedMonth: typeof o.testedMonth === "string" && /^\d{4}-\d{2}$/.test(o.testedMonth) ? o.testedMonth : null,
    withTest: o.withTest === true,
    ...(o.v === 2 ? { v: 2 } : {}),
  };
}

/** The ISO day `n` days after `iso`. */
export function plusDays(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * Move a core day on (v0.637). The workout in place moves to the next on
 * the next core day after it was logged (v0.644 — a week later; it used to be
 * the day after, which left the logged day showing a workout not done), so a
 * missed week repeats it rather than skipping it.
 * The plank test goes in on the first core day of a month it wasn't done.
 *
 * `loggedOn`: days (before today or not) its movements were logged on, since
 * it was put in place.
 */
export function stepCoreDay(day: CoreDay, loggedOn: readonly string[], todayISO: string): CoreDay {
  let next = { ...day };
  // A log moves the rotation on when its weekday comes round again (v0.644):
  // until then the day it was logged keeps showing the workout that was done.
  const done = loggedOn.filter((d) => d >= day.since && plusDays(d, 7) <= todayISO).sort();
  if (done.length > 0) {
    const when = done[0];
    next = {
      ...next,
      at: (day.at + 1) % day.rotation.length,
      since: plusDays(when, 7),
      testedMonth: day.withTest ? when.slice(0, 7) : day.testedMonth,
    };
  }
  next.at = next.at % next.rotation.length;
  next.withTest = next.test && next.testedMonth !== todayISO.slice(0, 7);
  return next;
}

/** The moves a core day plans: the test first when it's due, each movement once. */
export function coreDayMoves(workout: CoreWorkout | null, withTest: boolean): CoreMove[] {
  const out: CoreMove[] = [];
  const seen = new Set<string>();
  for (const m of [...(withTest ? [PLANK_TEST] : []), ...(workout?.moves ?? [])]) {
    const k = m.poolExerciseId ?? nameKey(m.name);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(m);
  }
  return out;
}

/** The plan entry's name: "Core · Hanging core". */
export const coreDayName = (workout: CoreWorkout | null) => (workout ? `Core · ${workout.name}`.slice(0, 40) : "Core");
