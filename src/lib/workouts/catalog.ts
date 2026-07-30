/**
 * Dependency-free workout metadata, safe to import on client or server. Phase
 * one is weightlifting; the shape is here for the other categories to fill in.
 */

export type UnitSystem = "imperial" | "metric";
export const UNIT_SYSTEM_KEY = "unitSystem";

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
