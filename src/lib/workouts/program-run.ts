import "server-only";
import { prisma } from "@/lib/prisma";
import { addDays, dayOfWeek, fromDateColumn, startOfWeek, toDateColumn, todayISO } from "@/lib/dates";
import { generateWorkoutTasks } from "@/lib/workouts/generate";
import { MUSCLE_GROUP_LABEL, type MuscleGroup } from "@/lib/workouts/catalog";
import { loadWeightUnits } from "@/lib/queries/workouts";
import { getSetting, setSetting } from "@/lib/settings";
import {
  PROGRAMS,
  blocksDone,
  programByKey,
  programWeek,
  raisedMaxes,
  schemeKey,
  trainingMaxFrom,
  weekIntent,
  weekLabel,
  type Program,
  type ProgramRole,
} from "@/lib/workouts/programs";

type ProgramRow = {
  id: string;
  programKey: string;
  startedOn: Date;
  blockStartedOn: Date;
  days: string;
  trainingMaxes: unknown;
  previousPlan: unknown;
};

export type ActiveProgram = {
  id: string;
  program: Program;
  startedOn: string;
  blockStartedOn: string;
  days: number[];
  trainingMaxes: Record<string, number>;
};

/** The person's active program, if any. */
export async function loadActiveProgram(userId: string): Promise<ActiveProgram | null> {
  const row = (await prisma.personProgram.findFirst({
    where: { userId, status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      programKey: true,
      startedOn: true,
      blockStartedOn: true,
      days: true,
      trainingMaxes: true,
      previousPlan: true,
    },
  })) as ProgramRow | null;
  if (!row) return null;
  const program = programByKey(row.programKey);
  if (!program) return null;
  const tm: Record<string, number> = {};
  if (row.trainingMaxes && typeof row.trainingMaxes === "object") {
    for (const [k, v] of Object.entries(row.trainingMaxes as Record<string, unknown>)) {
      if (typeof v === "number" && v > 0) tm[k] = v;
    }
  }
  return {
    id: row.id,
    program,
    startedOn: fromDateColumn(row.startedOn),
    blockStartedOn: fromDateColumn(row.blockStartedOn),
    days: row.days.split(",").map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6),
    trainingMaxes: tm,
  };
}

/** What the day page and the Workouts page say about a person's program. */
export type ProgramInfo = {
  key: string;
  name: string;
  week: number;
  weeks: number;
  /** "Week 2 of 4", "Week 4 of 4 · light". */
  label: string;
  intent: "LIGHT" | "TEST" | null;
  /** A block finished and nobody chose what's next yet. */
  blockDone: boolean;
  /** Main lifts and their training maxes, for the program card. */
  maxes: { poolExerciseId: string; name: string; weight: number }[];
};

export async function programInfoFor(userId: string, dateISO: string): Promise<ProgramInfo | null> {
  const p = await loadActiveProgram(userId);
  if (!p) return null;
  const week = programWeek(p.program, p.blockStartedOn, dateISO);
  const ids = Object.keys(p.trainingMaxes);
  const names = ids.length
    ? ((await prisma.poolExercise.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } })) as {
        id: string;
        name: string;
      }[])
    : [];
  return {
    key: p.program.key,
    name: p.program.name,
    week,
    weeks: p.program.weeks,
    label: weekLabel(p.program, week),
    intent: weekIntent(p.program, week),
    blockDone: blocksDone(p.program, p.blockStartedOn, dateISO) > 0,
    maxes: ids.map((id) => ({
      poolExerciseId: id,
      name: names.find((n) => n.id === id)?.name ?? "",
      weight: p.trainingMaxes[id],
    })),
  };
}

/** LIGHT / TEST for a day in an active program's light or test week; null otherwise. */
export async function programIntentFor(userId: string, dateISO: string): Promise<"LIGHT" | "TEST" | null> {
  const p = await loadActiveProgram(userId);
  if (!p || dateISO < p.startedOn) return null;
  return weekIntent(p.program, programWeek(p.program, p.blockStartedOn, dateISO));
}

// --- the setup screen -------------------------------------------------------------

export type ProgramChoice = {
  key: string;
  name: string;
  blurb: string;
  weeks: number;
  defaultDays: number[];
  days: {
    name: string;
    row: boolean;
    roles: {
      key: string;
      label: string;
      muscleGroup: MuscleGroup;
      main: boolean;
      optional: boolean;
      scheme: string;
      /** The pool movement it starts with (null: nothing fits; pick one or leave it out). */
      defaultId: string | null;
      /** Movements that fit, by muscle group. */
      options: { id: string; name: string }[];
    }[];
  }[];
};

/** Every program, with each slot's default and choices from the pool. */
export async function loadProgramChoices(): Promise<ProgramChoice[]> {
  const pool = (await prisma.poolExercise.findMany({
    where: { isActive: true, ownerId: null, category: "WEIGHTS" },
    orderBy: { name: "asc" },
    select: { id: true, name: true, muscleGroup: true },
  })) as { id: string; name: string; muscleGroup: string | null }[];
  return PROGRAMS.map((p) => ({
    key: p.key,
    name: p.name,
    blurb: p.blurb,
    weeks: p.weeks,
    defaultDays: p.defaultDays,
    days: p.days.map((d) => ({
      name: d.name,
      row: !!d.row,
      roles: d.roles.map((r) => {
        const fits = pool.filter((m) => m.muscleGroup === r.muscleGroup);
        const def = defaultFor(r, pool);
        return {
          key: r.key,
          label: r.label,
          muscleGroup: r.muscleGroup,
          main: !!r.main,
          optional: !!r.optional,
          scheme: schemeKey(r.scheme),
          defaultId: def?.id ?? null,
          options: fits.map((m) => ({ id: m.id, name: m.name })),
        };
      }),
    })),
  }));
}

function defaultFor(role: ProgramRole, pool: readonly { id: string; name: string; muscleGroup: string | null }[]) {
  const norm = (s: string) => s.trim().toLowerCase().replace(/s$/, "");
  for (const m of role.match) {
    const hit = pool.find((p) => norm(p.name) === norm(m));
    if (hit) return hit;
  }
  return null;
}

// --- start, end, next block -------------------------------------------------------

type PlanSnapshot = {
  rotationActive: boolean;
  workouts: {
    dayOfWeek: number;
    name: string;
    category: string | null;
    muscleGroup: string | null;
    isRest: boolean;
    hiitWorkoutId: string | null;
    sortOrder: number;
    exercises: {
      poolExerciseId: string;
      tracked: boolean;
      metric: string | null;
      sortOrder: number;
      scheme: string | null;
      programRole: string | null;
    }[];
  }[];
};

async function snapshotPlan(userId: string): Promise<PlanSnapshot> {
  const [rows, rotation] = (await Promise.all([
    prisma.plannedWorkout.findMany({
      where: { userId },
      orderBy: [{ dayOfWeek: "asc" }, { sortOrder: "asc" }],
      select: {
        dayOfWeek: true,
        name: true,
        category: true,
        muscleGroup: true,
        isRest: true,
        hiitWorkoutId: true,
        sortOrder: true,
        exercises: {
          orderBy: { sortOrder: "asc" },
          select: { poolExerciseId: true, tracked: true, metric: true, sortOrder: true, scheme: true, programRole: true },
        },
      },
    }),
    prisma.workoutRotation.findUnique({ where: { userId }, select: { isActive: true } }),
  ])) as [PlanSnapshot["workouts"], { isActive: boolean } | null];
  return { rotationActive: !!rotation?.isActive, workouts: rows };
}

async function writePlan(userId: string, snap: PlanSnapshot["workouts"]): Promise<void> {
  for (const w of snap) {
    await prisma.plannedWorkout.create({
      data: {
        userId,
        dayOfWeek: w.dayOfWeek,
        name: w.name,
        category: w.category as never,
        muscleGroup: w.muscleGroup as never,
        isRest: w.isRest,
        hiitWorkoutId: w.hiitWorkoutId,
        sortOrder: w.sortOrder,
        exercises: {
          create: w.exercises.map((e) => ({
            poolExerciseId: e.poolExerciseId,
            tracked: e.tracked,
            metric: e.metric as never,
            sortOrder: e.sortOrder,
            scheme: e.scheme,
            programRole: e.programRole,
          })),
        },
      },
    });
  }
}

export type StartProgramInput = {
  key: string;
  /** Weekday for each program day, in day order. */
  days: number[];
  /** Chosen movement per slot, keyed "<day index>:<role key>"; null leaves it out. */
  picks: Record<string, string | null>;
  /** A recent top weight per main-lift movement; its training max is 90%. */
  tops: Record<string, number>;
};

/**
 * Start a program: it writes the person's weekly plan (an ordinary plan they
 * can edit) and keeps the old plan to go back to. A rotation is switched off,
 * not deleted. Any program already running ends first.
 */
export async function startProgram(userId: string, input: StartProgramInput): Promise<"ok" | "bad_request"> {
  const program = programByKey(input.key);
  if (!program) return "bad_request";
  if (input.days.length !== program.days.length) return "bad_request";
  if (new Set(input.days).size !== input.days.length || input.days.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) {
    return "bad_request";
  }
  const pickIds = [...new Set(Object.values(input.picks).filter((v): v is string => !!v))];
  const pool = pickIds.length
    ? ((await prisma.poolExercise.findMany({ where: { id: { in: pickIds } }, select: { id: true } })) as { id: string }[])
    : [];
  const known = new Set(pool.map((p) => p.id));

  const prev = await snapshotPlan(userId);
  const prevActive = (await prisma.personProgram.findFirst({
    where: { userId, status: "ACTIVE" },
    select: { id: true, previousPlan: true },
  })) as { id: string; previousPlan: unknown } | null;
  const today = todayISO();
  if (prevActive) {
    await prisma.personProgram.update({
      where: { id: prevActive.id },
      data: { status: "ENDED", endedOn: toDateColumn(today) },
    });
  }

  await prisma.plannedWorkout.deleteMany({ where: { userId } });
  if (prev.rotationActive) {
    await prisma.workoutRotation.updateMany({ where: { userId }, data: { isActive: false } });
  }

  const units = await loadWeightUnits();
  const maxes: Record<string, number> = {};
  for (let i = 0; i < program.days.length; i++) {
    const day = program.days[i];
    const dow = input.days[i];
    let order = 0;
    if (day.row) {
      await prisma.plannedWorkout.create({
        data: { userId, dayOfWeek: dow, name: "Rowing", category: "ROWING", sortOrder: order++ },
      });
    }
    // One planned workout per muscle group, in the order the day lists them.
    const groups: MuscleGroup[] = [];
    for (const r of day.roles) if (!groups.includes(r.muscleGroup)) groups.push(r.muscleGroup);
    for (const g of groups) {
      const exercises: { poolExerciseId: string; scheme: string; programRole: string }[] = [];
      for (const r of day.roles.filter((x) => x.muscleGroup === g)) {
        const id = input.picks[`${i}:${r.key}`];
        if (!id || !known.has(id) || exercises.some((e) => e.poolExerciseId === id)) continue;
        exercises.push({ poolExerciseId: id, scheme: schemeKey(r.scheme), programRole: r.key });
        const top = input.tops[id];
        if (r.main && typeof top === "number" && top > 0) maxes[id] = trainingMaxFrom(top, units[r.muscleGroup] ?? "lb");
      }
      if (exercises.length === 0) continue;
      await prisma.plannedWorkout.create({
        data: {
          userId,
          dayOfWeek: dow,
          name: MUSCLE_GROUP_LABEL[g],
          category: "WEIGHTS",
          muscleGroup: g,
          sortOrder: order++,
          exercises: {
            create: exercises.map((e, k) => ({
              poolExerciseId: e.poolExerciseId,
              tracked: true,
              metric: "WEIGHT",
              sortOrder: k,
              scheme: e.scheme,
              programRole: e.programRole,
            })),
          },
        },
      });
    }
  }

  // The block starts on the Sunday of this week, so weeks turn over with the
  // calendar week.
  const start = startOfWeek(today);
  await prisma.personProgram.create({
    data: {
      userId,
      programKey: program.key,
      status: "ACTIVE",
      startedOn: toDateColumn(today),
      blockStartedOn: toDateColumn(start),
      days: input.days.join(","),
      trainingMaxes: maxes,
      // Starting over from one program to another keeps the plan from before
      // the first, so "go back" means the person's own plan.
      previousPlan: (prevActive?.previousPlan as object | null) ?? (prev as unknown as object),
    },
  });
  await generateWorkoutTasks();
  return "ok";
}

/** End the program. `restore` puts back the plan it replaced; otherwise the
 *  program's plan stays as the person's own. */
export async function endProgram(userId: string, restore: boolean): Promise<void> {
  const row = (await prisma.personProgram.findFirst({
    where: { userId, status: "ACTIVE" },
    select: { id: true, previousPlan: true },
  })) as { id: string; previousPlan: unknown } | null;
  if (!row) return;
  await prisma.personProgram.update({
    where: { id: row.id },
    data: { status: "ENDED", endedOn: toDateColumn(todayISO()) },
  });
  const snap = row.previousPlan as PlanSnapshot | null;
  if (restore && snap && Array.isArray(snap.workouts)) {
    await prisma.plannedWorkout.deleteMany({ where: { userId } });
    await writePlan(userId, snap.workouts);
    if (snap.rotationActive) {
      await prisma.workoutRotation.updateMany({ where: { userId }, data: { isActive: true } });
    }
  }
  await generateWorkoutTasks();
}

/** End of a block: start the next one, raising the training maxes a step or
 *  repeating them. */
export async function nextBlock(userId: string, raise: boolean): Promise<void> {
  const p = await loadActiveProgram(userId);
  if (!p) return;
  const today = todayISO();
  const done = blocksDone(p.program, p.blockStartedOn, today);
  if (done < 1) return;
  const start = addDays(p.blockStartedOn, 7 * p.program.weeks * done);
  let maxes = p.trainingMaxes;
  if (raise) {
    const lower = new Set<string>();
    const kg = new Set<string>();
    const units = await loadWeightUnits();
    const rows = (await prisma.plannedExercise.findMany({
      where: { plannedWorkout: { userId }, programRole: { not: null } },
      select: { poolExerciseId: true, programRole: true, plannedWorkout: { select: { muscleGroup: true } } },
    })) as { poolExerciseId: string; programRole: string | null; plannedWorkout: { muscleGroup: string | null } }[];
    for (const r of rows) {
      const role = p.program.days.flatMap((d) => d.roles).find((x) => x.key === r.programRole);
      if (role?.lower) lower.add(r.poolExerciseId);
      const mg = r.plannedWorkout.muscleGroup as MuscleGroup | null;
      if (mg && units[mg] === "kg") kg.add(r.poolExerciseId);
    }
    // Each lift in its own unit: a kg group steps half as far.
    const lb = Object.fromEntries(Object.entries(maxes).filter(([id]) => !kg.has(id)));
    const metric = Object.fromEntries(Object.entries(maxes).filter(([id]) => kg.has(id)));
    maxes = { ...raisedMaxes(lb, lower, "lb"), ...raisedMaxes(metric, lower, "kg") };
  }
  await prisma.personProgram.update({
    where: { id: p.id },
    data: { blockStartedOn: toDateColumn(start), trainingMaxes: maxes },
  });
}

/** Set (or clear, with 0) one lift's training max. */
export async function setTrainingMax(userId: string, poolExerciseId: string, weight: number): Promise<void> {
  const p = await loadActiveProgram(userId);
  if (!p || !poolExerciseId) return;
  const maxes = { ...p.trainingMaxes };
  if (weight > 0) maxes[poolExerciseId] = weight;
  else delete maxes[poolExerciseId];
  await prisma.personProgram.update({ where: { id: p.id }, data: { trainingMaxes: maxes } });
}

/** The planned entry a slot comes from on a day (its scheme and program slot). */
export async function plannedSlotFor(
  userId: string,
  dateISO: string,
  slot: string,
): Promise<{ scheme: string | null; programRole: string | null; muscleGroup: string | null } | null> {
  const rows = (await prisma.plannedExercise.findMany({
    where: { poolExerciseId: slot, plannedWorkout: { userId, dayOfWeek: dayOfWeek(dateISO) } },
    select: { scheme: true, programRole: true, plannedWorkout: { select: { muscleGroup: true } } },
  })) as { scheme: string | null; programRole: string | null; plannedWorkout: { muscleGroup: string | null } }[];
  const r = rows.find((x) => x.scheme) ?? rows[0];
  return r ? { scheme: r.scheme, programRole: r.programRole, muscleGroup: r.plannedWorkout.muscleGroup } : null;
}

// --- the invite -------------------------------------------------------------------

const inviteKey = (userId: string) => `workouts.invite.${userId}`;

/**
 * "Start a workout program?" for someone with no plan, no program and nothing
 * logged in 30 days. "Not now" asks again in 30 days; "Don't ask again" stops it.
 */
export async function inviteFor(userId: string, today = todayISO()): Promise<boolean> {
  const snooze = await getSetting(inviteKey(userId));
  if (snooze === "never") return false;
  if (snooze && /^\d{4}-\d{2}-\d{2}$/.test(snooze) && snooze > today) return false;
  const [program, plans, rotation, recent] = (await Promise.all([
    prisma.personProgram.count({ where: { userId, status: "ACTIVE" } }),
    prisma.plannedWorkout.count({ where: { userId, isRest: false } }),
    prisma.workoutRotation.count({ where: { userId, isActive: true } }),
    prisma.workoutSession.count({
      where: { userId, isRest: false, date: { gte: toDateColumn(addDays(today, -30)) } },
    }),
  ])) as [number, number, number, number];
  return program === 0 && plans === 0 && rotation === 0 && recent === 0;
}

export async function answerInvite(userId: string, answer: "later" | "never"): Promise<void> {
  await setSetting(inviteKey(userId), answer === "never" ? "never" : addDays(todayISO(), 30));
}
