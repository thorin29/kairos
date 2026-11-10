import "server-only";
import { prisma } from "@/lib/prisma";
import { dayOfWeek, fromDateColumn, toDateColumn, todayISO } from "@/lib/dates";
import { generateWorkoutTasks } from "@/lib/workouts/generate";
import { applyLibrary } from "@/lib/workouts/library-run";
import { nameKey } from "@/lib/workouts/library";
import {
  CORE_LIB_PREFIX,
  cleanCoreDay,
  cleanCoreMoves,
  coreDayMoves,
  coreDayName,
  kindTag,
  coreMetric,
  coreScheme,
  libraryCoreWorkout,
  rotationKindOf,
  rotationLabel,
  rotationLibrary,
  type RotationKind,
  libraryKeyFor,
  plusDays,
  stepCoreDay,
  switchesSides,
  type CoreDay,
  type CoreMove,
  type CoreWorkout,
} from "@/lib/workouts/core-library";

/**
 * Core days (v0.637): the library's core workouts and the person's own, a
 * Core plan entry's rotation, and keeping the entry's movements on the
 * workout now due (`syncCoreDays`, run when the plan or a day is loaded).
 */

type Row = { id: string; name: string; moves: unknown; kind: string };

function toWorkout(r: Row): CoreWorkout {
  const moves = cleanCoreMoves(r.moves);
  const sets = moves.reduce((n, m) => n + m.sets, 0);
  return {
    id: r.id,
    name: r.name,
    minutes: Math.max(5, Math.round(sets * 1.2)),
    gear: "",
    moves,
    mine: true,
    ...kindTag(rotationKindOf(r.kind)),
  };
}

/** The library's workouts of a kind (Core by default, or Arms, v0.651), then the person's own (A–Z). */
export async function coreWorkoutsFor(userId: string, kind: RotationKind = "core"): Promise<CoreWorkout[]> {
  const own = (await prisma.coreWorkout.findMany({
    where: { ownerId: userId, kind },
    orderBy: { name: "asc" },
    select: { id: true, name: true, moves: true, kind: true },
  })) as Row[];
  return [...rotationLibrary(kind), ...own.map(toWorkout)];
}

async function coreWorkoutFor(userId: string, id: string): Promise<CoreWorkout | null> {
  if (id.startsWith(CORE_LIB_PREFIX)) return libraryCoreWorkout(id);
  const r = (await prisma.coreWorkout.findFirst({
    where: { id, ownerId: userId },
    select: { id: true, name: true, moves: true, kind: true },
  })) as Row | null;
  return r ? toWorkout(r) : null;
}

/** Save the person's own core workout (new without an id). Movements must be in the pool. */
export async function saveCoreWorkout(
  userId: string,
  input: { id?: string | null; name: unknown; moves: unknown; kind?: unknown },
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const kind = rotationKindOf(input.kind);
  const name = typeof input.name === "string" ? input.name.trim().slice(0, 40) : "";
  if (name.length < 2) return { ok: false, error: "Name the workout." };
  const moves = cleanCoreMoves(input.moves).filter((m) => !!m.poolExerciseId);
  if (moves.length === 0) return { ok: false, error: "Add a movement." };
  const pool = (await prisma.poolExercise.findMany({
    where: { id: { in: moves.map((m) => m.poolExerciseId as string) }, OR: [{ ownerId: null }, { ownerId: userId }] },
    select: { id: true, name: true },
  })) as { id: string; name: string }[];
  const names = new Map(pool.map((p) => [p.id, p.name]));
  const kept = moves
    .filter((m) => names.has(m.poolExerciseId as string))
    .map((m) => {
      const name = names.get(m.poolExerciseId as string) as string;
      // A set per side comes in pairs (v0.642).
      return { ...m, name, sets: switchesSides(name) && m.sets % 2 === 1 ? Math.min(10, m.sets + 1) : m.sets };
    });
  if (kept.length === 0) return { ok: false, error: "Add a movement." };
  if (input.id && !input.id.startsWith(CORE_LIB_PREFIX)) {
    const n = (await prisma.coreWorkout.updateMany({
      where: { id: input.id, ownerId: userId },
      data: { name, moves: kept as never },
    })) as { count: number };
    if (n.count === 1) {
      await syncCoreDays(userId);
      return { ok: true, id: input.id };
    }
  }
  const made = (await prisma.coreWorkout.create({
    data: { ownerId: userId, name, moves: kept as never, kind },
    select: { id: true },
  })) as { id: string };
  return { ok: true, id: made.id };
}

/** Delete one's own core workout; rotations drop it (an emptied one falls back to the first library workout). */
export async function deleteCoreWorkout(userId: string, id: string): Promise<void> {
  const n = (await prisma.coreWorkout.deleteMany({ where: { id, ownerId: userId } })) as { count: number };
  if (n.count === 0) return;
  const today = todayISO();
  for (const e of await coreEntries(userId)) {
    if (!e.day.rotation.includes(id)) continue;
    const rotation = e.day.rotation.filter((x) => x !== id);
    const next: CoreDay = {
      ...e.day,
      rotation: rotation.length ? rotation : [rotationLibrary(rotationKindOf(e.day.kind))[0].id],
      at: 0,
      since: today,
      v: 2,
    };
    await prisma.plannedWorkout.update({ where: { id: e.id }, data: { core: next as never } });
  }
  await syncCoreDays(userId);
}

/**
 * Make or change a Core day: a new entry on `day`, or the entry
 * `plannedWorkoutId`. The workout in place stays in place if it's still in
 * the rotation; otherwise the rotation starts from its first.
 */
export async function setCoreDay(
  userId: string,
  input: { plannedWorkoutId?: string | null; day?: number | null; rotation: unknown; test: unknown; kind?: unknown },
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const ids = Array.isArray(input.rotation)
    ? [...new Set(input.rotation.filter((x): x is string => typeof x === "string" && !!x))].slice(0, 12)
    : [];
  const kind = rotationKindOf(input.kind);
  const known = await coreWorkoutsFor(userId, kind);
  const rotation = ids.filter((id) => known.some((w) => w.id === id));
  if (rotation.length === 0) return { ok: false, error: `Pick at least one ${rotationLabel(kind).toLowerCase()} workout.` };
  // Core has the plank test and Isometric its three holds (v0.661); an Arms
  // day has none.
  const test = kind !== "arms" && input.test !== false;
  const tag = kindTag(kind);
  // Isometric is its own category with no muscle group (v0.661).
  const group = kind === "arms" ? "ARMS" : kind === "iso" ? null : "CORE";
  const category = kind === "iso" ? "ISOMETRIC" : "WEIGHTS";
  const today = todayISO();

  if (input.plannedWorkoutId) {
    const row = (await prisma.plannedWorkout.findFirst({
      where: { id: input.plannedWorkoutId, userId },
      select: { id: true, core: true },
    })) as { id: string; core: unknown } | null;
    if (!row) return { ok: false, error: "That plan entry is gone." };
    const old = cleanCoreDay(row.core, today);
    const current = old ? old.rotation[old.at] : null;
    const at = current ? Math.max(0, rotation.indexOf(current)) : 0;
    const next: CoreDay = {
      rotation,
      test,
      at,
      since: old && current && rotation.includes(current) ? old.since : today,
      testedMonth: old?.testedMonth ?? null,
      withTest: false,
      v: 2,
      ...tag,
    };
    await prisma.plannedWorkout.update({
      where: { id: row.id },
      data: { core: next as never, category: category as never, muscleGroup: group as never },
    });
    await syncCoreDays(userId);
    return { ok: true, id: row.id };
  }

  const day = typeof input.day === "number" ? input.day : -1;
  if (!(Number.isInteger(day) && day >= 0 && day <= 6)) return { ok: false, error: "Pick a day." };
  const count = await prisma.plannedWorkout.count({ where: { userId, dayOfWeek: day } });
  const first: CoreDay = { rotation, test, at: 0, since: today, testedMonth: null, withTest: false, v: 2, ...tag };
  const made = (await prisma.plannedWorkout.create({
    data: {
      userId,
      dayOfWeek: day,
      name: rotationLabel(kind),
      sortOrder: count,
      category: category as never,
      muscleGroup: group as never,
      core: first as never,
    },
    select: { id: true },
  })) as { id: string };
  await syncCoreDays(userId);
  await generateWorkoutTasks();
  return { ok: true, id: made.id };
}

type Entry = { id: string; dayOfWeek: number; name: string; day: CoreDay; planned: { poolExerciseId: string; scheme: string | null; metric: string | null }[] };

async function coreEntries(userId?: string): Promise<(Entry & { userId: string })[]> {
  const rows = (await prisma.plannedWorkout.findMany({
    // Core and Arms days (v0.651) and Isometric ones (v0.661) — all rotations.
    where: {
      ...(userId ? { userId } : {}),
      OR: [
        { category: "WEIGHTS" as never, muscleGroup: { in: ["CORE", "ARMS"] as never } },
        { category: "ISOMETRIC" as never },
      ],
    },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      userId: true,
      dayOfWeek: true,
      name: true,
      core: true,
      exercises: { orderBy: { sortOrder: "asc" }, select: { poolExerciseId: true, scheme: true, metric: true } },
    },
  })) as {
    id: string;
    userId: string;
    dayOfWeek: number;
    name: string;
    core: unknown;
    exercises: { poolExerciseId: string; scheme: string | null; metric: string | null }[];
  }[];
  const today = todayISO();
  const out: (Entry & { userId: string })[] = [];
  for (const r of rows) {
    const day = r.core == null ? null : cleanCoreDay(r.core, today);
    if (day) out.push({ id: r.id, userId: r.userId, dayOfWeek: r.dayOfWeek, name: r.name, day, planned: r.exercises });
  }
  return out;
}

/** Pool ids for the moves, adding library movements the pool doesn't have yet. */
async function resolveMoves(userId: string, list: CoreMove[]): Promise<(CoreMove & { poolExerciseId: string })[]> {
  const load = async () =>
    (await prisma.poolExercise.findMany({
      where: { OR: [{ ownerId: null }, { ownerId: userId }] },
      select: { id: true, name: true, libraryKey: true, ownerId: true },
    })) as { id: string; name: string; libraryKey: string | null; ownerId: string | null }[];
  let pool = await load();
  const find = (m: CoreMove) => {
    if (m.poolExerciseId && pool.some((p) => p.id === m.poolExerciseId)) return m.poolExerciseId;
    const key = libraryKeyFor(m.name);
    const k = nameKey(m.name);
    return (
      (key ? pool.find((p) => p.libraryKey === key && !p.ownerId) : undefined)?.id ??
      pool.find((p) => nameKey(p.name) === k && !p.ownerId)?.id ??
      pool.find((p) => nameKey(p.name) === k)?.id ??
      null
    );
  };
  const missing = list
    .filter((m) => !find(m))
    .map((m) => libraryKeyFor(m.name))
    .filter((k): k is string => !!k);
  if (missing.length) {
    await applyLibrary(missing);
    pool = await load();
  }
  const seen = new Set<string>();
  const out: (CoreMove & { poolExerciseId: string })[] = [];
  for (const m of list) {
    const id = find(m);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push({ ...m, poolExerciseId: id });
  }
  return out;
}

/**
 * Keep every Core day on the workout now due: move the rotation on once the
 * workout in place was logged on an earlier day, put the plank test in on the
 * month's first core day, and rewrite the entry's movements when they differ.
 * Writes only when something changed.
 */
/** Finished, non-warm-up sessions on `dates` with a set of one of `ids`. */
async function loggedDays(userId: string, ids: string[], from: string, to: string): Promise<string[]> {
  if (ids.length === 0) return [];
  const sessions = (await prisma.workoutSession.findMany({
    where: {
      userId,
      isRest: false,
      date: { gte: toDateColumn(from), lt: toDateColumn(to) },
      sets: { some: { finished: true, poolExerciseId: { in: ids } } },
    },
    select: { date: true, category: true },
  })) as { date: Date; category: string | null }[];
  return sessions.filter((s) => s.category !== "WARMUP" && s.category !== "HIIT").map((s) => fromDateColumn(s.date));
}

/**
 * Before v0.644 a log moved the rotation on the very next day, so the day it
 * was logged then showed the next workout and read as not done. Once per
 * entry: if it moved on that way and the weekday hasn't come round again,
 * step back to the workout that was done.
 */
async function repairEarlyStep(e: Entry & { userId: string }, today: string): Promise<CoreDay> {
  const day: CoreDay = { ...e.day, v: 2 };
  if (dayOfWeek(e.day.since) === e.dayOfWeek) return day;
  let lastDay: string | null = null;
  for (let k = 1; k <= 7 && !lastDay; k++) {
    const d = plusDays(e.day.since, -k);
    if (dayOfWeek(d) === e.dayOfWeek) lastDay = d;
  }
  if (!lastDay || plusDays(lastDay, 7) <= today) return day;
  const prevAt = (day.at - 1 + day.rotation.length) % day.rotation.length;
  const prev = await coreWorkoutFor(e.userId, day.rotation[prevAt]);
  if (!prev) return day;
  const ids = (await resolveMoves(e.userId, coreDayMoves(prev, true, rotationKindOf(day.kind)))).map((m) => m.poolExerciseId);
  const hit = await loggedDays(e.userId, ids, lastDay, plusDays(lastDay, 1));
  if (hit.length === 0) return day;
  return {
    ...day,
    at: prevAt,
    since: lastDay,
    // The test was marked done by that early move: it was done that day.
    testedMonth: day.testedMonth === lastDay.slice(0, 7) ? null : day.testedMonth,
  };
}

export async function syncCoreDays(userId?: string, today: string = todayISO()): Promise<void> {
  const entries = await coreEntries(userId);
  for (const stored of entries) {
    const e = stored.day.v === 2 ? stored : { ...stored, day: await repairEarlyStep(stored, today) };
    const ids = e.planned.map((p) => p.poolExerciseId);
    const loggedOn = (await loggedDays(e.userId, ids, e.day.since, today)).filter(
      (d) => dayOfWeek(d) === e.dayOfWeek,
    );
    let day = stepCoreDay(e.day, loggedOn, today);
    // Skip workouts that are gone (a deleted one of your own).
    let workout: CoreWorkout | null = null;
    for (let i = 0; i < day.rotation.length; i++) {
      workout = await coreWorkoutFor(e.userId, day.rotation[(day.at + i) % day.rotation.length]);
      if (workout) {
        day = { ...day, at: (day.at + i) % day.rotation.length };
        break;
      }
    }
    const moves = await resolveMoves(e.userId, coreDayMoves(workout, day.withTest, rotationKindOf(day.kind)));
    const want = moves.map((m) => ({ poolExerciseId: m.poolExerciseId, scheme: coreScheme(m), metric: coreMetric(m) }));
    const same =
      want.length === e.planned.length &&
      want.every(
        (w, i) =>
          w.poolExerciseId === e.planned[i].poolExerciseId &&
          w.scheme === e.planned[i].scheme &&
          w.metric === e.planned[i].metric,
      );
    const name = coreDayName(workout, rotationKindOf(day.kind));
    const dayChanged = JSON.stringify(day) !== JSON.stringify(stored.day);
    if (same && !dayChanged && name === e.name) continue;
    await prisma.$transaction(async (tx) => {
      if (!same) {
        await tx.plannedExercise.deleteMany({ where: { plannedWorkoutId: e.id } });
        if (want.length)
          await tx.plannedExercise.createMany({
            data: want.map((w, i) => ({
              plannedWorkoutId: e.id,
              poolExerciseId: w.poolExerciseId,
              tracked: true,
              metric: w.metric as never,
              scheme: w.scheme,
              sortOrder: i,
            })),
          });
      }
      await tx.plannedWorkout.update({ where: { id: e.id }, data: { name, core: day as never } });
    });
  }
}

/** A core entry's rotation for the plan editors and day page: { rotation, test, at, withTest } or null. */
export function coreDayView(
  raw: unknown,
): { rotation: string[]; test: boolean; at: number; withTest: boolean; kind: RotationKind } | null {
  const d = cleanCoreDay(raw, todayISO());
  return d
    ? { rotation: d.rotation, test: d.test, at: d.at, withTest: d.withTest, kind: rotationKindOf(d.kind) }
    : null;
}
