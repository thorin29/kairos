/**
 * Warm-up routines (v0.622): what a Warm-up plan can hold besides a plain
 * check. A routine is a list of steps, each reps (text, nothing logged) or a
 * timed hold (a plain count-up timer on the day). Pure: the library below,
 * and reading a routine sent from a client. The 5/3/1 warm-up sets belong to
 * the lift (programs.ts), not here.
 */

export type WarmupStep = {
  name: string;
  kind: "REPS" | "TIME";
  /** REPS: "10–15", "3 × 3", "10 each way". */
  amount?: string;
  /** TIME: how long to hold, in seconds. */
  seconds?: number;
  /** Done on each side (a stretch, a lunge). */
  sides?: boolean;
};

/** What a warm-up readies you for (v0.655), for "Match the day". */
export type WarmupFocus = "lower" | "hinge" | "push" | "pull" | "core" | "arms" | "hockey" | "full";

export type WarmupRoutineDef = { key: string; name: string; steps: WarmupStep[]; focus?: WarmupFocus[] };

/** A routine a plan or client sees: a library one ("lib:<key>") or the
 *  person's own (its id). */
export type WarmupRoutine = { id: string; name: string; steps: WarmupStep[]; mine: boolean };

const reps = (name: string, amount: string, sides = false): WarmupStep => ({ name, kind: "REPS", amount, ...(sides ? { sides } : {}) });
const hold = (name: string, seconds: number, sides = false): WarmupStep => ({ name, kind: "TIME", seconds, ...(sides ? { sides } : {}) });

/**
 * Ready-made routines. Jumps and throws follows Wendler: 10–15 fast, full
 * jumps or throws before the main work, stopping when they slow down.
 */
export const WARMUP_LIBRARY: readonly WarmupRoutineDef[] = [
  {
    key: "jumps-throws",
    name: "Jumps and throws (5/3/1)",
    steps: [
      hold("Jump rope", 120),
      reps("Box jumps or broad jumps", "5 × 3"),
      reps("Medicine ball throws", "5 × 3"),
    ],
  },
  {
    key: "hips-shoulders",
    name: "Hips and shoulders",
    steps: [
      reps("Leg swings", "10", true),
      hold("Hip flexor stretch", 30, true),
      hold("Frog stretch", 30),
      reps("World's greatest stretch", "5", true),
      reps("Bodyweight squats", "10–15"),
      reps("Band pull-aparts", "15"),
      reps("Arm circles", "10 each way"),
      reps("Push-ups", "10"),
    ],
  },
  {
    key: "quick-five",
    name: "Quick 5 minutes",
    steps: [
      hold("Jumping jacks", 60),
      reps("Arm circles", "10 each way"),
      reps("Bodyweight squats", "10"),
      reps("Walking lunges", "5", true),
      reps("Push-ups", "10"),
      hold("Plank", 30),
    ],
  },
  {
    key: "lower-body",
    name: "Lower body",
    steps: [
      hold("Bike or row, easy", 180),
      reps("Glute bridges", "10–15"),
      hold("Couch stretch", 30, true),
      reps("Cossack squats", "5", true),
      reps("Bodyweight squats", "10–15"),
      reps("Back extensions", "10–15"),
    ],
  },
  // v0.655: one per kind of day, no weights, 6–8 minutes.
  {
    key: "squat-legs",
    name: "Squat and legs",
    focus: ["lower"],
    steps: [
      reps("Leg swings, front to back", "10", true),
      reps("Leg swings, side to side", "10", true),
      reps("Hip circles", "10 each way"),
      hold("Kneeling lunge stretch", 30, true),
      reps("Cossack squats", "6", true),
      reps("Glute bridges", "15"),
      reps("Bodyweight squats", "15"),
      reps("Walking lunges", "10", true),
      reps("Calf raises", "15"),
    ],
  },
  {
    key: "deadlift-back",
    name: "Deadlift and back",
    focus: ["hinge"],
    steps: [
      reps("Cat-cow", "10"),
      reps("Bird dogs", "8", true),
      reps("Hip hinge drill", "15"),
      reps("Glute bridges", "15"),
      reps("Single-leg RDL, no weight", "8", true),
      reps("Inchworms", "6"),
      reps("Back extensions", "15"),
      reps("Dead bugs", "10"),
    ],
  },
  {
    key: "upper-push",
    name: "Upper push",
    focus: ["push"],
    steps: [
      reps("Arm circles", "10 each way"),
      reps("Thoracic open-books", "8", true),
      reps("Wall slides", "10"),
      reps("Push-up to down dog", "8"),
      reps("Push-ups", "10–15"),
      reps("Tricep dips", "10"),
      hold("Front plank", 30),
    ],
  },
  {
    key: "upper-pull",
    name: "Upper pull",
    focus: ["pull"],
    steps: [
      hold("Dead hang", 30),
      reps("Scap pull-ups", "10"),
      reps("TRX rows", "12"),
      reps("Cat-cow", "10"),
      reps("Thoracic rotations", "8", true),
      reps("Chin-ups", "5"),
    ],
  },
  {
    key: "core-day",
    name: "Core day",
    focus: ["core"],
    steps: [
      reps("Cat-cow", "10"),
      reps("Dead bugs", "10"),
      reps("Bird dogs", "8", true),
      hold("Hollow hold", 20),
      hold("Side plank", 20, true),
      reps("Glute bridges", "15"),
      reps("Hip circles", "10 each way"),
    ],
  },
  {
    key: "arms-day",
    name: "Arms day",
    focus: ["arms"],
    steps: [
      reps("Arm circles", "10 each way"),
      reps("Wrist circles", "10 each way"),
      hold("Forearm stretch", 30, true),
      reps("Push-ups", "10"),
      reps("TRX curls", "10"),
      reps("Diamond push-ups", "8"),
      reps("Tricep dips", "10"),
      hold("Dead hang", 20),
    ],
  },
  {
    key: "hockey-legs",
    name: "Hockey legs",
    focus: ["hockey", "lower"],
    steps: [
      reps("Hip airplanes", "5", true),
      reps("Lateral lunges", "8", true),
      hold("Groin stretch", 30),
      reps("Skater hops", "10", true),
      reps("Glute bridges", "15"),
      hold("Front plank", 30),
    ],
  },
];

/**
 * Shoulder prep (v0.655): added to the warm-up on any day with weights, unless
 * the warm-up already has rotator cuff work. 90/90 rotation with a light
 * dumbbell works the cuff against gravity; at the side it takes a band. Three
 * sets of moves take turns, a different one each day (v0.658); the first is
 * SHOULDER_PREP.
 */
export const SHOULDER_PREPS: readonly (readonly WarmupStep[])[] = [
  [
    reps("90/90 external rotation, 2–5 lb", "12", true),
    reps("Band external rotation, elbow at side", "12", true),
    reps("Band pull-aparts", "15"),
    reps("Scap push-ups", "12"),
  ],
  [
    reps("Side-lying external rotation, 2–5 lb", "12", true),
    reps("Band internal rotation, elbow at side", "12", true),
    reps("Band face pulls", "15"),
    reps("Prone Y-T-W raises", "8 each"),
  ],
  [
    reps("Band external rotation at 90°", "12", true),
    reps("Band dislocates", "10"),
    reps("Wall slides", "10"),
    reps("Band pull-aparts", "15"),
  ],
];
export const SHOULDER_PREP: readonly WarmupStep[] = SHOULDER_PREPS[0];
export const SHOULDER_PREP_ID = "lib:shoulder-prep";
const hasCuffWork = (steps: readonly WarmupStep[]) => steps.some((s) => /rotator|external rotation/i.test(s.name));

/** The day's Shoulder prep: the sets take turns by day. */
export function shoulderPrepFor(dateISO?: string): readonly WarmupStep[] {
  if (!dateISO) return SHOULDER_PREP;
  const day = Math.floor(Date.parse(`${dateISO}T12:00:00Z`) / 86_400_000);
  return SHOULDER_PREPS[((day % SHOULDER_PREPS.length) + SHOULDER_PREPS.length) % SHOULDER_PREPS.length];
}

/** A routine for a day with weights: Shoulder prep added unless it's covered. */
export function withShoulderPrep(r: WarmupRoutine | null, weights: boolean, dateISO?: string): WarmupRoutine | null {
  if (!weights) return r;
  const prep = shoulderPrepFor(dateISO);
  if (!r) return { id: SHOULDER_PREP_ID, name: "Shoulder prep", steps: [...prep], mine: false };
  return hasCuffWork(r.steps) ? r : { ...r, steps: [...r.steps, ...prep] };
}

/**
 * A Warm-up entry's choice (v0.655): one routine (its id), "match" (fits the
 * day's lifts, rotating among the matches) or "rot:<id>,<id>…" (a list you
 * order, a step on each week). Stored in PlannedWorkout.warmup as-is.
 */
export type WarmupChoice = { mode: "one"; id: string } | { mode: "match" } | { mode: "rotation"; ids: string[] };

export function parseWarmupChoice(v: string | null | undefined): WarmupChoice | null {
  if (!v) return null;
  if (v === "match") return { mode: "match" };
  if (v.startsWith("rot:")) {
    const ids = v.slice(4).split(",").filter(Boolean).slice(0, 12);
    return ids.length ? { mode: "rotation", ids } : null;
  }
  return { mode: "one", id: v };
}

export const warmupChoiceValue = (c: WarmupChoice): string =>
  c.mode === "match" ? "match" : c.mode === "rotation" ? `rot:${c.ids.join(",")}` : c.id;

/** Whole weeks since 1970-01-05 (a Monday): steps a rotation once a week. */
export function weekIndex(dateISO: string): number {
  return Math.floor((Date.parse(`${dateISO}T12:00:00Z`) - Date.parse("1970-01-05T00:00:00Z")) / (7 * 86_400_000));
}

/** The day's focus from its strength entries' muscle groups (the first wins). */
export function dayFocus(groups: readonly (string | null)[]): WarmupFocus {
  const map: Record<string, WarmupFocus> = {
    LEGS: "lower",
    DEADLIFT: "hinge",
    BACK: "pull",
    CHEST: "push",
    SHOULDERS: "push",
    ARMS: "arms",
    CORE: "core",
    FULL_BODY: "full",
  };
  for (const g of groups) if (g && map[g]) return map[g];
  return "full";
}

/** Which routine id a choice means on a day; null for a plain check. */
export function pickWarmupId(choice: WarmupChoice | null, dateISO: string, focus: WarmupFocus): string | null {
  if (!choice) return null;
  if (choice.mode === "one") return choice.id;
  if (choice.mode === "rotation") return choice.ids[((weekIndex(dateISO) % choice.ids.length) + choice.ids.length) % choice.ids.length];
  const fits = WARMUP_LIBRARY.filter((r) => r.focus?.includes(focus));
  const pool = fits.length ? fits : WARMUP_LIBRARY.filter((r) => r.key === "hips-shoulders");
  return LIB_PREFIX + pool[weekIndex(dateISO) % pool.length].key;
}

export const LIB_PREFIX = "lib:";

export function libraryRoutine(id: string | null | undefined): WarmupRoutine | null {
  if (!id || !id.startsWith(LIB_PREFIX)) return null;
  const def = WARMUP_LIBRARY.find((r) => LIB_PREFIX + r.key === id);
  return def ? { id, name: def.name, steps: def.steps, mine: false } : null;
}

export const LIBRARY_ROUTINES: readonly WarmupRoutine[] = WARMUP_LIBRARY.map((r) => ({
  id: LIB_PREFIX + r.key,
  name: r.name,
  steps: r.steps,
  mine: false,
}));

/** Steps sent from a client, kept to what's valid: up to 30, names trimmed. */
export function cleanSteps(raw: unknown): WarmupStep[] {
  if (!Array.isArray(raw)) return [];
  const out: WarmupStep[] = [];
  for (const x of raw.slice(0, 30)) {
    if (!x || typeof x !== "object") continue;
    const s = x as Record<string, unknown>;
    const name = typeof s.name === "string" ? s.name.trim().slice(0, 60) : "";
    if (!name) continue;
    const sides = s.sides === true;
    if (s.kind === "TIME") {
      const sec = typeof s.seconds === "number" && Number.isFinite(s.seconds) ? Math.round(s.seconds) : 30;
      out.push({ name, kind: "TIME", seconds: Math.min(Math.max(sec, 5), 3600), ...(sides ? { sides } : {}) });
    } else {
      const amount = typeof s.amount === "string" ? s.amount.trim().slice(0, 30) : "";
      out.push({ name, kind: "REPS", ...(amount ? { amount } : {}), ...(sides ? { sides } : {}) });
    }
  }
  return out;
}

/** "10–15", "10 each side", "30 s", "30 s each side", "2:00". */
export function stepAmount(s: WarmupStep): string {
  const side = s.sides ? " each side" : "";
  if (s.kind === "TIME") {
    const sec = s.seconds ?? 0;
    const t = sec >= 60 ? `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}` : `${sec} s`;
    return t + side;
  }
  return (s.amount ?? "") + (s.amount ? side : side.trim());
}

/**
 * The warm-up countdown (v0.625). A timed step's timer runs it and the timed
 * steps straight after it, one interval each, two for an each-side step
 * ("Side plank · left", then "· right"). Pure: the phone mirrors it in
 * WarmupScreens.kt.
 */
export type WarmupInterval = { step: number; name: string; seconds: number };

/** Which side an each-side step starts on (v0.629: chosen on the timer). */
export type FirstSide = "left" | "right";

export function warmupIntervals(
  steps: readonly WarmupStep[],
  from: number,
  first: FirstSide = "left",
): WarmupInterval[] {
  const [a, b] = first === "right" ? ["right", "left"] : ["left", "right"];
  const out: WarmupInterval[] = [];
  for (let i = from; i < steps.length; i++) {
    const s = steps[i];
    if (s.kind !== "TIME" || !s.seconds) break;
    if (s.sides) {
      out.push({ step: i, name: `${s.name} · ${a}`, seconds: s.seconds });
      out.push({ step: i, name: `${s.name} · ${b}`, seconds: s.seconds });
    } else {
      out.push({ step: i, name: s.name, seconds: s.seconds });
    }
  }
  return out;
}

/** Choices for the pause between intervals, in seconds. */
export const WARMUP_GAPS = [0, 1, 2, 3, 5, 10] as const;

/** One stretch of the countdown: a get-ready or pause, or an interval's work. */
export type WarmupSegment = { kind: "READY" | "WORK"; interval: number; seconds: number };

/** The whole countdown: get-ready before the first, the gap before each next. */
export function warmupSchedule(intervals: readonly WarmupInterval[], lead: number, gap: number): WarmupSegment[] {
  const out: WarmupSegment[] = [];
  intervals.forEach((iv, i) => {
    const wait = i === 0 ? lead : gap;
    if (wait > 0) out.push({ kind: "READY", interval: i, seconds: wait });
    out.push({ kind: "WORK", interval: i, seconds: iv.seconds });
  });
  return out;
}

/** Where the countdown is after `elapsed` whole seconds; done past the end. */
export function warmupAt(
  schedule: readonly WarmupSegment[],
  elapsed: number,
): { segment: number; left: number; done: boolean } {
  let t = elapsed;
  for (let i = 0; i < schedule.length; i++) {
    if (t < schedule[i].seconds) return { segment: i, left: schedule[i].seconds - t, done: false };
    t -= schedule[i].seconds;
  }
  return { segment: schedule.length - 1, left: 0, done: true };
}

/** Total length of the countdown in seconds. */
export function warmupTotal(schedule: readonly WarmupSegment[]): number {
  return schedule.reduce((n, s) => n + s.seconds, 0);
}
