/**
 * Dumbbells and kettlebells (v0.648): a set's weight is always ONE bell's —
 * the number on it — whether it's one in each hand (a fly, a press, a farmer
 * carry) or one held in both (a goblet squat). That matches the equipment
 * sizes, the finisher's picks and every record, so nothing is doubled or
 * halved anywhere; the movement's ⓘ says so.
 */
export type Bell = "dumbbell" | "kettlebell";

export function bellOf(name: string, equipment?: string | null): Bell | null {
  const eq = (equipment ?? "").toLowerCase();
  const n = name.toLowerCase();
  if (eq.includes("dumbbells") || /\bdumbbells?\b|\bdb\b/.test(n)) return "dumbbell";
  if (eq.includes("kettlebells") || /\bkettlebells?\b|\bkb\b/.test(n)) return "kettlebell";
  return null;
}

/** The ⓘ line for a bell movement. */
export function bellWeightNote(bell: Bell): string {
  return `Weight: one ${bell}, the number on it, even with one in each hand.`;
}

/** A movement's ⓘ text with the bell line added when it uses one. */
export function aboutWithBellNote(about: string | null, name: string, equipment?: string | null): string | null {
  const bell = bellOf(name, equipment);
  if (!bell) return about;
  return [about?.trim(), bellWeightNote(bell)].filter(Boolean).join(" ");
}

/**
 * Bell sizes on hand (v0.694): the next one up from `w`, or null when `w` is
 * already the heaviest. A weight step on dumbbells goes to the next bell the
 * household owns (10 → 20 with 5, 10, 20), never a size that isn't there.
 */
export function nextBell(w: number, sizes: readonly number[]): number | null {
  return [...sizes].sort((a, b) => a - b).find((s) => s > w + 1e-9) ?? null;
}

/** The heaviest bell at or under `w`, else the lightest there is. */
export function bellAtOrUnder(w: number, sizes: readonly number[]): number {
  const sorted = [...sizes].sort((a, b) => a - b);
  return sorted.filter((s) => s <= w + 1e-9).pop() ?? sorted[0];
}
