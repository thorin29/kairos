import "server-only";
import { prisma } from "@/lib/prisma";
import {
  LIBRARY_ROUTINES,
  LIB_PREFIX,
  cleanSteps,
  libraryRoutine,
  type WarmupRoutine,
  type WarmupStep,
} from "@/lib/workouts/warmup-library";

/**
 * Warm-up routines (v0.622): the library's and the person's own, a Warm-up
 * plan entry's choice, and saving or deleting one's own. A routine is only
 * shown — nothing in it is logged; the Warm-up is still done with its check.
 */

type Row = { id: string; name: string; steps: unknown };

const toRoutine = (r: Row): WarmupRoutine => ({ id: r.id, name: r.name, steps: cleanSteps(r.steps), mine: true });

/** The library's routines, then the person's own (A–Z). */
export async function routinesFor(userId: string): Promise<WarmupRoutine[]> {
  const own = (await prisma.warmupRoutine.findMany({
    where: { ownerId: userId },
    orderBy: { name: "asc" },
    select: { id: true, name: true, steps: true },
  })) as Row[];
  return [...LIBRARY_ROUTINES, ...own.map(toRoutine)];
}

/** One routine by its id, if the person may use it. */
export async function routineFor(userId: string, id: string | null | undefined): Promise<WarmupRoutine | null> {
  if (!id) return null;
  if (id.startsWith(LIB_PREFIX)) return libraryRoutine(id);
  const r = (await prisma.warmupRoutine.findFirst({
    where: { id, ownerId: userId },
    select: { id: true, name: true, steps: true },
  })) as Row | null;
  return r ? toRoutine(r) : null;
}

/** Several plan entries' routines at once (the day page), by routine id. */
export async function routinesById(userId: string, ids: (string | null)[]): Promise<Map<string, WarmupRoutine>> {
  const out = new Map<string, WarmupRoutine>();
  const own = [...new Set(ids.filter((x): x is string => !!x && !x.startsWith(LIB_PREFIX)))];
  for (const id of ids) {
    const lib = libraryRoutine(id);
    if (lib) out.set(lib.id, lib);
  }
  if (own.length) {
    const rows = (await prisma.warmupRoutine.findMany({
      where: { id: { in: own }, ownerId: userId },
      select: { id: true, name: true, steps: true },
    })) as Row[];
    for (const r of rows) out.set(r.id, toRoutine(r));
  }
  return out;
}

/** Save the person's own routine (new without an id). */
export async function saveRoutine(
  userId: string,
  input: { id?: string | null; name: unknown; steps: unknown },
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const name = typeof input.name === "string" ? input.name.trim().slice(0, 60) : "";
  if (name.length < 2) return { ok: false, error: "Name the warm-up." };
  const steps: WarmupStep[] = cleanSteps(input.steps);
  if (steps.length === 0) return { ok: false, error: "Add a step." };
  if (input.id && !input.id.startsWith(LIB_PREFIX)) {
    const n = (await prisma.warmupRoutine.updateMany({
      where: { id: input.id, ownerId: userId },
      data: { name, steps: steps as never },
    })) as { count: number };
    if (n.count === 1) return { ok: true, id: input.id };
  }
  const made = (await prisma.warmupRoutine.create({
    data: { ownerId: userId, name, steps: steps as never },
    select: { id: true },
  })) as { id: string };
  return { ok: true, id: made.id };
}

/** Delete one's own routine; plan entries that used it go back to a plain check. */
export async function deleteRoutine(userId: string, id: string): Promise<void> {
  const n = (await prisma.warmupRoutine.deleteMany({ where: { id, ownerId: userId } })) as { count: number };
  if (n.count > 0) await prisma.plannedWorkout.updateMany({ where: { userId, warmup: id }, data: { warmup: null } });
}

/** A Warm-up plan entry's routine (null: a plain check). */
export async function setPlanWarmup(userId: string, plannedWorkoutId: string, warmup: string | null): Promise<boolean> {
  if (warmup && !(await routineFor(userId, warmup))) return false;
  const n = (await prisma.plannedWorkout.updateMany({
    where: { id: plannedWorkoutId, userId, category: "WARMUP" },
    data: { warmup: warmup || null },
  })) as { count: number };
  return n.count === 1;
}

/** The day's Warm-up plan entries and their routines (null: a plain check). */
export async function warmupsForDay(
  userId: string,
  dateISO: string,
): Promise<{ plannedWorkoutId: string; routine: WarmupRoutine | null }[]> {
  const rows = (await prisma.plannedWorkout.findMany({
    where: { userId, dayOfWeek: new Date(`${dateISO}T00:00:00Z`).getUTCDay(), category: "WARMUP", isRest: false },
    select: { id: true, warmup: true },
  })) as { id: string; warmup: string | null }[];
  const byId = await routinesById(userId, rows.map((r) => r.warmup));
  return rows.map((r) => ({ plannedWorkoutId: r.id, routine: (r.warmup && byId.get(r.warmup)) || null }));
}
