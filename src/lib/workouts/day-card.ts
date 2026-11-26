/**
 * The home tile's workout list (v0.798, shared with the web in v0.799): each
 * workout by name with its done state, and the kinds the plan covers. The
 * planned workout is named from the day's title after the first " · "
 * ("Core · Hanging core" → "Hanging core"); a kind is the part before " · "
 * of the title and of each extra ("Isometric · Rack pulls and holds" →
 * "Isometric").
 */
export type WorkoutCard = {
  /** `detail` (v0.805): the plan's kinds, under the planned workout only. */
  items: { name: string; done: boolean; detail: string | null }[];
  kinds: string[];
};

const DOT = " · ";

function split(t: string): [string | null, string] {
  const i = t.indexOf(DOT);
  return i < 0 ? [null, t] : [t.slice(0, i), t.slice(i + DOT.length)];
}

export function workoutCard(
  items: readonly { name: string | null; done: boolean; plan?: boolean }[],
  title: string | null,
  extras: readonly string[],
): WorkoutCard {
  const [titleKind, mainName] = title ? split(title) : [null, null];
  const kinds: string[] = [];
  for (const k of [titleKind, ...extras.map((x) => split(x)[0] ?? x)]) {
    if (k && !kinds.some((o) => o.toLowerCase() === k.toLowerCase())) kinds.push(k);
  }
  const firstPlan = items.findIndex((i) => i.plan);
  const detail = kinds.length ? kinds.join(DOT) : null;
  return {
    items: items.map((i, n) => ({ name: i.name ?? mainName ?? "Workout", done: i.done, detail: n === firstPlan ? detail : null })),
    kinds,
  };
}

/**
 * The day's workout chip counts its workouts (v0.808), the same as the tile:
 * on a day with two or more (a practice or game as well as the plan), today's
 * part of the Workout bar becomes blocks done / total; overdue workout days
 * still count as they did. A day with only a practice gets a bar.
 */
export function workoutBar<B extends { category: string; total: number; complete: number; overdue: number }>(
  bars: B[],
  blocks: { done: number; total: number } | null,
  make: (total: number, complete: number, overdue: number) => B,
  order: readonly string[],
): B[] {
  if (!blocks) return bars;
  const i = bars.findIndex((b) => b.category === "EXERCISE");
  const late = i >= 0 ? bars[i].overdue : 0;
  // Overdue workout prompts are still pending, so they're in total, not complete.
  const bar = make(blocks.total + late, blocks.done, late);
  if (i >= 0) return bars.map((b, n) => (n === i ? bar : b));
  const out = [...bars, bar];
  return out.sort((a, b) => order.indexOf(a.category) - order.indexOf(b.category));
}
