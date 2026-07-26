/** Admin-only chore effort weighting on a 1-5 scale. Dependency-free. */

export const EFFORT_MIN = 1;
export const EFFORT_MAX = 5;
export const EFFORT_DEFAULT = 3;

export const EFFORT_VALUES = [1, 2, 3, 4, 5];

export function clampEffort(value: number): number {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return EFFORT_DEFAULT;
  return Math.min(EFFORT_MAX, Math.max(EFFORT_MIN, n));
}

// Green (light) through amber to red (hard), so a heavy chore reads at a
// glance.
const EFFORT_COLORS: Record<number, string> = {
  1: "#16a34a",
  2: "#65a30d",
  3: "#d97706",
  4: "#ea580c",
  5: "#dc2626",
};

export function effortColor(value: number): string {
  return EFFORT_COLORS[clampEffort(value)] ?? EFFORT_COLORS[3];
}
