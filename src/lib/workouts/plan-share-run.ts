import "server-only";
import { prisma } from "@/lib/prisma";
import { fromDateColumn, todayISO, toDateColumn } from "@/lib/dates";
import { generateWorkoutTasks } from "@/lib/workouts/generate";
import { loadDayOrders, saveDayOrder } from "@/lib/workouts/day-order";
import { cleanPlanScheme } from "@/lib/workouts/programs";
import { nameKey } from "@/lib/workouts/library";
import { routineFor } from "@/lib/workouts/warmup-run";
import {
  FILE_FORMAT,
  FILE_KIND,
  planImport,
  planSummary,
  readWorkoutsFile,
  type FileSession,
  type ImportPlan,
  type WorkoutsFile,
} from "@/lib/workouts/plan-file";

// --- export -------------------------------------------------------------------

type PlanRow = {
  dayOfWeek: number;
  name: string;
  category: string | null;
  muscleGroup: string | null;
  isRest: boolean;
  warmup: string | null;
  hiitWorkout: { name: string } | null;
  exercises: {
    tracked: boolean;
    metric: string | null;
    scheme: string | null;
    poolExercise: { name: string; category: string; muscleGroup: string | null } | null;
  }[];
};

type WorkoutRow = {
  id: string;
  name: string;
  type: string;
  capSec: number | null;
  pyramidStart: number | null;
  pyramidEnd: number | null;
  pyramidStep: number | null;
  about: string | null;
  minutes: number | null;
  scaled: unknown;
  ownerId: string | null;
  movements: { reps: number | null; distance: number | null; weight: number | null; poolExercise: { name: string; category: string } | null }[];
};

const WORKOUT_SELECT = {
  id: true,
  name: true,
  type: true,
  capSec: true,
  pyramidStart: true,
  pyramidEnd: true,
  pyramidStep: true,
  about: true,
  minutes: true,
  scaled: true,
  ownerId: true,
  movements: {
    orderBy: { position: "asc" },
    select: { reps: true, distance: true, weight: true, poolExercise: { select: { name: true, category: true } } },
  },
} as const;

/**
 * A person's workouts file: their weekly plan and section order, their own
 * named workouts plus any shared ones the plan uses (so the file stands on its
 * own), and — when asked — everything they've logged.
 */
export async function exportWorkouts(userId: string, opts: { history?: boolean; name?: string | null } = {}): Promise<WorkoutsFile> {
  const [rows, orders] = await Promise.all([
    prisma.plannedWorkout.findMany({
      where: { userId },
      orderBy: [{ dayOfWeek: "asc" }, { sortOrder: "asc" }],
      select: {
        dayOfWeek: true,
        name: true,
        category: true,
        muscleGroup: true,
        isRest: true,
        warmup: true,
        hiitWorkout: { select: { name: true } },
        exercises: {
          orderBy: { sortOrder: "asc" },
          select: {
            tracked: true,
            metric: true,
            scheme: true,
            poolExercise: { select: { name: true, category: true, muscleGroup: true } },
          },
        },
      },
    }) as Promise<PlanRow[]>,
    loadDayOrders(userId),
  ]);
  const usedNames = [...new Set(rows.map((r) => r.hiitWorkout?.name).filter((n): n is string => !!n))];
  const workouts = (await prisma.hiitWorkout.findMany({
    where: { OR: [{ ownerId: userId }, ...(usedNames.length ? [{ name: { in: usedNames } }] : [])] },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: WORKOUT_SELECT,
  })) as WorkoutRow[];
  const seen = new Set<string>();
  const fileWorkouts = workouts
    .filter((w) => w.ownerId === userId || usedNames.includes(w.name))
    .filter((w) => (seen.has(nameKey(w.name)) ? false : (seen.add(nameKey(w.name)), true)))
    .map((w) => ({
      name: w.name,
      type: w.type as WorkoutsFile["workouts"][number]["type"],
      capSec: w.capSec,
      pyramidStart: w.pyramidStart,
      pyramidEnd: w.pyramidEnd,
      pyramidStep: w.pyramidStep,
      about: w.about,
      minutes: w.minutes,
      scaled: w.scaled ?? null,
      movements: w.movements
        .filter((m) => m.poolExercise)
        .map((m) => ({ name: m.poolExercise!.name, category: m.poolExercise!.category, reps: m.reps, distance: m.distance, weight: m.weight })),
    }));

  const file: WorkoutsFile = {
    kind: FILE_KIND,
    format: FILE_FORMAT,
    exportedAt: new Date().toISOString(),
    name: opts.name?.trim().slice(0, 60) || null,
    plan: rows.map((r) => ({
      day: r.dayOfWeek,
      name: r.name,
      category: r.category,
      muscleGroup: r.muscleGroup,
      rest: r.isRest,
      workout: r.hiitWorkout?.name ?? null,
      ...(r.warmup ? { warmup: r.warmup } : {}),
      movements: r.exercises
        .filter((e) => e.poolExercise)
        .map((e) => ({
          name: e.poolExercise!.name,
          category: e.poolExercise!.category,
          muscleGroup: e.poolExercise!.muscleGroup,
          metric: e.metric,
          tracked: e.tracked,
          // A wave keeps its shape, not the day it started.
          scheme: e.scheme?.startsWith("wave") ? "wave" : e.scheme,
        })),
    })),
    order: {
      everyDay: orders.everyDay,
      days: Object.fromEntries(Object.entries(orders.days).map(([d, o]) => [String(d), o])),
    },
    workouts: fileWorkouts,
  };

  if (opts.history) {
    const sessions = (await prisma.workoutSession.findMany({
      where: { userId },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
      select: {
        date: true,
        name: true,
        category: true,
        workoutType: true,
        isRest: true,
        version: true,
        sets: {
          orderBy: [{ setNumber: "asc" }, { createdAt: "asc" }],
          select: {
            weight: true,
            reps: true,
            seconds: true,
            distance: true,
            meters: true,
            unit: true,
            poolExercise: { select: { name: true } },
            exercise: { select: { name: true } },
          },
        },
      },
    })) as {
      date: Date;
      name: string | null;
      category: string | null;
      workoutType: string | null;
      isRest: boolean;
      version: string | null;
      sets: {
        weight: number | null;
        reps: number | null;
        seconds: number | null;
        distance: number | null;
        meters: number | null;
        unit: string | null;
        poolExercise: { name: string } | null;
        exercise: { name: string } | null;
      }[];
    }[];
    file.history = sessions.map(
      (s): FileSession => ({
        date: fromDateColumn(s.date),
        name: s.name,
        category: s.category,
        type: s.workoutType,
        rest: s.isRest,
        version: s.version,
        sets: s.sets.map((x) => ({
          movement: x.poolExercise?.name ?? x.exercise?.name ?? null,
          weight: x.weight,
          reps: x.reps,
          seconds: x.seconds,
          distance: x.distance,
          meters: x.meters,
          unit: x.unit,
        })),
      }),
    );
  }
  return file;
}

// --- import -------------------------------------------------------------------

async function importContext() {
  const [pool, workouts] = (await Promise.all([
    prisma.poolExercise.findMany({ select: { id: true, name: true, category: true, ownerId: true } }),
    prisma.hiitWorkout.findMany({ select: { id: true, name: true, ownerId: true, approved: true } }),
  ])) as [
    { id: string; name: string; category: string; ownerId: string | null }[],
    { id: string; name: string; ownerId: string | null; approved: boolean }[],
  ];
  return { pool, workouts };
}

export type ImportPreview = ImportPlan & { summary: string; name: string | null; workoutCount: number };

/** What a file holds and what importing it would add. */
export async function previewImport(userId: string, raw: unknown): Promise<{ ok: true; preview: ImportPreview } | { ok: false; error: string }> {
  const r = readWorkoutsFile(raw);
  if (!r.ok) return r;
  const { pool, workouts } = await importContext();
  const p = planImport(r.file, pool, workouts, userId);
  return { ok: true, preview: { ...p, summary: planSummary(r.file.plan), name: r.file.name, workoutCount: r.file.workouts.length } };
}

export type ImportMode = "replace" | "add";

/**
 * Bring a file in. `replace` swaps the weekly plan for the file's (ending a
 * running program, which wrote the old one) and takes its section order;
 * `add` puts the file's workouts on each day beside what's there, skipping
 * one already on that day by name. Movements the household lacks are added to
 * the person's own pool; named workouts they can't see are added as their own
 * (shareable as usual). Logged history is never imported.
 */
export async function applyImport(
  userId: string,
  raw: unknown,
  mode: ImportMode,
): Promise<{ ok: true; added: { plans: number; movements: number; workouts: number } } | { ok: false; error: string }> {
  const r = readWorkoutsFile(raw);
  if (!r.ok) return r;
  const file = r.file;
  const { pool, workouts } = await importContext();
  const today = todayISO();

  // Movements: shared first, then the person's own, by name within category.
  const mine = pool.filter((p) => p.ownerId == null || p.ownerId === userId);
  const ranked = [...mine].sort((a, b) => Number(a.ownerId != null) - Number(b.ownerId != null));
  const byCat = new Map<string, string>();
  const byName = new Map<string, string>();
  for (const p of ranked) {
    const k = `${p.category}|${nameKey(p.name)}`;
    if (!byCat.has(k)) byCat.set(k, p.id);
  }
  for (const p of [...ranked].sort((a, b) => Number(a.category !== "HIIT") - Number(b.category !== "HIIT"))) {
    if (!byName.has(nameKey(p.name))) byName.set(nameKey(p.name), p.id);
  }
  let movementsAdded = 0;
  const counts = new Map<string, number>();
  const makeMovement = async (name: string, category: string, muscleGroup: string | null): Promise<string | null> => {
    const base = counts.get(category) ?? ((await prisma.poolExercise.count({ where: { category: category as never } })) as number);
    counts.set(category, base + 1);
    const made = (await prisma.poolExercise
      .create({
        data: {
          category: category as never,
          name,
          muscleGroup: category === "WEIGHTS" ? (muscleGroup as never) : null,
          ownerId: userId,
          sortOrder: base,
        },
        select: { id: true },
      })
      .catch(() => null)) as { id: string } | null;
    if (made) movementsAdded++;
    return made?.id ?? null;
  };
  const movementId = async (name: string, category: string, muscleGroup: string | null): Promise<string | null> => {
    const k = `${category}|${nameKey(name)}`;
    let id = byCat.get(k);
    if (!id) {
      id = (await makeMovement(name, category, muscleGroup)) ?? undefined;
      if (id) {
        byCat.set(k, id);
        if (!byName.has(nameKey(name))) byName.set(nameKey(name), id);
      }
    }
    return id ?? null;
  };
  const anyMovementId = async (name: string): Promise<string | null> => byName.get(nameKey(name)) ?? (await movementId(name, "HIIT", null));

  // Named workouts: one the person can see by that name, else the file's,
  // added as their own.
  const visible = workouts.filter((w) => w.approved || w.ownerId === userId);
  const workoutIds = new Map<string, string>();
  for (const w of [...visible].sort((a, b) => Number(a.ownerId === userId) - Number(b.ownerId === userId))) {
    if (!workoutIds.has(nameKey(w.name))) workoutIds.set(nameKey(w.name), w.id);
  }
  let workoutsAdded = 0;
  let order = (await prisma.hiitWorkout.count({ where: { ownerId: userId } })) as number;
  for (const w of file.workouts) {
    if (workoutIds.has(nameKey(w.name))) continue;
    const moves: { id: string; reps: number | null; distance: number | null; weight: number | null }[] = [];
    for (const m of w.movements) {
      const id = await anyMovementId(m.name);
      if (id && !moves.some((x) => x.id === id)) moves.push({ id, reps: m.reps, distance: m.distance, weight: m.weight });
    }
    if (moves.length === 0) continue;
    const made = (await prisma.hiitWorkout.create({
      data: {
        name: w.name,
        type: w.type as never,
        ownerId: userId,
        approved: false,
        capSec: w.capSec,
        pyramidStart: w.pyramidStart,
        pyramidEnd: w.pyramidEnd,
        pyramidStep: w.pyramidStep,
        about: w.about,
        minutes: w.minutes,
        scaled: (Array.isArray(w.scaled) ? w.scaled : undefined) as never,
        sortOrder: order++,
        movements: {
          create: moves.map((m, i) => ({ poolExerciseId: m.id, reps: m.reps, distance: m.distance, weight: m.weight, position: i })),
        },
      },
      select: { id: true },
    })) as { id: string };
    workoutIds.set(nameKey(w.name), made.id);
    workoutsAdded++;
  }

  // The plan.
  const existing = (await prisma.plannedWorkout.findMany({
    where: { userId },
    select: { dayOfWeek: true, name: true, isRest: true },
  })) as { dayOfWeek: number; name: string; isRest: boolean }[];
  if (mode === "replace") {
    const running = (await prisma.personProgram.findFirst({ where: { userId, status: "ACTIVE" }, select: { id: true } })) as {
      id: string;
    } | null;
    if (running) {
      await prisma.personProgram.update({
        where: { id: running.id },
        data: { status: "ENDED", endedOn: toDateColumn(today) },
      });
    }
    await prisma.plannedWorkout.deleteMany({ where: { userId } });
  }
  const onDay = new Map<number, Set<string>>();
  const sorts = new Map<number, number>();
  if (mode === "add") {
    for (const e of existing) {
      onDay.set(e.dayOfWeek, (onDay.get(e.dayOfWeek) ?? new Set()).add(e.isRest ? "\u0000rest" : e.name.toLowerCase()));
      sorts.set(e.dayOfWeek, (sorts.get(e.dayOfWeek) ?? 0) + 1);
    }
  }
  let plans = 0;
  for (const e of file.plan) {
    const tag = e.rest ? "\u0000rest" : e.name.toLowerCase();
    const have = onDay.get(e.day) ?? new Set<string>();
    if (have.has(tag)) continue;
    // Adding a workout to a day planned as rest leaves the rest day alone.
    if (mode === "add" && e.rest && have.size > 0) continue;
    // A workout added to a day planned as rest makes it a training day.
    if (mode === "add" && !e.rest && have.has("\u0000rest")) {
      await prisma.plannedWorkout.deleteMany({ where: { userId, dayOfWeek: e.day, isRest: true } });
      have.delete("\u0000rest");
    }
    have.add(tag);
    onDay.set(e.day, have);
    const exercises: { poolExerciseId: string; tracked: boolean; metric: string | null; scheme: string | null; sortOrder: number }[] = [];
    for (const m of e.movements) {
      const id = await movementId(m.name, m.category, m.muscleGroup);
      if (!id || exercises.some((x) => x.poolExerciseId === id)) continue;
      exercises.push({
        poolExerciseId: id,
        tracked: m.tracked,
        metric: m.metric,
        scheme: cleanPlanScheme(m.scheme ?? "", today),
        sortOrder: exercises.length,
      });
    }
    const hiitWorkoutId = e.workout ? workoutIds.get(nameKey(e.workout)) ?? null : null;
    const sortOrder = sorts.get(e.day) ?? 0;
    sorts.set(e.day, sortOrder + 1);
    await prisma.plannedWorkout.create({
      data: {
        userId,
        dayOfWeek: e.day,
        name: e.name,
        category: (e.rest ? null : e.category ?? (hiitWorkoutId ? "HIIT" : null)) as never,
        muscleGroup: (e.rest ? null : e.muscleGroup) as never,
        isRest: e.rest,
        hiitWorkoutId,
        sortOrder,
        warmup: (e.category === "WARMUP" || e.category === "MOBILITY" || e.category === "STRETCHING") && e.warmup && (await routineFor(userId, e.warmup)) ? e.warmup : null,
        exercises: { create: exercises.map((x) => ({ ...x, metric: x.metric as never })) },
      },
    });
    plans++;
  }
  if (mode === "replace" && file.order) {
    if (file.order.everyDay.length) await saveDayOrder(userId, null, file.order.everyDay);
    for (const d of [0, 1, 2, 3, 4, 5, 6]) await saveDayOrder(userId, d, file.order.days[String(d)] ?? null);
  }
  await generateWorkoutTasks();
  return { ok: true, added: { plans, movements: movementsAdded, workouts: workoutsAdded } };
}

// --- household plans (shared through a parent's approval) -------------------

export type SharedPlanRow = {
  id: string;
  name: string;
  by: string;
  summary: string;
  status: "PENDING" | "APPROVED";
  mine: boolean;
};

type SharedRow = {
  id: string;
  name: string;
  ownerId: string | null;
  status: string;
  summary: string | null;
  owner: { name: string; displayName: string | null } | null;
};

const SHARED_SELECT = {
  id: true,
  name: true,
  ownerId: true,
  status: true,
  summary: true,
  owner: { select: { name: true, displayName: true } },
} as const;

const toShared = (r: SharedRow, userId: string | null): SharedPlanRow => ({
  id: r.id,
  name: r.name,
  by: r.owner?.displayName?.trim() || r.owner?.name || "",
  summary: r.summary ?? "",
  status: r.status === "APPROVED" ? "APPROVED" : "PENDING",
  mine: !!userId && r.ownerId === userId,
});

/** Share the person's current plan with everyone: a parent's (an admin's)
 *  is shared at once (v0.624); anyone else's waits for a parent's approval. */
export async function sharePlan(
  userId: string,
  name: string,
): Promise<{ ok: true; status: "APPROVED" | "PENDING" } | { ok: false; error: string }> {
  const clean = name.trim().slice(0, 60);
  if (clean.length < 2) return { ok: false, error: "Name the plan." };
  const file = await exportWorkouts(userId, { name: clean });
  if (!file.plan.some((e) => !e.rest)) return { ok: false, error: "There's nothing in your plan to share." };
  const me = (await prisma.user.findUnique({ where: { id: userId }, select: { role: true } })) as { role: string } | null;
  const status = me?.role === "ADMIN" ? ("APPROVED" as const) : ("PENDING" as const);
  await prisma.sharedPlan.create({
    data: {
      name: clean,
      ownerId: userId,
      status,
      file: file as never,
      summary: planSummary(file.plan),
      ...(status === "APPROVED" ? { approvedAt: new Date() } : {}),
    },
  });
  return { ok: true, status };
}

/** The household's plans for a person: approved ones, and their own waiting. */
export async function sharedPlansFor(userId: string): Promise<SharedPlanRow[]> {
  const rows = (await prisma.sharedPlan.findMany({
    where: { OR: [{ status: "APPROVED" }, { ownerId: userId, status: "PENDING" }] },
    orderBy: [{ status: "asc" }, { name: "asc" }],
    select: SHARED_SELECT,
  })) as SharedRow[];
  return rows.map((r) => toShared(r, userId));
}

/** Every shared plan, for Admin: waiting ones first. */
export async function sharedPlansForAdmin(): Promise<SharedPlanRow[]> {
  const rows = (await prisma.sharedPlan.findMany({
    where: { status: { in: ["PENDING", "APPROVED"] } },
    orderBy: [{ status: "desc" }, { createdAt: "asc" }],
    select: SHARED_SELECT,
  })) as SharedRow[];
  return rows.map((r) => toShared(r, null)).sort((a, b) => Number(a.status === "APPROVED") - Number(b.status === "APPROVED"));
}

export async function approveSharedPlan(id: string): Promise<void> {
  await prisma.sharedPlan.update({ where: { id }, data: { status: "APPROVED", approvedAt: new Date() } }).catch(() => {});
}

/** Dismiss a request or take an approved plan down. Plans people already
 *  started from are theirs and stay. */
export async function removeSharedPlan(id: string, userId?: string | null): Promise<void> {
  await prisma.sharedPlan.deleteMany({ where: { id, ...(userId ? { ownerId: userId, status: "PENDING" } : {}) } });
}

/** A household plan's file, if the person may use it. */
async function sharedFile(userId: string, id: string): Promise<unknown | null> {
  const row = (await prisma.sharedPlan.findUnique({ where: { id }, select: { file: true, status: true, ownerId: true } })) as {
    file: unknown;
    status: string;
    ownerId: string | null;
  } | null;
  if (!row || (row.status !== "APPROVED" && row.ownerId !== userId)) return null;
  return row.file;
}

export async function previewSharedPlan(userId: string, id: string) {
  const file = await sharedFile(userId, id);
  if (!file) return { ok: false as const, error: "That plan isn't shared any more." };
  return previewImport(userId, file);
}

export async function useSharedPlan(userId: string, id: string, mode: ImportMode) {
  const file = await sharedFile(userId, id);
  if (!file) return { ok: false as const, error: "That plan isn't shared any more." };
  return applyImport(userId, file, mode);
}

// --- my plans (saved for later, private; v0.620) -----------------------------
//
// Kept in the household-plans table with status PRIVATE: only the owner sees
// or uses them, and they never reach Admin or the household list.

export type SavedPlanRow = { id: string; name: string; summary: string; savedOn: string };

const PRIVATE = "PRIVATE";

/** The person's saved plans, newest first. */
export async function savedPlansFor(userId: string): Promise<SavedPlanRow[]> {
  const rows = (await prisma.sharedPlan.findMany({
    where: { ownerId: userId, status: PRIVATE },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, summary: true, createdAt: true },
  })) as { id: string; name: string; summary: string | null; createdAt: Date }[];
  return rows.map((r) => ({ id: r.id, name: r.name, summary: r.summary ?? "", savedOn: r.createdAt.toISOString().slice(0, 10) }));
}

/** Save the current plan under a name. `auto` skips an empty plan and one
 *  the same as the last saved (starting a program saves the plan it replaces). */
export async function savePlan(
  userId: string,
  name: string,
  opts: { auto?: boolean } = {},
): Promise<{ ok: true; id: string | null } | { ok: false; error: string }> {
  const clean = name.trim().slice(0, 60);
  if (clean.length < 2) return { ok: false, error: "Name the plan." };
  const file = await exportWorkouts(userId, { name: clean });
  if (!file.plan.some((e) => !e.rest)) {
    return opts.auto ? { ok: true, id: null } : { ok: false, error: "There's nothing in your plan to save." };
  }
  if (opts.auto) {
    const last = (await prisma.sharedPlan.findFirst({
      where: { ownerId: userId, status: PRIVATE },
      orderBy: { createdAt: "desc" },
      select: { file: true },
    })) as { file: unknown } | null;
    const lastPlan = (last?.file as { plan?: unknown } | undefined)?.plan;
    if (lastPlan && JSON.stringify(lastPlan) === JSON.stringify(file.plan)) return { ok: true, id: null };
  }
  const row = (await prisma.sharedPlan.create({
    data: { name: clean, ownerId: userId, status: PRIVATE, file: file as never, summary: planSummary(file.plan) },
    select: { id: true },
  })) as { id: string };
  return { ok: true, id: row.id };
}

export async function renameSavedPlan(userId: string, id: string, name: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const clean = name.trim().slice(0, 60);
  if (clean.length < 2) return { ok: false, error: "Name the plan." };
  await prisma.sharedPlan.updateMany({ where: { id, ownerId: userId, status: PRIVATE }, data: { name: clean } });
  return { ok: true };
}

export async function deleteSavedPlan(userId: string, id: string): Promise<void> {
  await prisma.sharedPlan.deleteMany({ where: { id, ownerId: userId, status: PRIVATE } });
}
