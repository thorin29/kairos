/** Admin-only chore effort weighting. Dependency-free, safe anywhere. */

export type EffortLevel = {
  value: number;
  label: string;
  short: string;
  color: string;
};

export const EFFORT_LEVELS: EffortLevel[] = [
  { value: 1, label: "Easy", short: "E", color: "#16a34a" },
  { value: 2, label: "Average", short: "A", color: "#d97706" },
  { value: 3, label: "Hard", short: "H", color: "#dc2626" },
];

export function effortMeta(value: number): EffortLevel {
  return EFFORT_LEVELS.find((l) => l.value === value) ?? EFFORT_LEVELS[1];
}

/** The next level, wrapping — for a click-to-cycle badge. */
export function nextEffort(value: number): number {
  const i = EFFORT_LEVELS.findIndex((l) => l.value === value);
  return EFFORT_LEVELS[(i + 1) % EFFORT_LEVELS.length].value;
}
