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
