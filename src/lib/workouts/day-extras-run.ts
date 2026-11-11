import "server-only";
import { prisma } from "@/lib/prisma";
import { toDateColumn } from "@/lib/dates";
import { coreDayName, coreMetric, coreScheme, type CoreDay } from "@/lib/workouts/core-library";
import { coreWorkoutFor, coreWorkoutsFor, resolveMoves } from "@/lib/workouts/core-run";
import { routineFor, routinesFor } from "@/lib/workouts/warmup-run";
import type { WarmupRoutine } from "@/lib/workouts/warmup-library";
import {
  MAX_DAY_EXTRAS,
  dayExtraKindOf,
  extraCategory,
  extraId,
  extraRowId,
  isExtraId,
  type DayExtraKind,
} from "@/lib/workouts/day-extras";

/** One day extra as the day shows it (v0.667). */
export type DayExtraView = {
  /** "extra_<id>": stands in for a plan entry's id everywhere on the day. */
  id: string;
  kind: DayExtraKind;
  category: "MOBILITY" | "STRETCHING" | "ISOMETRIC";
  name: string;
  ref: string;
  /** Mobility or stretching: its routine. */
  routine: WarmupRoutine | null;
  /** Isometric: its movements, with their sets. */
  moves: { poolExerciseId: string; name: string; metric: "REPS" | "DURATION" | "WEIGHT"; scheme: string }[];
};

type Row = { id: string; kind: string; ref: string };

async function viewOf(userId: string, r: Row): Promise<DayExtraView | null> {
  const kind = dayExtraKindOf(r.kind);
  if (!kind) return null;
  const base = { id: extraId(r.id), kind, category: extraCategory(kind), ref: r.ref };
  if (kind === "iso") {
    const w = await coreWorkoutFor(userId, r.ref);
    if (!w) return null;
    const moves = (await resolveMoves(userId, w.moves)).map((m) => ({
      poolExerciseId: m.poolExerciseId,
      name: m.name,
      metric: coreMetric(m),
      scheme: coreScheme(m),
    }));
    if (moves.length === 0) return null;
    return { ...base, name: coreDayName(w, "iso"), routine: null, moves };
  }
  const routine = await routineFor(userId, r.ref);
  if (!routine) return null;
  return { ...base, name: routine.name.slice(0, 40), routine, moves: [] };
}

/** The day's extras, oldest first; any whose routine or workout is gone are left out. */
export async function dayExtrasFor(userId: string, dateISO: string): Promise<DayExtraView[]> {
  const rows = (await prisma.dayExtra.findMany({
    where: { userId, date: toDateColumn(dateISO) },
    orderBy: { createdAt: "asc" },
    select: { id: true, kind: true, ref: true },
  })) as Row[];
  const out: DayExtraView[] = [];
  for (const r of rows) {
    const v = await viewOf(userId, r);
    if (v) out.push(v);
  }
  return out;
}

async function known(userId: string, kind: DayExtraKind, ref: string): Promise<boolean> {
  if (kind === "iso") return (await coreWorkoutsFor(userId, "iso")).some((w) => w.id === ref);
  return (await routinesFor(userId, kind)).some((r) => r.id === ref);
}

/** Add a routine or an isometric workout to one day. The same one twice is one. */
export async function addDayExtra(
  userId: string,
  dateISO: string,
  kindIn: unknown,
  refIn: unknown,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const kind = dayExtraKindOf(kindIn);
  const ref = typeof refIn === "string" ? refIn.slice(0, 60) : "";
  if (!kind || !ref) return { ok: false, error: "Pick one to add." };
  if (!(await known(userId, kind, ref))) return { ok: false, error: "That one is gone." };
  const date = toDateColumn(dateISO);
  const rows = (await prisma.dayExtra.findMany({
    where: { userId, date },
    select: { id: true, kind: true, ref: true },
  })) as Row[];
  const same = rows.find((r) => r.kind === kind && r.ref === ref);
  if (same) return { ok: true, id: extraId(same.id) };
  if (rows.length >= MAX_DAY_EXTRAS) return { ok: false, error: `At most ${MAX_DAY_EXTRAS} on one day.` };
  const made = (await prisma.dayExtra.create({ data: { userId, date, kind, ref }, select: { id: true } })) as { id: string };
  return { ok: true, id: extraId(made.id) };
}

/** Take an extra off its day. Anything logged for it stays logged. */
export async function removeDayExtra(userId: string, id: string): Promise<boolean> {
  if (!isExtraId(id)) return false;
  const r = await prisma.dayExtra.deleteMany({ where: { id: extraRowId(id), userId } });
  return r.count > 0;
}

/** Switch a mobility or stretching extra to another routine of its kind. */
export async function setDayExtraRoutine(userId: string, id: string, ref: string | null): Promise<boolean> {
  if (!isExtraId(id) || !ref) return false;
  const row = (await prisma.dayExtra.findFirst({
    where: { id: extraRowId(id), userId },
    select: { id: true, kind: true },
  })) as { id: string; kind: string } | null;
  const kind = row ? dayExtraKindOf(row.kind) : null;
  if (!row || !kind || kind === "iso" || !(await known(userId, kind, ref))) return false;
  await prisma.dayExtra.update({ where: { id: row.id }, data: { ref } });
  return true;
}

/** An extra as a plan entry, for logging, skipping and marking it done. */
export async function extraPlanFor(
  userId: string,
  id: string,
): Promise<{ name: string; category: "MOBILITY" | "STRETCHING" | "ISOMETRIC"; userId: string; exercises: { poolExerciseId: string; scheme: string }[] } | null> {
  if (!isExtraId(id)) return null;
  const row = (await prisma.dayExtra.findFirst({
    where: { id: extraRowId(id), userId },
    select: { id: true, kind: true, ref: true },
  })) as Row | null;
  const v = row ? await viewOf(userId, row) : null;
  if (!v) return null;
  return {
    name: v.name,
    category: v.category as never,
    userId,
    exercises: v.moves.map((m) => ({ poolExerciseId: m.poolExerciseId, scheme: m.scheme })),
  };
}

/** A movement's sets from the day's isometric extras, when no plan entry has it. */
export async function extraSlotFor(userId: string, dateISO: string, slot: string): Promise<string | null> {
  const list = await dayExtrasFor(userId, dateISO);
  for (const v of list) {
    const m = v.moves.find((x) => x.poolExerciseId === slot);
    if (m) return m.scheme;
  }
  return null;
}

/** The day's isometric extras in the shape plan entries are read in, for the
 *  day's movement cards (loadTodayPlannedWorkouts). */
export async function extraPlanRows(userId: string, dateISO: string, views?: DayExtraView[]) {
  const list = (views ?? (await dayExtrasFor(userId, dateISO))).filter((v) => v.kind === "iso");
  return list.map((v) => {
    const core: CoreDay = {
      rotation: [v.ref],
      test: false,
      at: 0,
      since: dateISO,
      testedMonth: null,
      withTest: false,
      v: 2,
      kind: "iso",
    };
    return {
      id: v.id,
      name: v.name,
      category: v.category,
      muscleGroup: null,
      core,
      hiitWorkoutId: null,
      hiitWorkout: null,
      exercises: v.moves.map((m) => ({
        poolExerciseId: m.poolExerciseId,
        metric: m.metric,
        tracked: true,
        poolExercise: { name: m.name },
      })),
    };
  });
}

/** The day's mobility and stretching extras as simple plans (the phone's
 *  routine cards): done once their session exists. */
export async function extraSimplePlans(userId: string, dateISO: string, views?: DayExtraView[]) {
  const list = (views ?? (await dayExtrasFor(userId, dateISO))).filter((v) => v.kind !== "iso");
  if (list.length === 0) return [];
  const sessions = (await prisma.workoutSession.findMany({
    where: { userId, date: toDateColumn(dateISO), isRest: false, category: { in: ["MOBILITY", "STRETCHING"] as never } },
    select: { name: true, category: true },
  })) as { name: string | null; category: string | null }[];
  return list.map((v) => ({
    plannedWorkoutId: v.id,
    name: v.name,
    category: v.category as "MOBILITY" | "STRETCHING",
    done: sessions.some((x) => x.category === v.category && (x.name ?? "").slice(0, 40) === v.name.slice(0, 40)),
    skipped: false,
    routine: v.routine,
    extra: true,
  }));
}
