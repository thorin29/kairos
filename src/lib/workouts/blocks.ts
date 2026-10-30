/**
 * How a day's planned workouts are laid out on the day page: sections in a
 * fixed order (Warm-up, Cardio, each muscle group, Conditioning, Sport, then
 * anything else), the page title, how far through the day is, and the week
 * strip. Pure, shared by the web and (later) the phone's day endpoint.
 */
import {
  MUSCLE_GROUP_LABEL,
  defaultMetricFor,
  type Metric,
  type MuscleGroup,
  type WorkoutCategory,
} from "@/lib/workouts/catalog";

export type BlockKind = "WARMUP" | "CARDIO" | "STRENGTH" | "CONDITIONING" | "SPORT" | "OTHER";

const ORDER: BlockKind[] = ["WARMUP", "CARDIO", "STRENGTH", "CONDITIONING", "SPORT", "OTHER"];

/** Metrics a movement is logged in set by set. Distance and metres stay one result. */
const SET_METRICS: ReadonlySet<string> = new Set(["WEIGHT", "REPS", "DURATION"]);

export type DayMovementIn = {
  poolExerciseId: string;
  name: string;
  tracked: boolean;
  metric: Metric | null;
};

export type DayWorkoutIn = {
  id: string;
  name: string;
  category: WorkoutCategory | null;
  muscleGroup: MuscleGroup | null;
  isRest: boolean;
  /** A named HIIT workout logs one result. */
  hasHiit: boolean;
  movements: DayMovementIn[];
};

export type DayItem =
  /** One movement, logged set by set on its own page. */
  | { type: "movement"; workoutId: string; poolExerciseId: string; name: string; metric: Metric }
  /** A movement the plan lists without asking for a number. */
  | { type: "untracked"; workoutId: string; poolExerciseId: string; name: string }
  /** A whole workout logged as before (warm-up, cardio, HIIT, one-result plans). */
  | { type: "card"; workoutId: string };

export type DaySection = { key: string; kind: BlockKind; title: string; items: DayItem[] };

/** Which block a planned workout belongs in, from its category. */
export function blockKind(category: WorkoutCategory | null, hasHiit: boolean): BlockKind {
  if (hasHiit || category === "HIIT") return "CONDITIONING";
  switch (category) {
    case "ROWING":
    case "RUNNING":
    case "RUCKING":
      return "CARDIO";
    case "STRETCHING":
      return "WARMUP";
    case "SPORT":
      return "SPORT";
    case "WEIGHTS":
    case "ISOMETRIC":
    case null:
      return "STRENGTH";
    default:
      return "OTHER";
  }
}

const KIND_TITLE: Record<BlockKind, string> = {
  WARMUP: "Warm-up",
  CARDIO: "Cardio",
  STRENGTH: "",
  CONDITIONING: "Conditioning",
  SPORT: "Sport",
  OTHER: "Other",
};

function resolvedMetric(m: DayMovementIn, category: WorkoutCategory | null): Metric {
  return m.metric ?? (category ? defaultMetricFor(category) : "WEIGHT");
}

/**
 * The day's sections. A strength workout is split into one item per movement
 * (each logged set by set) when every movement it tracks can be logged that
 * way; otherwise, and for every other kind of block, the workout stays one
 * card, logged as it always was. Two workouts for the same muscle group (two
 * "Arms" plans on a Monday) share one section: display only, nothing merged.
 */
export function daySections(workouts: readonly DayWorkoutIn[]): DaySection[] {
  const byKey = new Map<string, DaySection>();
  const seen: DaySection[] = [];
  const add = (key: string, kind: BlockKind, title: string, items: DayItem[]) => {
    let s = byKey.get(key);
    if (!s) {
      s = { key, kind, title, items: [] };
      byKey.set(key, s);
      seen.push(s);
    }
    s.items.push(...items);
  };

  for (const w of workouts) {
    if (w.isRest) continue;
    const kind = blockKind(w.category, w.hasHiit);
    if (kind !== "STRENGTH") {
      add(`k:${kind}`, kind, KIND_TITLE[kind], [{ type: "card", workoutId: w.id }]);
      continue;
    }
    const tracked = w.movements.filter((m) => m.tracked);
    const splittable =
      tracked.length > 0 && tracked.every((m) => SET_METRICS.has(resolvedMetric(m, w.category)));
    const key = w.muscleGroup ? `mg:${w.muscleGroup}` : `w:${w.id}`;
    const title = w.muscleGroup ? MUSCLE_GROUP_LABEL[w.muscleGroup] : w.name;
    if (!splittable) {
      add(key, "STRENGTH", title, [{ type: "card", workoutId: w.id }]);
      continue;
    }
    add(
      key,
      "STRENGTH",
      title,
      w.movements.map((m): DayItem =>
        m.tracked
          ? {
              type: "movement",
              workoutId: w.id,
              poolExerciseId: m.poolExerciseId,
              name: m.name,
              metric: resolvedMetric(m, w.category),
            }
          : { type: "untracked", workoutId: w.id, poolExerciseId: m.poolExerciseId, name: m.name },
      ),
    );
  }

  return ORDER.flatMap((k) => seen.filter((s) => s.kind === k));
}

/**
 * The page title: the muscle groups trained ("Chest", "Chest & legs",
 * "Chest · Legs · Arms"), or the other blocks' names on a day with no
 * strength work. Empty for an empty day.
 */
export function dayTitle(sections: readonly DaySection[]): string {
  const strength = sections.filter((s) => s.kind === "STRENGTH").map((s) => s.title);
  const names = strength.length > 0 ? strength : sections.map((s) => s.title);
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} & ${names[1].toLowerCase()}`;
  return names.join(" · ");
}

/** How far through the day is: items done (logged or skipped) of the items to do. */
export function dayProgress(
  sections: readonly DaySection[],
  isDone: (item: DayItem) => boolean,
): { done: number; total: number } {
  let done = 0;
  let total = 0;
  for (const s of sections) {
    for (const it of s.items) {
      if (it.type === "untracked") continue;
      total++;
      if (isDone(it)) done++;
    }
  }
  return { done, total };
}

export type StripState = "done" | "partial" | "rest" | "open" | "expired" | "today" | "none";

export type StripDayIn = {
  date: string;
  /** The day's workout task status, or null when nothing was planned. */
  task: "PENDING" | "COMPLETE" | "SKIPPED" | null;
  /** A rest day was taken. */
  rested: boolean;
  /** Anything logged that day (a session that isn't a rest). */
  logged: boolean;
};

/**
 * One day of the week strip. `overdue` is the set of past days still open for
 * logging (inside the Admin overdue window); a past day that isn't done and
 * isn't in it has expired.
 */
export function stripState(d: StripDayIn, todayISO: string, overdue: ReadonlySet<string>): StripState {
  if (d.rested) return "rest";
  if (d.task === "COMPLETE") return "done";
  if (d.task === "SKIPPED") return d.logged ? "done" : "rest";
  if (d.task === "PENDING") {
    if (d.date === todayISO) return d.logged ? "partial" : "today";
    if (overdue.has(d.date)) return d.logged ? "partial" : "open";
    return d.logged ? "partial" : "expired";
  }
  if (d.logged) return "done";
  return d.date === todayISO ? "today" : "none";
}
