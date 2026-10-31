/**
 * How a day's planned workouts are laid out on the day page: sections in the
 * person's order (by default Warm-up, Cardio, each muscle group, Conditioning,
 * Stretching, Sport; anything else last), the page title, how far through the
 * day is, and the week strip. Pure, shared by the web and the phone's day
 * endpoint (the phone mirrors blockKind in WorkoutLogScreen.kt).
 */
import {
  MUSCLE_GROUP_LABEL,
  defaultMetricFor,
  type Metric,
  type MuscleGroup,
  type WorkoutCategory,
} from "@/lib/workouts/catalog";

export type BlockKind = "WARMUP" | "CARDIO" | "STRENGTH" | "CONDITIONING" | "STRETCH" | "SPORT" | "OTHER";

/** The sections a person can put in order (OTHER always comes last). */
export const SECTION_KINDS = ["WARMUP", "CARDIO", "STRENGTH", "CONDITIONING", "STRETCH", "SPORT"] as const;
export type SectionKind = (typeof SECTION_KINDS)[number];
/** The order before anyone sets one: the mockup's. */
export const DEFAULT_ORDER: readonly SectionKind[] = SECTION_KINDS;

/** A saved or sent order made safe: known kinds once each, any missing ones
 *  added where the default has them. */
export function cleanOrder(raw: unknown): SectionKind[] {
  const known = new Set<string>(SECTION_KINDS);
  const out: SectionKind[] = [];
  if (Array.isArray(raw)) {
    for (const k of raw) if (typeof k === "string" && known.has(k) && !out.includes(k as SectionKind)) out.push(k as SectionKind);
  }
  for (const k of DEFAULT_ORDER) {
    if (out.includes(k)) continue;
    const at = DEFAULT_ORDER.indexOf(k);
    // Right after the last kind the default puts before it (else first).
    let after = -1;
    out.forEach((x, i) => {
      if (DEFAULT_ORDER.indexOf(x) < at) after = i;
    });
    out.splice(after + 1, 0, k);
  }
  return out;
}

/** Warm-up and Cardio plans hold no movements: done with a tap, or by any
 *  cardio logged that day. */
export function isSimpleCategory(category: string | null | undefined): boolean {
  return category === "WARMUP" || category === "CARDIO";
}

/** Categories whose sessions count as cardio (a Cardio plan is done by any). */
export const CARDIO_CATEGORIES: readonly string[] = ["CARDIO", "ROWING", "RUNNING", "RUCKING"];

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
    case "CARDIO":
    case "ROWING":
    case "RUNNING":
    case "RUCKING":
      return "CARDIO";
    case "WARMUP":
      return "WARMUP";
    case "STRETCHING":
      return "STRETCH";
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
  STRETCH: "Stretching",
  SPORT: "Sport",
  OTHER: "Other",
};

/** A section's name in the order editor. */
export const KIND_LABEL: Record<SectionKind, string> = {
  WARMUP: "Warm-up",
  CARDIO: "Cardio",
  STRENGTH: "Strength (each muscle group)",
  CONDITIONING: "Conditioning",
  STRETCH: "Stretching",
  SPORT: "Sport",
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
export function daySections(
  workouts: readonly DayWorkoutIn[],
  order: readonly SectionKind[] = DEFAULT_ORDER,
): DaySection[] {
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

  const kinds: BlockKind[] = [...cleanOrder(order), "OTHER"];
  return kinds.flatMap((k) => seen.filter((s) => s.kind === k));
}

/**
 * A Cardio section on a day that has cardio logged but none planned (a row
 * that just got done), placed where the person's order puts Cardio.
 */
export function withCardio(
  sections: DaySection[],
  hasCardio: boolean,
  order: readonly SectionKind[] = DEFAULT_ORDER,
): DaySection[] {
  if (!hasCardio || sections.some((s) => s.kind === "CARDIO")) return sections;
  const kinds: BlockKind[] = [...cleanOrder(order), "OTHER"];
  const at = kinds.indexOf("CARDIO");
  const i = sections.findIndex((s) => kinds.indexOf(s.kind) > at);
  const cardio: DaySection = { key: "k:CARDIO", kind: "CARDIO", title: KIND_TITLE.CARDIO, items: [] };
  return i < 0 ? [...sections, cardio] : [...sections.slice(0, i), cardio, ...sections.slice(i)];
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
