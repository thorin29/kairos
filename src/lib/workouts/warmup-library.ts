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
  /** How to do it (v0.659), behind an ⓘ. */
  cue?: string;
};

/** Warm-up or Mobility (v0.659): both are lists of steps, done with a tap. */
export type RoutineKind = "warmup" | "mobility";

/** What a warm-up readies you for (v0.655), for "Match the day". */
export type WarmupFocus = "lower" | "hinge" | "push" | "pull" | "core" | "arms" | "hockey" | "full";

export type WarmupRoutineDef = { key: string; name: string; steps: WarmupStep[]; focus?: WarmupFocus[] };

/** A routine a plan or client sees: a library one ("lib:<key>") or the
 *  person's own (its id). */
export type WarmupRoutine = { id: string; name: string; steps: WarmupStep[]; mine: boolean };

const reps = (name: string, amount: string, sides = false, cue?: string): WarmupStep => ({
  name,
  kind: "REPS",
  amount,
  ...(sides ? { sides } : {}),
  ...(cue ? { cue } : {}),
});
const hold = (name: string, seconds: number, sides = false, cue?: string): WarmupStep => ({
  name,
  kind: "TIME",
  seconds,
  ...(sides ? { sides } : {}),
  ...(cue ? { cue } : {}),
});

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

/**
 * Mobility routines (v0.659): range of motion, done on their own or after
 * the work. Holds are slow and easy, never forced; go a little deeper over
 * the weeks. Keys start "mob-".
 */
export const MOBILITY_LIBRARY: readonly WarmupRoutineDef[] = [
  {
    key: "mob-hips-hang",
    name: "Hips, hang and squat",
    steps: [
      reps("Rotational hinge", "8", true, "Hinge at the hips and turn your chest toward the front leg. Long spine, slow."),
      hold("Deep squat rock", 60, false, "Sit in the bottom without touching the ground. Rock side to side and forward and back."),
      hold("Dead hang", 40, false, "Relax into the hang; small rotations side to side."),
      hold("Hip external rotation on the incline bench", 45, true, "Shin across the bench, hips square, then bend forward over it."),
      reps(
        "Band hip internal rotation (PNF)",
        "3 rounds",
        true,
        "Band pulls the knee out. Let it pull for 30 s, push against it for 10 s, then relax and rotate in further. Three times.",
      ),
      hold("Long lunge hip flexor", 45, true, "Long stance, squeeze the back leg's glute, stay tall."),
      hold("Horse stance", 30, false, "Toes out, lower slowly, torso tall. Hold the wall or rack; go deeper over time."),
    ],
  },
  {
    key: "mob-hip-opener",
    name: "Hip opener",
    steps: [
      reps("90/90 hip switches", "8 each way", false, "Sit tall and turn both knees side to side. Hands off the floor if you can."),
      reps("Cossack squat", "6", true, "Wide stance, sit into one hip, the other leg straight with toes up."),
      reps("Frog rock-backs", "10", false, "Knees wide on the floor, rock hips back toward the heels and forward."),
      hold("Couch stretch", 45, true, "Back knee at the wall or bench, shin up it. Squeeze that glute."),
      hold("Pigeon", 45, true, "Front shin across, hips square, fold forward slowly."),
      reps("Hip CARs", "3 each way", true, "On all fours or standing: the biggest slow circle the hip can make, nothing else moving."),
    ],
  },
  {
    key: "mob-spine",
    name: "Spine and upper back",
    steps: [
      reps("Cat-cow", "10", false, "Slow, one segment of the spine at a time."),
      reps("Thread the needle", "8", true, "On all fours, reach under and then up to the ceiling. Eyes follow the hand."),
      reps("Open book", "8", true, "On your side, knees bent, open the top arm across to the floor behind you."),
      hold("Bench thoracic stretch", 45, false, "Kneel, elbows on the bench, hands together behind the head. Sink the chest."),
      reps("Jefferson curl", "8", false, "No weight or a light one. Roll down one vertebra at a time, then back up."),
      hold("Child's pose side reach", 30, true, "Walk both hands to one side and breathe into the ribs."),
    ],
  },
  {
    key: "mob-shoulders",
    name: "Shoulders and overhead",
    steps: [
      hold("Dead hang", 40, false, "Relax into the hang; small rotations side to side."),
      reps("Shoulder CARs", "3 each way", true, "The biggest slow circle the shoulder can make, ribs down."),
      reps("Band dislocates", "10", false, "Wide grip, straight arms, over and back. Narrow the grip over time."),
      reps("Wall slides", "10", false, "Back, head and forearms on the wall; slide up without losing contact."),
      hold("Sleeper stretch", 30, true, "Lying on that side, arm at 90°, gently press the forearm down."),
      reps("Steel club mills", "8 each way", false, "Light club, slow. Elbows close to the head."),
    ],
  },
  {
    key: "mob-ankles-knees",
    name: "Ankles and knees",
    steps: [
      reps("Knee-to-wall ankle rocks", "10", true, "Heel down, drive the knee over the toes toward the wall."),
      reps("Tibialis raises", "15", false, "Back against the wall, heels forward, lift the toes."),
      hold("Calf stretch on a step", 45, true, "Heel off the step, knee straight, let it sink."),
      hold("Spanish squat", 30, false, "Band behind the knees, anchored to the rack. Sit back, shins upright."),
      hold("Heels-up deep squat", 45, false, "Heels on a plate, sit as deep as you can, chest tall."),
      hold("Couch stretch", 45, true, "Back knee at the wall or bench, shin up it. Squeeze that glute."),
    ],
  },
  {
    key: "mob-skater",
    name: "Skater hips",
    steps: [
      reps("Adductor rock-backs", "10", true, "On all fours, one leg out to the side; rock hips back."),
      reps("Cossack squat", "6", true, "Wide stance, sit into one hip, the other leg straight with toes up."),
      hold("Lateral lunge hold", 30, true, "Sit into one hip, chest up, the other leg long."),
      hold("Copenhagen plank", 20, true, "Top leg on the bench, lift the hips. Knee on the bench to make it easier."),
      hold("Hip flexor lunge with reach", 30, true, "Back glute tight, reach the same-side arm up and over."),
      hold("Horse stance", 30, false, "Toes out, lower slowly, torso tall. Hold the wall or rack; go deeper over time."),
    ],
  },
  {
    key: "mob-cars",
    name: "Joint circles (CARs)",
    steps: [
      reps("Neck CARs", "3 each way", false, "Slow circles, chin to chest, ear to shoulder, look up."),
      reps("Shoulder CARs", "3 each way", true, "The biggest slow circle the shoulder can make, ribs down."),
      reps("Spine CARs", "3", false, "Standing, roll down, around and up, one segment at a time."),
      reps("Hip CARs", "3 each way", true, "Standing on one leg, the biggest slow circle the hip can make."),
      reps("Ankle CARs", "5 each way", true, "Slow full circles, the shin still."),
      reps("Wrist CARs", "5 each way", false, "Fists, slow full circles."),
    ],
  },
];

const ALL_LIBRARY = [...WARMUP_LIBRARY, ...MOBILITY_LIBRARY];

export function libraryRoutine(id: string | null | undefined): WarmupRoutine | null {
  if (!id || !id.startsWith(LIB_PREFIX)) return null;
  const def = ALL_LIBRARY.find((r) => LIB_PREFIX + r.key === id);
  return def ? { id, name: def.name, steps: def.steps, mine: false } : null;
}

const asRoutine = (r: WarmupRoutineDef): WarmupRoutine => ({ id: LIB_PREFIX + r.key, name: r.name, steps: r.steps, mine: false });
export const LIBRARY_ROUTINES: readonly WarmupRoutine[] = WARMUP_LIBRARY.map(asRoutine);
export const MOBILITY_ROUTINES: readonly WarmupRoutine[] = MOBILITY_LIBRARY.map(asRoutine);

/** A routine kind from a request or a stored row; anything else is a warm-up. */
export const cleanRoutineKind = (v: unknown): RoutineKind => (v === "mobility" ? "mobility" : "warmup");

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
    const cue = typeof s.cue === "string" ? s.cue.trim().slice(0, 300) : "";
    const extra = { ...(sides ? { sides } : {}), ...(cue ? { cue } : {}) };
    if (s.kind === "TIME") {
      const sec = typeof s.seconds === "number" && Number.isFinite(s.seconds) ? Math.round(s.seconds) : 30;
      out.push({ name, kind: "TIME", seconds: Math.min(Math.max(sec, 5), 3600), ...extra });
    } else {
      const amount = typeof s.amount === "string" ? s.amount.trim().slice(0, 30) : "";
      out.push({ name, kind: "REPS", ...(amount ? { amount } : {}), ...extra });
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
