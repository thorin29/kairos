/**
 * Sore spots (v0.675): an area marked sore stays marked until the person says
 * it's better — never on its own. Marked from the body map, or by answering
 * "Something hurt?" after a movement. While marked, the body map shows it, the
 * day page offers to work around it when today loads it, and Adjust today
 * opens Hurt on it. Pure.
 */
import { HURT_AREAS, HURT_LABEL, type HurtArea as FeedbackArea } from "@/lib/workouts/catalog";

export type SoreArea = Exclude<FeedbackArea, "OTHER">;
export const SORE_AREAS: readonly SoreArea[] = HURT_AREAS.filter((a): a is SoreArea => a !== "OTHER");
export const SORE_LABEL: Record<SoreArea, string> = Object.fromEntries(SORE_AREAS.map((a) => [a, HURT_LABEL[a]])) as Record<SoreArea, string>;

export type SoreSpot = {
  area: SoreArea;
  /** The day it was marked. */
  since: string;
  /** The movement whose "Something hurt?" marked it; null from the body map. */
  from: string | null;
};

export const isSoreArea = (v: unknown): v is SoreArea => typeof v === "string" && (SORE_AREAS as readonly string[]).includes(v);

/** Stored spots read back, oldest first, one per area. */
export function parseSore(raw: string | null | undefined): SoreSpot[] {
  if (!raw) return [];
  try {
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    const out: SoreSpot[] = [];
    for (const x of list) {
      if (!x || !isSoreArea(x.area) || typeof x.since !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(x.since)) continue;
      if (out.some((s) => s.area === x.area)) continue;
      out.push({ area: x.area, since: x.since, from: typeof x.from === "string" ? x.from.slice(0, 80) : null });
    }
    return out.sort((a, b) => (a.since < b.since ? -1 : 1));
  } catch {
    return [];
  }
}

/** Mark an area; one already marked keeps its first day. */
export function withSore(list: readonly SoreSpot[], spot: SoreSpot): SoreSpot[] {
  if (list.some((s) => s.area === spot.area)) return [...list];
  return [...list, spot].sort((a, b) => (a.since < b.since ? -1 : 1));
}

export const withoutSore = (list: readonly SoreSpot[], area: SoreArea): SoreSpot[] => list.filter((s) => s.area !== area);

/**
 * Where each area is on the body map (indices into FRONT_PATHS / BACK_PATHS,
 * the same order in the app's BodyMapPaths.kt). Joints that sit between
 * regions take the regions around them.
 */
export const SORE_PATHS: Record<SoreArea, { front: number[]; back: number[] }> = {
  NECK: { front: [1], back: [5, 6] },
  SHOULDER: { front: [18, 19], back: [17, 18] },
  ELBOW: { front: [24, 25, 26, 27], back: [23, 24, 25, 26] },
  WRIST: { front: [2, 3], back: [1, 2] },
  UPPER_BACK: { front: [], back: [5, 6, 7, 8, 9, 10] },
  LOWER_BACK: { front: [], back: [11, 12, 13, 14] },
  HIP: { front: [28, 29], back: [15, 16] },
  KNEE: { front: [34, 35, 36], back: [31] },
  ANKLE: { front: [4, 5], back: [3, 4] },
};
