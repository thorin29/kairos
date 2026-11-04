import "server-only";
import { prisma } from "@/lib/prisma";
import { getSetting, setSetting } from "@/lib/settings";
import { defaultMetricFor } from "@/lib/workouts/catalog";
import {
  DEFAULT_EQUIPMENT,
  LIBRARY,
  planLibraryMerge,
  type EquipmentItem,
  type LibraryMovement,
} from "@/lib/workouts/library";

export const EQUIPMENT_KEY = "workouts.equipment";

/** Clean an equipment list from a form or the setting. */
export function cleanEquipment(raw: unknown): EquipmentItem[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: EquipmentItem[] = [];
  for (const r of raw.slice(0, 40)) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    const label = String(o.label ?? "").trim().slice(0, 40);
    if (!label) continue;
    let key = String(o.key ?? "")
      .toLowerCase()
      .replace(/[^a-z0-9_]+/g, "_")
      .replace(/^_|_$/g, "")
      .slice(0, 30);
    if (!key) key = label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 30);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const unit = (["lb", "kg", "in", ""] as const).find((u) => u === o.unit) ?? "";
    const sizes = (Array.isArray(o.sizes) ? o.sizes : [])
      .map(Number)
      .filter((n) => Number.isFinite(n) && n > 0 && n <= 1000)
      .map((n) => Math.round(n * 100) / 100);
    out.push({
      key,
      label,
      have: o.have !== false,
      sizes: [...new Set(sizes)].sort((a, b) => a - b).slice(0, 30),
      unit,
    });
  }
  return out;
}

/** The household's equipment: what's saved, else the starting list. */
export async function loadEquipment(): Promise<EquipmentItem[]> {
  const raw = await getSetting(EQUIPMENT_KEY);
  if (!raw) return DEFAULT_EQUIPMENT.map((e) => ({ ...e, sizes: [...e.sizes] }));
  try {
    const list = cleanEquipment(JSON.parse(raw));
    return list.length ? list : DEFAULT_EQUIPMENT.map((e) => ({ ...e, sizes: [...e.sizes] }));
  } catch {
    return DEFAULT_EQUIPMENT.map((e) => ({ ...e, sizes: [...e.sizes] }));
  }
}

export async function saveEquipment(list: unknown): Promise<EquipmentItem[]> {
  const clean = cleanEquipment(list);
  await setSetting(EQUIPMENT_KEY, JSON.stringify(clean));
  return clean;
}

export type LibraryStatus = {
  total: number;
  /** Library movements not in the pool yet, for "pick". */
  add: { key: string; name: string; category: string; muscleGroup: string | null }[];
  /** Pool movements that would pick up tags and a how-to. */
  tag: number;
};

async function poolForMerge() {
  return (await prisma.poolExercise.findMany({
    select: { id: true, name: true, category: true, libraryKey: true, ownerId: true },
  })) as { id: string; name: string; category: string; libraryKey: string | null; ownerId: string | null }[];
}

export async function libraryStatus(): Promise<LibraryStatus> {
  const plan = planLibraryMerge(await poolForMerge());
  return {
    total: LIBRARY.length,
    add: plan.add.map((e) => ({ key: e.key, name: e.name, category: e.category, muscleGroup: e.muscleGroup })),
    tag: plan.tag.length,
  };
}

const tags = (e: LibraryMovement) => ({
  libraryKey: e.key,
  pattern: e.pattern,
  equipment: e.equipment.join(","),
  ladderKey: e.ladder?.[0] ?? null,
  ladderStep: e.ladder?.[1] ?? null,
});

/**
 * Add library movements to the shared pool (all, or the picked keys) and tag
 * every matching pool movement. Existing names, settings and how-tos are kept;
 * a missing how-to is filled. Running it again does nothing new.
 */
export async function applyLibrary(keys?: readonly string[] | null): Promise<{ added: number; tagged: number }> {
  const plan = planLibraryMerge(await poolForMerge());
  const pick = keys ? new Set(keys) : null;
  const add = pick ? plan.add.filter((e) => pick.has(e.key)) : plan.add;

  let tagged = 0;
  for (const t of plan.tag) {
    const row = (await prisma.poolExercise.findUnique({
      where: { id: t.id },
      select: { about: true, metric: true, category: true },
    })) as { about: string | null; metric: string | null; category: string } | null;
    if (!row) continue;
    // A bodyweight movement with no "Logs as" of its own logs reps (v0.629).
    const reps = !row.metric && row.category === t.entry.category && t.entry.metric === "REPS";
    await prisma.poolExercise.update({
      where: { id: t.id },
      data: { ...tags(t.entry), ...(row.about ? {} : { about: t.entry.about }), ...(reps ? { metric: "REPS" as never } : {}) },
    });
    tagged++;
  }

  const counts = new Map<string, number>();
  let added = 0;
  for (const e of add) {
    const base =
      counts.get(e.category) ?? (await prisma.poolExercise.count({ where: { category: e.category as never } }));
    counts.set(e.category, base + 1);
    const ok = await prisma.poolExercise
      .create({
        data: {
          category: e.category as never,
          name: e.name,
          muscleGroup: e.category === "WEIGHTS" ? (e.muscleGroup as never) : null,
          metric: e.metric === defaultMetricFor(e.category) ? null : (e.metric as never),
          sortOrder: base,
          about: e.about,
          ...tags(e),
        },
      })
      .then(() => true)
      .catch(() => false);
    if (ok) added++;
  }
  return { added, tagged };
}

/** Set or clear a movement's how-to. */
export async function setPoolAbout(id: string, about: string): Promise<void> {
  const clean = about.trim().slice(0, 600);
  await prisma.poolExercise.update({ where: { id }, data: { about: clean || null } }).catch(() => {});
}
