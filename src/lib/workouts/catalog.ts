/**
 * Dependency-free workout metadata, safe to import on client or server. Phase
 * one is weightlifting; the shape is here for the other categories to fill in.
 */

export type UnitSystem = "imperial" | "metric";
export const UNIT_SYSTEM_KEY = "unitSystem";

// Weights units are set per muscle group in the pool (not a global system).
export type WeightUnit = "lb" | "kg";
export const DEFAULT_WEIGHT_UNIT: WeightUnit = "lb";
export function weightUnitKey(mg: MuscleGroup): string {
  return `weightUnit.${mg}`;
}

export type WorkoutCategory =
  | "WEIGHTS"
  | "RUNNING"
  | "ROWING"
  | "SPORT"
  | "STRETCHING"
  | "HIIT"
  | "ISOMETRIC"
  | "RUCKING";

export type Implement =
  | "BARBELL"
  | "DUMBBELL"
  | "KETTLEBELL"
  | "BODYWEIGHT"
  | "NONE";

export type Metric = "WEIGHT" | "DISTANCE" | "METERS" | "DURATION" | "REPS";

export const CATEGORY_LABEL: Record<WorkoutCategory, string> = {
  WEIGHTS: "Weights",
  RUNNING: "Running",
  ROWING: "Rowing",
  SPORT: "Sport",
  STRETCHING: "Stretching",
  HIIT: "HIIT",
  ISOMETRIC: "Isometric",
  RUCKING: "Rucking",
};

export const IMPLEMENT_LABEL: Record<Implement, string> = {
  BARBELL: "Barbell",
  DUMBBELL: "Dumbbell",
  KETTLEBELL: "Kettlebell",
  BODYWEIGHT: "Bodyweight",
  NONE: "None",
};

// Phase-one order: only categories with real UI show up.
export const IMPLEMENTED_CATEGORIES: WorkoutCategory[] = ["WEIGHTS"];

// The five lifts offered as one-tap adds; each disappears from the offer once
// a person has added it.
export const WEIGHT_BASICS: { name: string; implement: Implement }[] = [
  { name: "Bench press", implement: "BARBELL" },
  { name: "Deadlift", implement: "BARBELL" },
  { name: "Squat", implement: "BARBELL" },
  { name: "Shoulder press", implement: "BARBELL" },
  { name: "Barbell row", implement: "BARBELL" },
];

/** Kettlebells are conventionally kilos; everything else follows the house. */
export function defaultWeightUnit(
  system: UnitSystem,
  implement: Implement | null | undefined,
): "lb" | "kg" {
  if (implement === "KETTLEBELL") return "kg";
  return system === "metric" ? "kg" : "lb";
}

// A stable, distinct colour per graphed lift. Falls back through the palette
// for custom exercises beyond the basics.
export const LINE_COLORS = [
  "#0f5c63", // bench — teal (the app accent)
  "#b45309", // deadlift — amber
  "#7c3aed", // squat — violet
  "#be123c", // press — rose
  "#1d4ed8", // row — blue
  "#0891b2",
  "#c026d3",
  "#ca8a04",
  "#047857",
  "#db2777",
];

// Built-in weights sub-categories, for organising the pool of lifts.
export type MuscleGroup =
  | "CHEST"
  | "BACK"
  | "SHOULDERS"
  | "LEGS"
  | "ARMS"
  | "CORE"
  | "FULL_BODY";

export const MUSCLE_GROUPS: MuscleGroup[] = [
  "CHEST",
  "BACK",
  "SHOULDERS",
  "LEGS",
  "ARMS",
  "CORE",
  "FULL_BODY",
];

export const MUSCLE_GROUP_LABEL: Record<MuscleGroup, string> = {
  CHEST: "Chest",
  BACK: "Back",
  SHOULDERS: "Shoulders",
  LEGS: "Legs",
  ARMS: "Arms",
  CORE: "Core",
  FULL_BODY: "Full body",
};

// HIIT / CrossFit workout types and how each one's single result reads.
export type WorkoutType =
  | "AMRAP"
  | "FOR_TIME"
  | "MAX_SETS"
  | "FOR_REPS"
  | "STATIONS"
  | "TIMED_STATIONS"
  | "PYRAMID"
  | "TABATA";

// Types offered in the builder, in a sensible order. MAX_SETS is kept in the
// enum for older logged data but isn't offered for new workouts (FOR_REPS
// replaces it).
export const WORKOUT_TYPES: WorkoutType[] = [
  "FOR_TIME",
  "FOR_REPS",
  "AMRAP",
  "TABATA",
  "STATIONS",
  "TIMED_STATIONS",
  "PYRAMID",
];

export const WORKOUT_TYPE_LABEL: Record<WorkoutType, string> = {
  AMRAP: "AMRAP",
  FOR_TIME: "For time",
  MAX_SETS: "Max sets",
  FOR_REPS: "For reps",
  STATIONS: "Stations",
  TIMED_STATIONS: "Timed stations",
  PYRAMID: "Pyramid",
  TABATA: "Tabata",
};

// A one-line hint describing how each type works, shown in the builder.
export const WORKOUT_TYPE_HINT: Record<WorkoutType, string> = {
  AMRAP: "As many rounds as possible within a time cap.",
  FOR_TIME: "Complete the work as fast as you can.",
  MAX_SETS: "As many sets/reps as possible.",
  FOR_REPS: "Total reps completed.",
  STATIONS: "A set number of reps at each station.",
  TIMED_STATIONS: "A fixed time at each station.",
  PYRAMID: "Reps climb then fall (or count up/down).",
  TABATA: "20s work / 10s rest \u00d7 8 rounds (4 min).",
};

// The metric each type records for its single result, and the field label.
export function hiitResult(type: WorkoutType): { metric: Metric; label: string } {
  switch (type) {
    case "FOR_TIME":
    case "STATIONS":
    case "PYRAMID":
      return { metric: "DURATION", label: "Time" };
    case "AMRAP":
      return { metric: "REPS", label: "Rounds" };
    case "MAX_SETS":
    case "FOR_REPS":
    case "TIMED_STATIONS":
    case "TABATA":
      return { metric: "REPS", label: "Total reps" };
  }
}

// Which type-level config a workout of this type needs.
export function hiitConfig(type: WorkoutType): {
  cap: boolean; // AMRAP time cap / timed-station duration
  capLabel: string;
  pyramid: boolean;
} {
  switch (type) {
    case "AMRAP":
      return { cap: true, capLabel: "Time cap (min)", pyramid: false };
    case "TIMED_STATIONS":
      return { cap: true, capLabel: "Seconds per station", pyramid: false };
    case "PYRAMID":
      return { cap: false, capLabel: "", pyramid: true };
    default:
      return { cap: false, capLabel: "", pyramid: false };
  }
}

// Infer, from a movement's name, what to record for it in a HIIT workout:
// running-type movements take a distance; weighted equipment takes reps and a
// weight; everything else is plain reps.
export type HiitInput = "REPS" | "DISTANCE" | "REPS_WEIGHT";
export function inferHiitInput(name: string): HiitInput {
  const n = name.toLowerCase();
  if (/\b(runs?|running|sprints?|jogs?|jogging)\b/.test(n)) return "DISTANCE";
  if (/(kettlebell|barbell|dumbbell|\bclubs?\b|weighted|weights?)/.test(n)) {
    return "REPS_WEIGHT";
  }
  return "REPS";
}

// One movement's line in a workout, e.g. "1 mi Run" or "21 Thruster @ 95 lb".
export type HiitMoveLite = {
  name: string;
  reps: number | null;
  distance: number | null;
  weight: number | null;
};
export function formatHiitMovement(m: HiitMoveLite): string {
  if (m.distance != null) return `${m.distance} mi ${m.name}`;
  const reps = m.reps != null ? `${m.reps} ` : "";
  const wt = m.weight != null ? ` @ ${m.weight} lb` : "";
  return `${reps}${m.name}${wt}`;
}

// Categories that hold a pool of named movements (the metric-only ones —
// running, rowing, rucking — don't need a sub-pool).
export const POOL_CATEGORIES: WorkoutCategory[] = [
  "WEIGHTS",
  "HIIT",
  "SPORT",
  "STRETCHING",
  "ISOMETRIC",
];

// Metric-only categories: no named movements, just a number when you finish.
export const METRIC_ONLY_CATEGORIES: WorkoutCategory[] = [
  "RUNNING",
  "ROWING",
  "RUCKING",
];

// The metric a category records by default, and (where the user gets a say)
// the choices offered. Shared by the one-off logger and the plan builder so
// the two never drift.
export function defaultMetricFor(category: WorkoutCategory): Metric {
  switch (category) {
    case "WEIGHTS":
      return "WEIGHT";
    case "RUNNING":
    case "RUCKING":
      return "DISTANCE";
    case "ROWING":
      return "METERS";
    default:
      return "DURATION"; // SPORT / HIIT / STRETCHING / ISOMETRIC
  }
}

export function metricChoicesFor(category: WorkoutCategory): Metric[] {
  switch (category) {
    case "WEIGHTS":
      return ["WEIGHT"];
    case "RUNNING":
    case "RUCKING":
      return ["DISTANCE"];
    case "ROWING":
      return ["METERS"];
    default:
      return ["DURATION", "REPS"];
  }
}

export const METRIC_LABEL_SHORT: Record<Metric, string> = {
  WEIGHT: "Weight",
  DISTANCE: "Distance",
  METERS: "Meters",
  DURATION: "Time",
  REPS: "Reps / rounds",
};

// The unit shown next to a metric input. Duration is entered in minutes on the
// completion form (converted to seconds on save).
export function metricUnit(metric: Metric, system: UnitSystem): string {
  switch (metric) {
    case "WEIGHT":
      return system === "metric" ? "kg" : "lb";
    case "DISTANCE":
      return system === "metric" ? "km" : "mi";
    case "METERS":
      return "m";
    case "REPS":
      return "reps";
    case "DURATION":
      return "min";
  }
}
