import "server-only";
import { prisma } from "@/lib/prisma";
import { toDateColumn } from "@/lib/dates";
import { sportOn } from "@/lib/sport/day";
import {
  LIBRARY_ROUTINES,
  MOBILITY_ROUTINES,
  LIB_PREFIX,
  cleanSteps,
  libraryRoutine,
  dayFocus,
  parseWarmupChoice,
  pickWarmupId,
  withShoulderPrep,
  type RoutineKind,
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

/** The library's routines, then the person's own (A–Z), of one kind
 *  (warm-ups, or Mobility from v0.659). */
export async function routinesFor(userId: string, kind: RoutineKind = "warmup"): Promise<WarmupRoutine[]> {
  const own = (await prisma.warmupRoutine.findMany({
    where: { ownerId: userId, kind },
    orderBy: { name: "asc" },
    select: { id: true, name: true, steps: true },
  })) as Row[];
  return [...(kind === "mobility" ? MOBILITY_ROUTINES : LIBRARY_ROUTINES), ...own.map(toRoutine)];
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

/**
 * The day's warm-up routines (v0.655), keyed by each entry's stored choice
 * ("" for a plain check): "match" and rotations resolved for the date, and
 * Shoulder prep added on any day with weights.
 */
export async function dayWarmupRoutines(
  userId: string,
  dateISO: string,
  values: (string | null)[],
): Promise<Map<string, WarmupRoutine | null>> {
  // Warming up for the day's sport instead (v0.662): its routine, that day only.
  if (values.length > 0 && (await sportDayView(userId, dateISO))?.forSport) {
    return new Map(values.map((v) => [v ?? "", SPORT_WARMUP]));
  }
  const strength = (await prisma.plannedWorkout.findMany({
    where: {
      userId,
      dayOfWeek: new Date(`${dateISO}T00:00:00Z`).getUTCDay(),
      isRest: false,
      category: "WEIGHTS" as never,
      createdAt: { lt: new Date(Date.parse(`${dateISO}T00:00:00Z`) + 86_400_000) },
    },
    orderBy: { sortOrder: "asc" },
    select: { muscleGroup: true },
  })) as { muscleGroup: string | null }[];
  const weights = strength.length > 0;
  const focus = dayFocus(strength.map((s) => s.muscleGroup));
  const picked = values.map((v) => pickWarmupId(parseWarmupChoice(v), dateISO, focus));
  const byId = await routinesById(userId, picked);
  const out = new Map<string, WarmupRoutine | null>();
  values.forEach((v, i) => {
    const id = picked[i];
    out.set(v ?? "", withShoulderPrep((id && byId.get(id)) || null, weights, dateISO));
  });
  return out;
}

/** The day's Mobility routines (v0.659), keyed by each entry's stored
 *  choice: one routine or a weekly rotation; nothing added. */
export async function dayMobilityRoutines(
  userId: string,
  dateISO: string,
  values: (string | null)[],
): Promise<Map<string, WarmupRoutine | null>> {
  const picked = values.map((v) => {
    const c = parseWarmupChoice(v);
    return c?.mode === "match" ? null : pickWarmupId(c, dateISO, "full");
  });
  const byId = await routinesById(userId, picked);
  const out = new Map<string, WarmupRoutine | null>();
  values.forEach((v, i) => out.set(v ?? "", (picked[i] && byId.get(picked[i]!)) || null));
  return out;
}

/** Save the person's own routine (new without an id). */
export async function saveRoutine(
  userId: string,
  input: { id?: string | null; name: unknown; steps: unknown; kind?: RoutineKind },
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const kind: RoutineKind = input.kind === "mobility" ? "mobility" : "warmup";
  const name = typeof input.name === "string" ? input.name.trim().slice(0, 60) : "";
  if (name.length < 2) return { ok: false, error: kind === "mobility" ? "Name the routine." : "Name the warm-up." };
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
    data: { ownerId: userId, name, steps: steps as never, kind },
    select: { id: true },
  })) as { id: string };
  return { ok: true, id: made.id };
}

/** Delete one's own routine; plan entries that used it go back to a plain check. */
export async function deleteRoutine(userId: string, id: string): Promise<void> {
  const n = (await prisma.warmupRoutine.deleteMany({ where: { id, ownerId: userId } })) as { count: number };
  if (n.count > 0) await prisma.plannedWorkout.updateMany({ where: { userId, warmup: id }, data: { warmup: null } });
}

/** A Warm-up or Mobility plan entry's routine (null: a plain check). */
export async function setPlanWarmup(userId: string, plannedWorkoutId: string, warmup: string | null): Promise<boolean> {
  // One routine, "match", or "rot:<id>,…" (v0.655): every id must be usable.
  const choice = parseWarmupChoice(warmup);
  const ids = choice?.mode === "one" ? [choice.id] : choice?.mode === "rotation" ? choice.ids : [];
  for (const id of ids) if (!(await routineFor(userId, id))) return false;
  const n = (await prisma.plannedWorkout.updateMany({
    where: { id: plannedWorkoutId, userId, category: { in: ["WARMUP", "MOBILITY"] as never } },
    data: { warmup: warmup || null },
  })) as { count: number };
  return n.count === 1;
}

/** The day's Warm-up and Mobility plan entries and their routines (null: a
 *  plain check). */
export async function warmupsForDay(
  userId: string,
  dateISO: string,
): Promise<{ plannedWorkoutId: string; routine: WarmupRoutine | null }[]> {
  const rows = (await prisma.plannedWorkout.findMany({
    where: {
      userId,
      dayOfWeek: new Date(`${dateISO}T00:00:00Z`).getUTCDay(),
      category: { in: ["WARMUP", "MOBILITY"] as never },
      isRest: false,
    },
    select: { id: true, warmup: true, category: true },
  })) as { id: string; warmup: string | null; category: string }[];
  const warm = rows.filter((r) => r.category === "WARMUP");
  const mob = rows.filter((r) => r.category === "MOBILITY");
  const [w, m] = await Promise.all([
    dayWarmupRoutines(userId, dateISO, warm.map((r) => r.warmup)),
    dayMobilityRoutines(userId, dateISO, mob.map((r) => r.warmup)),
  ]);
  return rows.map((r) => ({
    plannedWorkoutId: r.id,
    routine: (r.category === "MOBILITY" ? m : w).get(r.warmup ?? "") ?? null,
  }));
}

// --- a sport on the day (v0.662) ----------------------------------------------

/** The warm-up for a game or skate: the library's Hockey legs. */
const SPORT_WARMUP: WarmupRoutine = libraryRoutine("lib:hockey-legs") as WarmupRoutine;
const FOR_KEY = "warmupFor";

/**
 * A day with a sport on the calendar: what it's called, whether the day's
 * Warm-up is for it instead of the planned workout (the plan's comes first
 * unless changed), and its routine. Null on a day without one.
 */
export type SportDayView = { label: string; forSport: boolean; routine: WarmupRoutine };

export async function sportDayView(userId: string, dateISO: string): Promise<SportDayView | null> {
  const sport = await sportOn(userId, dateISO);
  if (!sport) return null;
  const row = (await prisma.workoutSuggestionAnswer.findUnique({
    where: { userId_date_key_slot: { userId, date: toDateColumn(dateISO), key: FOR_KEY, slot: "" } },
    select: { answer: true },
  })) as { answer: string } | null;
  return { label: sport.title, forSport: row?.answer === "sport", routine: SPORT_WARMUP };
}

/** The day's Warm-up for its sport (true) or for the planned workout (false). */
export async function setWarmupForSport(userId: string, dateISO: string, forSport: boolean): Promise<void> {
  const date = toDateColumn(dateISO);
  const where = { userId_date_key_slot: { userId, date, key: FOR_KEY, slot: "" } };
  if (forSport) {
    await prisma.workoutSuggestionAnswer.upsert({
      where,
      create: { userId, date, key: FOR_KEY, slot: "", answer: "sport" },
      update: { answer: "sport" },
    });
  } else {
    await prisma.workoutSuggestionAnswer.deleteMany({ where: { userId, date, key: FOR_KEY, slot: "" } });
  }
}
