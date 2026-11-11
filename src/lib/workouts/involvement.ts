import type { MuscleGroup } from "@/lib/workouts/catalog";

/**
 * Which muscle groups a movement works beyond the one it is filed under.
 *
 * The group a person set on the movement stays authoritative for the PRIMARY
 * muscle — this table never overrides it. All it adds is the SECONDARY groups,
 * so the body map can shade "bench press also works arms and shoulders"
 * without anyone re-filing their pool. `suggestedPrimary` is a fallback used
 * only when a movement has no group at all.
 *
 * Matched on the movement's name, because the pool is user-created: there are
 * no fixed ids to key on. Exact name first, then the keyword rules below, so
 * "dumbbell bent over row" resolves the same way "bent over row" does.
 *
 * Accuracy here is deliberately "semi": involvement shifts with grip, stance
 * and depth, and sources disagree at the margins. With seven groups, triceps
 * and biceps are both ARMS and lats and traps are both BACK, so this is as
 * precise as the vocabulary allows. Treat it as a sensible default, not fact.
 */
/**
 * A tap target on the body map. Six of these are muscle groups; POSTERIOR_HIP
 * is not, and that is the point of it.
 *
 * The artwork's lower back and glutes form one obvious place to press, but the
 * pixels under it belong to two different groups — the obliques and lumbar
 * erectors are Core (the lower back IS part of the core, not a thing beside
 * it), the glutes are Legs. Selection and shading are therefore separate:
 * `navRegionFor` answers "what did they click", `groupsFor` answers "what does
 * it work".
 */
export type NavRegion =
  | "CHEST"
  | "CORE"
  | "SHOULDERS"
  | "ARMS"
  | "LEGS"
  | "BACK"
  | "POSTERIOR_HIP";

export const NAV_LABEL: Record<NavRegion, string> = {
  CHEST: "Chest",
  CORE: "Core",
  SHOULDERS: "Shoulders",
  ARMS: "Arms",
  LEGS: "Legs",
  BACK: "Back",
  POSTERIOR_HIP: "Deadlift",
};

export type Involvement = {
  suggestedPrimary: MuscleGroup;
  secondary: MuscleGroup[];
  /**
   * Which figure the work shows on. Seven groups cannot tell a squat from a
   * deadlift \u2014 both are LEGS \u2014 but the body map has a front and a back, so a
   * quad-dominant lift can light the front legs and a hip-dominant one the
   * back. "both" is the default and the right answer for most movements.
   */
  view?: "front" | "back" | "both";
  /**
   * What the movement is naturally measured in, for plans that hold a plank or
   * a set of sit-ups alongside barbell work. Only a suggestion: whatever is
   * already set on the planned movement wins.
   */
  suggestedMetric?: "WEIGHT" | "DURATION" | "REPS";
  /**
   * The one region on the body map that selects this movement. Defaults to the
   * primary group's own region; set it only where that would be wrong — a
   * hip hinge is reached from the lower back and glutes, not from the thigh.
   */
  navRegion?: NavRegion;
  /**
   * The suggested primary wins over the group the movement is filed under
   * (v0.671): the hinge family (deadlifts, RDLs, good mornings, back
   * extensions, swings) is always the Deadlift group — the lower back and
   * glutes — so a back extension filed under Back still sits with them.
   */
  forcePrimary?: boolean;
  /**
   * Listed under its own name (v0.672): good mornings and back extensions are
   * lower-back work. They light the same place on the map as a deadlift and
   * sit beside the deadlifts, but they're "Lower back", never "Deadlift", in
   * the lists and on Workout days.
   */
  shownAs?: "LOWER_BACK";
};

/** Keyword rules, first match wins — order matters. */
const RULES: { match: RegExp; involvement: Involvement }[] = [
  // --- press: chest ------------------------------------------------------
  {
    // Close grip shifts the work to the triceps; the chest assists.
    match: /\bclose[- ]?grip\b.*\bbench\b|\bclose[- ]?grip\b.*\bpress\b/,
    involvement: { suggestedPrimary: "ARMS", secondary: ["CHEST", "SHOULDERS"] },
  },
  {
    match: /\b(bench|chest)\b.*\bpress\b|\bbench press\b|\b(incline|decline)\b.*\bpress\b/,
    involvement: { suggestedPrimary: "CHEST", secondary: ["ARMS", "SHOULDERS"] },
  },
  {
    match: /\bpush[- ]?up/,
    involvement: { suggestedPrimary: "CHEST", secondary: ["ARMS", "SHOULDERS", "CORE"] },
  },
  {
    match: /\bdip\b|\bdips\b/,
    involvement: { suggestedPrimary: "ARMS", secondary: ["CHEST", "SHOULDERS"] },
  },

  // --- pull: back --------------------------------------------------------
  {
    // A reverse fly is rear delts and upper back, not chest.
    match: /\breverse\b.*\bfly\b|\brear\b.*\b(delt|fly)\b/,
    involvement: { suggestedPrimary: "SHOULDERS", secondary: ["BACK"] },
  },
  {
    match: /\bfly\b|\bflye\b/,
    involvement: { suggestedPrimary: "CHEST", secondary: ["SHOULDERS"] },
  },
  {
    match: /\bupright row\b/,
    involvement: { suggestedPrimary: "SHOULDERS", secondary: ["BACK", "ARMS"] },
  },
  {
    match: /\brow\b/,
    involvement: { suggestedPrimary: "BACK", secondary: ["ARMS", "SHOULDERS"] },
  },
  {
    match: /\b(pull[- ]?up|chin[- ]?up|pulldown|lat pull)/,
    involvement: { suggestedPrimary: "BACK", secondary: ["ARMS", "CORE"] },
  },
  {
    match: /\bshrug/,
    involvement: { suggestedPrimary: "BACK", secondary: ["ARMS"] },
  },

  // --- shoulders ---------------------------------------------------------
  {
    match: /\b(shoulder|overhead|military|strict)\b.*\bpress\b|\bohp\b/,
    involvement: { suggestedPrimary: "SHOULDERS", secondary: ["ARMS", "CORE"] },
  },
  {
    match: /\b(lateral|side|front)\b.*\braise\b/,
    involvement: { suggestedPrimary: "SHOULDERS", secondary: [] },
  },

  // --- hinge and legs ----------------------------------------------------
  {
    // The hinge family (v0.671): the lower back and glutes (Deadlift) lead,
    // the hamstrings (Legs) assist. Only lifts that hang a load from the
    // hands also work the upper back (lats and traps holding the bar in), so
    // a good morning, a back extension or a swing lights no Back.
    // A good morning hinges with the bar on the back.
    match: /\bgood ?mornings?\b/,
    involvement: { suggestedPrimary: "DEADLIFT", secondary: ["LEGS"], view: "back", navRegion: "POSTERIOR_HIP", forcePrimary: true, shownAs: "LOWER_BACK" },
  },
  {
    // Back extensions and their kin work the lumbar erectors directly.
    match: /\b(back extension|hyperextension|reverse hyper|superman|jefferson curl)/,
    involvement: { suggestedPrimary: "DEADLIFT", secondary: ["LEGS"], view: "back", navRegion: "POSTERIOR_HIP", forcePrimary: true, shownAs: "LOWER_BACK" },
  },
  {
    match: /\b(kettlebell|kb) swings?\b/,
    involvement: { suggestedPrimary: "DEADLIFT", secondary: ["LEGS"], view: "back", navRegion: "POSTERIOR_HIP", forcePrimary: true },
  },
  {
    // Romanian / stiff-leg: hamstrings with the back holding position; the
    // bar hangs from the hands, so the upper back holds it in.
    match: /\b(romanian|rdl|stiff[- ]?leg)/,
    involvement: {
      suggestedPrimary: "DEADLIFT",
      secondary: ["LEGS", "BACK"],
      view: "back",
      navRegion: "POSTERIOR_HIP",
      forcePrimary: true,
    },
  },
  {
    // Hip extension, so the glutes are the prime mover \u2014 the lumbar erectors
    // and lats hold an isometric contraction rather than driving the lift, which
    // is why a deadlift is not a back exercise however it feels the next day.
    // Posterior view only: that is what separates it from a squat on the body.
    match: /\bdeadlift/,
    involvement: {
      suggestedPrimary: "DEADLIFT",
      secondary: ["LEGS", "BACK"],
      view: "back",
      navRegion: "POSTERIOR_HIP",
      forcePrimary: true,
    },
  },
  {
    // Front-loaded, so the upper back holds the rack position. The delts are
    // loaded isometrically too, but calling that shoulder work is a stretch.
    match: /\bfront squat/,
    involvement: {
      suggestedPrimary: "LEGS",
      secondary: ["CORE", "BACK"],
      view: "both",
    },
  },
  {
    match: /\bsquat/,
    involvement: { suggestedPrimary: "LEGS", secondary: ["CORE", "BACK"], view: "both" },
  },
  {
    match: /\b(lunge|split squat|step[- ]?up|bulgarian)/,
    involvement: { suggestedPrimary: "LEGS", secondary: ["CORE"] },
  },
  {
    match: /\b(hip thrust|glute bridge)/,
    involvement: {
      suggestedPrimary: "LEGS",
      secondary: ["CORE"],
      view: "back",
      navRegion: "POSTERIOR_HIP",
    },
  },
  {
    match: /\bleg curl|\bhamstring curl/,
    involvement: { suggestedPrimary: "LEGS", secondary: [], view: "back" },
  },
  {
    match: /\b(leg press|leg extension)/,
    involvement: { suggestedPrimary: "LEGS", secondary: [], view: "front" },
  },
  {
    match: /\bcalf raise/,
    involvement: { suggestedPrimary: "LEGS", secondary: [], view: "back" },
  },

  // --- arms --------------------------------------------------------------
  {
    match: /\bcurl/,
    involvement: { suggestedPrimary: "ARMS", secondary: [] },
  },
  {
    match: /\b(extension|skull ?crusher|kickback|pushdown)/,
    involvement: { suggestedPrimary: "ARMS", secondary: [] },
  },

  // --- core --------------------------------------------------------------
  {
    // No trailing \b: "planks" and "wall sits" are how people name them.
    match: /\b(plank|hollow|dead ?bug|wall sit|isometric hold)/,
    involvement: { suggestedPrimary: "CORE", secondary: [], suggestedMetric: "DURATION" },
  },
  {
    match: /\b(crunch|sit[- ]?up|russian twist|leg raise|ab wheel|mountain climber)/,
    involvement: { suggestedPrimary: "CORE", secondary: [], suggestedMetric: "REPS" },
  },

  // --- whole-body ---------------------------------------------------------
  {
    match: /\b(clean|snatch|thruster|burpee|jerk)/,
    involvement: { suggestedPrimary: "FULL_BODY", secondary: ["LEGS", "SHOULDERS", "BACK", "CORE"] },
  },
  {
    match: /\b(farmer|carry|suitcase)/,
    involvement: { suggestedPrimary: "FULL_BODY", secondary: ["CORE", "BACK", "ARMS"] },
  },
];

function normalise(name: string): string {
  return ` ${name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()} `;
}

/**
 * The secondary groups a movement works, and a primary to fall back on.
 * Returns null when nothing matches — an unknown movement keeps whatever group
 * it is filed under and shades nothing extra, which is the honest default.
 */
export function involvementFor(name: string): Involvement | null {
  const n = normalise(name);
  for (const r of RULES) if (r.match.test(n)) return r.involvement;
  return null;
}

/**
 * Resolve a movement to the groups it lights up on the body map.
 * `filed` is the group the person put it under and always wins for primary.
 */
export function groupsFor(
  name: string,
  filed: MuscleGroup | null,
): {
  primary: MuscleGroup | null;
  secondary: MuscleGroup[];
  view: "front" | "back" | "both";
} {
  const inv = involvementFor(name);
  const primary = inv?.forcePrimary ? inv.suggestedPrimary : (filed ?? inv?.suggestedPrimary ?? null);
  // Where someone files a movement under a different group than the anatomy
  // suggests — a deadlift kept under Core — the suggested primary becomes a
  // secondary rather than disappearing. Otherwise that deadlift would shade
  // no legs at all, which is worse than either answer on its own.
  const all = inv ? [...inv.secondary, inv.suggestedPrimary] : [];
  const secondary = all.filter((g, i) => g !== primary && all.indexOf(g) === i);
  return { primary, secondary, view: inv?.view ?? "both" };
}

/**
 * Which body-map region selects this movement.
 *
 * Explicit wins; otherwise the movement is reached from whatever group it is
 * filed under. A movement filed under nothing has no region, and is reached
 * from its own progress block instead of from the body.
 */
export function navRegionFor(
  name: string,
  filed: MuscleGroup | null,
): NavRegion | null {
  const inv = involvementFor(name);
  if (inv?.navRegion) return inv.navRegion;
  const g = filed ?? inv?.suggestedPrimary ?? null;
  if (g === null) return null;
  // FULL_BODY has no single place on the body to press; Deadlift is reached
  // from the lower back and glutes.
  if (g === "DEADLIFT") return "POSTERIOR_HIP";
  return g === "FULL_BODY" ? null : (g as NavRegion);
}

/** The group a movement is listed under (v0.671): the hinge family is
 *  Deadlift, and the lower-back moves in it "LOWER_BACK" (v0.672), whatever
 *  they're filed under; everything else keeps its filing. */
export function shownGroup(name: string, filed: string | null): string | null {
  const inv = involvementFor(name);
  if (inv?.shownAs) return inv.shownAs;
  return inv?.forcePrimary ? inv.suggestedPrimary : filed;
}
