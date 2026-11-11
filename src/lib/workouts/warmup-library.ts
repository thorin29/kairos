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

/** Warm-up, Mobility (v0.659) or Stretching (v0.663): lists of steps, done
 *  with a tap. */
export type RoutineKind = "warmup" | "mobility" | "stretching";

/** What a warm-up readies you for (v0.655), for "Match the day". */
export type WarmupFocus = "lower" | "hinge" | "push" | "pull" | "core" | "arms" | "hockey" | "full";

export type WarmupRoutineDef = { key: string; name: string; steps: WarmupStep[]; focus?: WarmupFocus[] };

/** A routine a plan or client sees: a library one ("lib:<key>") or the
 *  person's own (its id). */
export type WarmupRoutine = { id: string; name: string; steps: WarmupStep[]; mine: boolean };

/**
 * How to do each warm-up move (v0.672), behind its ⓘ: a step with no cue of
 * its own takes the one under its name here.
 */
const WARMUP_CUES: Record<string, string> = {
  "Bike or row, easy": "Easy pace, just warming up. You should be able to talk.",
  "Couch stretch": "Back knee on a pad against a wall or bench, shin up the wall, front foot planted. Squeeze the glute of the back leg and stay tall.",
  "Dead hang": "Hang from a bar with straight arms and shoulders relaxed. Breathe.",
  "Forearm stretch": "Arm straight, palm up, gently pull the fingers back with the other hand. Then palm down.",
  "Frog stretch": "On hands and knees, knees wide, shins parallel, feet out. Rock the hips back slowly.",
  "Front plank": "Forearms under shoulders, body in a straight line. Squeeze glutes and brace like you're about to be poked in the stomach.",
  "Groin stretch": "Sit, soles of the feet together, knees out. Sit tall and press the knees gently toward the floor.",
  "Hip flexor stretch": "Half kneel, tuck the hips under and squeeze the back glute. Shift forward a little until the front of the back hip stretches.",
  "Hollow hold": "On your back, low back pressed into the floor, arms overhead and legs straight, both a few inches off the floor.",
  "Jump rope": "Small, quick hops on the balls of the feet. Wrists turn the rope, not the arms.",
  "Jumping jacks": "Light and quick, landing softly on the balls of the feet.",
  "Kneeling lunge stretch": "Half kneel, tuck the hips under, then lean forward until the front of the back hip stretches. Stay tall.",
  "Plank": "Forearms under shoulders, body in a straight line. Squeeze glutes and brace.",
  "Side plank": "On one forearm, elbow under the shoulder, feet stacked. Lift the hips into a straight line from head to feet.",
  "90/90 external rotation, 2–5 lb": "Elbow out at shoulder height and bent to 90°. Slowly rotate the forearm up and back without moving the elbow.",
  "Arm circles": "Arms straight out to the sides. Small circles growing bigger, both directions.",
  "Back extensions": "Hips on the pad, hinge down, then lift until your body is in a straight line. Squeeze the glutes; don't arch past straight.",
  "Band dislocates": "Hold a band wide with straight arms. Bring it overhead and behind you, then back. Widen your grip if it pinches.",
  "Band external rotation at 90°": "Band anchored in front, elbow at shoulder height bent to 90°. Rotate the forearm up and back, elbow still.",
  "Band external rotation, elbow at side": "Elbow tucked at your side, bent to 90°. Rotate the hand out away from your belly, slowly back.",
  "Band face pulls": "Band at face height. Pull it to your forehead, elbows high, ending with hands beside your ears.",
  "Band internal rotation, elbow at side": "Elbow tucked at your side, bent to 90°, band pulling out. Rotate the hand in across your belly.",
  "Band pull-aparts": "Band at chest height, arms straight. Pull it apart to your chest by squeezing the shoulder blades together.",
  "Bird dogs": "On hands and knees, reach one arm and the opposite leg out long. Keep the hips level; pause, switch.",
  "Bodyweight squats": "Feet shoulder-width, sit down between the heels with chest up, knees following the toes. Stand tall.",
  "Box jumps or broad jumps": "Jump hard, land softly with bent knees. Step down from the box; reset between jumps.",
  "Calf raises": "Rise onto the balls of the feet, pause at the top, lower slowly.",
  "Cat-cow": "On hands and knees, round the whole back up, then let it sag and lift the chest. Slow, with your breath.",
  "Chin-ups": "Palms facing you. Pull your chin over the bar, lower all the way under control.",
  "Cossack squats": "Wide stance. Sit into one hip with that knee bent, other leg straight and toes up. Shift side to side.",
  "Dead bugs": "On your back, arms up, knees over hips. Lower one arm and the opposite leg toward the floor, low back flat, return, switch.",
  "Diamond push-ups": "Hands together under the chest, thumbs and fingers making a diamond. Elbows stay close.",
  "Glute bridges": "On your back, feet flat. Drive through the heels and lift the hips until knees, hips and shoulders line up. Squeeze at the top.",
  "Hip airplanes": "Stand on one leg, hinge forward with a flat back. Rotate the hips open and closed slowly. Hold something if you need to.",
  "Hip circles": "Hands on hips, draw big slow circles with the hips, both directions.",
  "Hip hinge drill": "Push the hips back with a flat back and soft knees until you feel the hamstrings, then drive the hips forward to stand.",
  "Inchworms": "From standing, walk the hands out to a plank, then walk the feet up to the hands. Keep the legs as straight as you can.",
  "Lateral lunges": "Step wide to one side and sit into that hip, other leg straight. Push back to the middle.",
  "Leg swings": "Hold something for balance. Swing one leg front to back, then side to side, loose and controlled.",
  "Leg swings, front to back": "Hold something for balance. Swing the leg forward and back, letting the range grow.",
  "Leg swings, side to side": "Face a wall or rail. Swing the leg across the body and out to the side.",
  "Medicine ball throws": "Explode up and throw the ball hard: overhead, chest pass or slam. Reset each throw.",
  "Prone Y-T-W raises": "Face down on a bench or the floor. Lift the arms into a Y, then a T, then a W, squeezing the shoulder blades. Light and slow.",
  "Push-up to down dog": "From the top of a push-up, push the hips up and back into an upside-down V, then return.",
  "Push-ups": "Hands under the shoulders, body straight. Lower the chest near the floor, elbows about 45° from the body.",
  "Scap pull-ups": "Hang with straight arms. Pull the shoulder blades down and together to lift a little, without bending the elbows.",
  "Scap push-ups": "In a plank with straight arms, let the chest sink between the shoulder blades, then push the floor away.",
  "Side-lying external rotation, 2–5 lb": "Lie on your side, top elbow tucked at your side bent to 90°. Rotate the weight up toward the ceiling, slowly down.",
  "Single-leg RDL, no weight": "Stand on one leg, hinge forward as the other leg reaches back, flat back. Stand back up through the hip.",
  "Skater hops": "Leap side to side from one leg to the other like a skater, landing softly and sticking each landing.",
  "TRX curls": "Face the anchor, lean back on straight arms with palms up. Curl yourself up toward the hands.",
  "TRX rows": "Face the anchor, lean back on straight arms. Pull your chest to the handles, squeezing the shoulder blades.",
  "Thoracic open-books": "Lie on your side, knees bent, arms together in front. Open the top arm across to the other side, following it with your eyes.",
  "Thoracic rotations": "On hands and knees, one hand behind your head. Rotate that elbow up toward the ceiling, then down toward the other arm.",
  "Tricep dips": "Hands on a bench behind you. Lower until the elbows are about 90°, then press back up.",
  "Walking lunges": "Long step forward, lower the back knee near the floor, front knee over the foot. Step through into the next one.",
  "Wall slides": "Back, head and arms against a wall, elbows bent. Slide the arms up and down keeping contact with the wall.",
  "World's greatest stretch": "Lunge forward, put the same-side hand down inside the front foot, then rotate the other arm up to the ceiling.",
  "Wrist circles": "Clasp the hands or make fists and roll the wrists in circles, both ways.",
};

const reps = (name: string, amount: string, sides = false, cue?: string): WarmupStep => ({
  name,
  kind: "REPS",
  amount,
  ...(sides ? { sides } : {}),
  ...((cue ?? WARMUP_CUES[name]) ? { cue: cue ?? WARMUP_CUES[name] } : {}),
});
const hold = (name: string, seconds: number, sides = false, cue?: string): WarmupStep => ({
  name,
  kind: "TIME",
  seconds,
  ...(sides ? { sides } : {}),
  ...((cue ?? WARMUP_CUES[name]) ? { cue: cue ?? WARMUP_CUES[name] } : {}),
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

/**
 * Stretching routines (v0.663): static holds, done after training or on
 * their own. Each hold is at least 30 seconds and about a minute per side in
 * all (ACSM: 60 s per joint, 2–3+ days a week, daily gains most); stretch to
 * mild tension, never pain, and breathe out into it. Range comes with weeks
 * of regular holds, not by forcing one. The goalie and split routines are
 * for the butterfly: hip rotation, adductors, hip flexors, hamstrings.
 * Keys start "str-".
 */
export const STRETCH_LIBRARY: readonly WarmupRoutineDef[] = [
  {
    key: "str-full",
    name: "Full body",
    steps: [
      hold("Standing calf stretch", 45, true, "Hands on the wall, back leg straight, heel down. Lean in."),
      hold("Kneeling hip flexor stretch", 45, true, "Half-kneeling, squeeze the back glute and shift forward. Tall chest."),
      hold("Seated hamstring stretch", 60, false, "Legs straight, hinge from the hips with a long back. Reach for the shins or feet."),
      hold("Figure-4 glute stretch", 45, true, "On your back, ankle across the other knee, pull that thigh in."),
      hold("Butterfly", 60, false, "Soles together, heels in, sit tall, let the knees drop. Lean forward from the hips."),
      hold("Child's pose", 60, false, "Knees wide, sit back on the heels, arms long in front."),
      hold("Doorway chest stretch", 45, true, "Forearm on the door frame at shoulder height, step through until the chest opens."),
      hold("Cross-body shoulder stretch", 30, true, "Pull one straight arm across the chest with the other."),
      hold("Overhead triceps stretch", 30, true, "Hand down the back, the other hand eases the elbow back."),
      hold("Neck side stretch", 30, true, "Ear toward the shoulder, the other shoulder down. Gentle."),
    ],
  },
  {
    key: "str-goalie-hips",
    name: "Goalie hips",
    steps: [
      hold("90/90 hold", 60, true, "Front and back knee at 90°. Sit tall, then lean over the front shin. Then turn and face the back leg for its inward rotation."),
      hold("Butterfly fold", 60, false, "Soles together, heels a little forward, fold from the hips with a long back."),
      hold("Frog stretch", 60, false, "Knees wide on the floor, ankles in line with the knees. Sink the hips back slowly."),
      hold("Pigeon", 60, true, "Front shin across, back leg long, hips square. Fold forward when it settles."),
      hold("Hip internal rotation hold", 45, true, "Seated, feet wide, knees bent. Drop one knee in toward the floor and hold."),
      hold("Kneeling hip flexor stretch", 60, true, "Half-kneeling, squeeze the back glute and shift forward. Tall chest."),
      hold("Deep squat hold", 60, false, "Heels down, elbows push the knees out, chest up."),
    ],
  },
  {
    key: "str-front-splits",
    name: "Front splits",
    steps: [
      hold("Half split", 60, true, "From a kneel, front leg straight, hips back over the back knee. Toes up, long back."),
      hold("Couch stretch", 60, true, "Back knee at the wall or bench, shin up it. Squeeze that glute."),
      hold("Lizard lunge", 45, true, "Long lunge, both hands inside the front foot. Elbows down if they reach."),
      hold("Pigeon", 45, true, "Front shin across, back leg long, hips square. Fold forward when it settles."),
      hold(
        "Front split hold",
        60,
        true,
        "Hands on blocks or chairs, slide into the split with the hips square, only as low as you control. Lower the blocks over the weeks.",
      ),
    ],
  },
  {
    key: "str-middle-splits",
    name: "Middle splits",
    steps: [
      hold("Butterfly", 60, false, "Soles together, heels in, sit tall, let the knees drop."),
      hold("Frog stretch", 60, false, "Knees wide on the floor, ankles in line with the knees. Sink the hips back slowly."),
      hold("Kneeling adductor stretch", 45, true, "One knee down, the other leg straight out to the side, foot flat. Sit the hips back."),
      hold("Cossack hold", 45, true, "Wide stance, sit into one hip, the other leg straight with toes up."),
      hold("Pancake fold", 60, false, "Seated straddle, toes up, fold forward from the hips with a long back."),
      hold(
        "Middle split hold",
        60,
        false,
        "Hands on blocks, slide the feet wide with toes up, hips over the heels. Or lie with legs up a wall and let them open.",
      ),
    ],
  },
  {
    key: "str-hamstrings-back",
    name: "Hamstrings and low back",
    steps: [
      hold("Band hamstring stretch", 60, true, "On your back, band around the foot, leg straight up. The other leg flat."),
      hold("Seated forward fold", 60, false, "Legs together and straight, fold from the hips."),
      hold("Knees to chest", 45, false, "On your back, hug both knees in, low back heavy."),
      hold("Supine twist", 45, true, "On your back, drop both knees to one side, arms out, shoulders down."),
      hold("Sphinx", 45, false, "Face down on the forearms, hips heavy, chest up."),
      hold("Child's pose", 60, false, "Knees wide, sit back on the heels, arms long in front."),
    ],
  },
  {
    key: "str-upper",
    name: "Shoulders, chest and neck",
    steps: [
      hold("Doorway chest stretch", 45, true, "Forearm on the door frame at shoulder height, step through until the chest opens."),
      hold("Bench lat stretch", 60, false, "Kneel, elbows on the bench, hands together. Sink the chest toward the floor."),
      hold("Cross-body shoulder stretch", 45, true, "Pull one straight arm across the chest with the other."),
      hold("Sleeper stretch", 45, true, "On that side, arm out at 90°, gently press the forearm down."),
      hold("Overhead triceps stretch", 30, true, "Hand down the back, the other hand eases the elbow back."),
      hold("Neck side stretch", 30, true, "Ear toward the shoulder, the other shoulder down. Gentle."),
      hold("Wrist stretch", 30, true, "Arm straight, palm up then palm down, the other hand eases the fingers back."),
    ],
  },
  {
    key: "str-after-skate",
    name: "After skating",
    steps: [
      hold("Kneeling hip flexor stretch", 45, true, "Half-kneeling, squeeze the back glute and shift forward. Tall chest."),
      hold("Butterfly", 45, false, "Soles together, heels in, sit tall, let the knees drop."),
      hold("Side-lying quad stretch", 45, true, "On your side, pull the top heel to the glute, knees together."),
      hold("Seated hamstring stretch", 45, false, "Legs straight, hinge from the hips with a long back."),
      hold("Figure-4 glute stretch", 45, true, "On your back, ankle across the other knee, pull that thigh in."),
      hold("Child's pose", 45, false, "Knees wide, sit back on the heels, arms long in front."),
    ],
  },
];

const ALL_LIBRARY = [...WARMUP_LIBRARY, ...MOBILITY_LIBRARY, ...STRETCH_LIBRARY];

export function libraryRoutine(id: string | null | undefined): WarmupRoutine | null {
  if (!id || !id.startsWith(LIB_PREFIX)) return null;
  const def = ALL_LIBRARY.find((r) => LIB_PREFIX + r.key === id);
  return def ? { id, name: def.name, steps: def.steps, mine: false } : null;
}

const asRoutine = (r: WarmupRoutineDef): WarmupRoutine => ({ id: LIB_PREFIX + r.key, name: r.name, steps: r.steps, mine: false });
export const LIBRARY_ROUTINES: readonly WarmupRoutine[] = WARMUP_LIBRARY.map(asRoutine);
export const MOBILITY_ROUTINES: readonly WarmupRoutine[] = MOBILITY_LIBRARY.map(asRoutine);
export const STRETCH_ROUTINES: readonly WarmupRoutine[] = STRETCH_LIBRARY.map(asRoutine);

/** A routine kind from a request or a stored row; anything else is a warm-up. */
export const cleanRoutineKind = (v: unknown): RoutineKind =>
  v === "mobility" ? "mobility" : v === "stretching" ? "stretching" : "warmup";

/** The library routines of a kind. */
export const libraryRoutinesOf = (kind: RoutineKind): readonly WarmupRoutine[] =>
  kind === "mobility" ? MOBILITY_ROUTINES : kind === "stretching" ? STRETCH_ROUTINES : LIBRARY_ROUTINES;

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
