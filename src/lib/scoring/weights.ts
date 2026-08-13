/**
 * Effort weights for the fairness score. Dependency-free so both the read
 * paths and any client display can share it.
 *
 * The base score is a per-person completion ratio — effort finished over
 * effort assigned — so absolute weights never decide who was handed more;
 * everyone can reach 100%. Weights only shape how much a single item moves
 * your own ratio.
 *
 * Chores carry a real 1-5 effort. Everything else is deliberately flat: a
 * workout, a Bible reading, a school assignment each count as one — the point
 * is doing them, not grading their difficulty. A hand-added task may carry an
 * admin weight; without one it counts as one too.
 */

export const DEFAULT_TASK_WEIGHT = 1;

export type WeightInput = {
  /** The chore's 1-5 effort, when this task was generated from a chore. */
  choreEffort: number | null;
  /** An admin-set weight on a one-off task, when present. */
  taskWeight: number | null;
};

/**
 * The effort a task contributes. A chore uses its chore's effort; a weighted
 * one-off uses its weight; anything else is the flat default.
 */
export function taskEffort({ choreEffort, taskWeight }: WeightInput): number {
  if (choreEffort != null && Number.isFinite(choreEffort)) {
    return choreEffort;
  }
  if (taskWeight != null && Number.isFinite(taskWeight)) {
    return taskWeight;
  }
  return DEFAULT_TASK_WEIGHT;
}

/**
 * Which scored group a category rolls up into on the summary. Chores,
 * workouts, Bible and school each get their own line; appointments, work
 * shifts and loose one-offs collect under "Tasks".
 */
export const SCORE_GROUPS = [
  { key: "CHORE", label: "Chores", categories: ["CHORE"] },
  { key: "EXERCISE", label: "Workouts", categories: ["EXERCISE"] },
  { key: "BIBLE", label: "Bible", categories: ["BIBLE"] },
  { key: "SCHOOL", label: "School", categories: ["SCHOOL"] },
  { key: "TASK", label: "Tasks", categories: ["WORK", "APPOINTMENT", "OTHER"] },
] as const;

export type ScoreGroupKey = (typeof SCORE_GROUPS)[number]["key"];

/** The group a raw category belongs to. */
export function groupForCategory(category: string): ScoreGroupKey {
  for (const g of SCORE_GROUPS) {
    if ((g.categories as readonly string[]).includes(category)) return g.key;
  }
  return "TASK";
}
