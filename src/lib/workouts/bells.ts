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
