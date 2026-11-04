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

export type WarmupRoutineDef = { key: string; name: string; steps: WarmupStep[] };

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
];

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
