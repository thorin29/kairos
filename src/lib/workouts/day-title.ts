/**
 * The home card's workout line (v0.638): the day's main workout as the
 * title, everything else under it, each thing once.
 *
 * The title is a program's main lifts ("5/3/1 · Bench press"), else the
 * strength work (a muscle group, a Core day), else conditioning, else cardio,
 * else whatever there is. The line under it is the rest — never the warm-up,
 * and never something the title already says.
 */
import { CARDIO_CATEGORIES } from "@/lib/workouts/blocks";

export type CardEntry = {
  name: string;
  category: string | null;
  /** A Conditioning entry's chosen workout. */
  hiitName?: string | null;
  /** The program's main lifts in this entry (names). */
  mains?: string[];
};

export function cardLines(entries: readonly CardEntry[], programName: string | null): { title: string | null; extras: string[] } {
  const items = entries.filter((e) => e.category !== "WARMUP");
  const label = (e: CardEntry) => {
    const own = programName ? e.name.trim().replace(` · ${programName}`, "") : e.name.trim();
    if (e.category === "HIIT" || e.hiitName) return e.hiitName ?? (own || "Conditioning");
    return own;
  };
  const uniq = (xs: string[]) => {
    const out: string[] = [];
    for (const x of xs) if (x && !out.some((o) => o.toLowerCase() === x.toLowerCase())) out.push(x);
    return out;
  };

  let title: string | null = null;
  let used: CardEntry[] = [];
  const mains = programName ? uniq(items.flatMap((e) => e.mains ?? [])) : [];
  if (mains.length) {
    title = [programName as string, ...mains].join(" · ");
    used = items.filter((e) => (e.mains ?? []).length > 0);
  } else {
    const tiers: ((e: CardEntry) => boolean)[] = [
      (e) => e.category === "WEIGHTS" || e.category == null,
      (e) => e.category === "HIIT" || !!e.hiitName,
      (e) => !!e.category && CARDIO_CATEGORIES.includes(e.category),
      () => true,
    ];
    for (const tier of tiers) {
      const hit = items.filter((e) => tier(e) && label(e));
      if (hit.length) {
        used = hit;
        title = uniq(hit.map(label)).join(" · ");
        break;
      }
    }
  }
  const said = new Set((title ?? "").toLowerCase().split(" · "));
  const extras = uniq(items.filter((e) => !used.includes(e)).map(label)).filter((x) => !said.has(x.toLowerCase()));
  return { title, extras };
}
