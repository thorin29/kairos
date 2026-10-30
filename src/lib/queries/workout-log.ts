import "server-only";
import { prisma } from "@/lib/prisma";
import { slotForDate } from "@/lib/workouts/rotation";
import { formatHiitMovement, WORKOUT_TYPE_LABEL, METRIC_LABEL_SHORT, defaultMetricFor, metricChoicesFor, MUSCLE_GROUPS, MUSCLE_GROUP_LABEL, CATEGORY_LABEL, METRIC_ONLY_CATEGORIES, hiitResult } from "@/lib/workouts/catalog";
import type { WorkoutType } from "@/generated/prisma/client";
import { addDays, todayISO, dayOfWeek, fromDateColumn, toDateColumn, daysBetween, startOfWeek } from "@/lib/dates";
import { metricUnit, type Metric, type MuscleGroup } from "@/lib/workouts/catalog";
import { loadWorkoutUnitSystem, loadWeightUnits } from "@/lib/queries/workouts";
import { doneOn, loadMovementStats, type MovementStats } from "@/lib/queries/movement-stats";
import { loadStaleContext } from "@/lib/chores/stale";
import { groupsFor, navRegionFor } from "@/lib/workouts/involvement";
import { setsSummary, topSet } from "@/lib/workouts/sets";
import { repRecords, REP_BANDS, bandPoints, weeksInARow, type RepRecord } from "@/lib/workouts/records";
import {
  parseScheme,
  programWeek,
  schemeLabel,
  targetsFor,
  weekIntent,
  weekLabel,
  type Program,
} from "@/lib/workouts/programs";
import { loadActiveProgram, plannedSlotFor, programInfoFor, type ProgramInfo } from "@/lib/workouts/program-run";

/**
 * The exercises scheduled for a person on a day, with any weight/reps already
 * logged — the same set the web personal view's scheduled-lift prompt shows
 * (queries/workouts.ts `today.scheduled`), pulled for one person without running
 * the whole household board. Phase 1 logs weight × reps per exercise, matching
 * that prompt; other metrics / multi-set / HIIT come later.
 */
export type TodayLogExercise = {
  exerciseId: string;
  name: string;
  unit: string;
  metric: string;
  logged: { weight: number | null; reps: number | null } | null;
};

export async function loadTodayExercises(
  userId: string,
  dayISO: string,
): Promise<TodayLogExercise[]> {
  const dow = dayOfWeek(dayISO);

  const [exercises, schedules, sets] = await Promise.all([
    prisma.exercise.findMany({
      where: { userId, isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, unit: true, metric: true },
    }),
    prisma.workoutSchedule.findMany({
      where: { userId, isActive: true },
      select: {
        exerciseId: true,
        dayOfWeek: true,
        isPaused: true,
        endDate: true,
      },
    }),
    prisma.sessionSet.findMany({
      where: {
        session: { userId, date: toDateColumn(dayISO) },
        exerciseId: { not: null },
        setNumber: 1,
      },
      select: { exerciseId: true, weight: true, reps: true },
    }),
  ]);

  const sched = new Map<
    string,
    { days: number[]; paused: boolean; endDate: string | null }
  >();
  for (const s of schedules) {
    const e = sched.get(s.exerciseId) ?? {
      days: [],
      paused: false,
      endDate: null,
    };
    e.days.push(s.dayOfWeek);
    e.paused = e.paused || s.isPaused;
    e.endDate = s.endDate ? fromDateColumn(s.endDate) : e.endDate;
    sched.set(s.exerciseId, e);
  }

  const logged = new Map<string, Pick<LoggedSet, "weight" | "reps">>(
    sets
      .filter((s) => s.exerciseId)
      .map((s) => [
        s.exerciseId as string,
        s as Pick<LoggedSet, "weight" | "reps">,
      ]),
  );

  return exercises
    .filter((e) => {
      const sc = sched.get(e.id);
      return (
        !!sc &&
        !sc.paused &&
        sc.days.includes(dow) &&
        (!sc.endDate || sc.endDate >= dayISO)
      );
    })
    .map((e) => {
      const l = logged.get(e.id);
      return {
        exerciseId: e.id,
        name: e.name,
        unit: e.unit,
        metric: e.metric as string,
        logged: l ? { weight: l.weight ?? null, reps: l.reps ?? null } : null,
      };
    });
}

/**
 * Today's planned workout for a person (e.g. "Legs") with its pool movements —
 * the model most people schedule with. Each movement logs a single value typed
 * by its metric, with the unit resolved from the household unit system, and any
 * value already logged today prefilled.
 */
export type PlannedMovement = {
  poolExerciseId: string;
  name: string;
  metric: string;
  unit: string;
  value: number | null;
  /** When this slot was logged with a SWAPPED movement for the day, what was
   *  actually done. Null means the planned movement itself. Lets the client show
   *  "Front squat (instead of Back squat)" with its value rather than a blank. */
  loggedAs?: { poolExerciseId: string; name: string } | null;
  /** A three-line history summary for the card: the record, the best rep count
   *  at any weight, and the most recent set. Null for anything not measured in
   *  weight, and for a movement with nothing logged yet.
   *
   *  Computed here rather than in each client so the web and the phone can't
   *  disagree about what someone's best lift is. */
  stats?: MovementStats | null;
  /** False for a movement the plan lists but doesn't ask a number for. It never
   *  holds up the day's completion. Absent = tracked. */
  tracked?: boolean;
  /** Reps logged with a WEIGHT value, so a reopened day refills both boxes. */
  reps?: number | null;
  /** Skipped for this day. Counts as done for this movement. */
  skipped?: boolean;
};


export type TodayPlanned = {
  plannedWorkoutId: string;
  name: string;
  /** Used to group same-muscle plans onto one card (Chest + Chest together). */
  muscleGroup: string | null;
  /** The plan's category, which decides its section on the day page. */
  category?: string | null;
  exercises: PlannedMovement[];
  /** The plan's own session exists for the day: how a plan with nothing to
   *  enter (every movement untracked) shows that it was marked complete. */
  sessionLogged?: boolean;
} | null;

/** The skip slot for a plan logged as one result (a named HIIT workout), which
 *  has no movement id of its own. */
export function planSlot(plannedWorkoutId: string): string {
  return `plan:${plannedWorkoutId}`;
}

/**
 * Whether one planned workout is done for its day: every movement it asks a
 * number for is logged or skipped. A plan that asks for none is done once it
 * was marked complete, or when everything on it was skipped.
 *
 * The one rule for "is this workout finished". The day's task, the overdue
 * list, and both clients' ticks all read it, so none of them can call a day
 * complete that another still shows as open.
 */
export function planDone(w: NonNullable<TodayPlanned>): boolean {
  const tracked = w.exercises.filter((e) => e.tracked !== false);
  if (tracked.length === 0) {
    return (
      !!w.sessionLogged ||
      (w.exercises.length > 0 && w.exercises.every((e) => e.skipped))
    );
  }
  return tracked.every((e) => e.value != null || !!e.skipped);
}

/** Anything actually recorded against this plan for its day. */
export function planHasLog(w: NonNullable<TodayPlanned>): boolean {
  return !!w.sessionLogged || w.exercises.some((e) => e.value != null);
}

type SlotLog = LoggedSet & {
  poolExerciseId: string | null;
  swappedFromId: string | null;
  poolExercise: { name: string } | null;
};

type LoggedSet = {
  weight: number | null;
  reps: number | null;
  distance: number | null;
  meters: number | null;
  seconds: number | null;
};

function valueForMetric(
  s: LoggedSet,
  metric: string,
): number | null {
  switch (metric) {
    case "WEIGHT":
      return s.weight;
    case "REPS":
      return s.reps;
    case "DISTANCE":
      return s.distance;
    case "METERS":
      return s.meters;
    case "DURATION":
      return s.seconds;
    default:
      return null;
  }
}

export async function loadTodayPlannedWorkout(
  userId: string,
  dayISO: string,
): Promise<TodayPlanned> {
  const dow = dayOfWeek(dayISO);
  const system = await loadWorkoutUnitSystem();

  const plan = await prisma.plannedWorkout.findFirst({
    where: { userId, dayOfWeek: dow, isRest: false },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      name: true,
      muscleGroup: true,
      hiitWorkoutId: true,
      hiitWorkout: { select: { type: true } },
      exercises: {
        orderBy: { sortOrder: "asc" },
        select: {
          poolExerciseId: true,
          metric: true,
          poolExercise: { select: { name: true } },
        },
      },
    },
  });
  if (!plan) return null;

  // HIIT/CrossFit workouts log a single result whose metric follows the workout
  // type: for-time/stations/pyramid -> a time, AMRAP -> rounds, the rest -> total
  // reps. Mirrors the web's hiitResult().
  const hiit = plan as unknown as {
    hiitWorkoutId: string | null;
    hiitWorkout: { type: string } | null;
  };
  if (hiit.hiitWorkoutId && hiit.hiitWorkout) {
    const res = hiitResult(hiit.hiitWorkout.type as WorkoutType);
    const unit = metricUnit(res.metric, system);
    const prior = await prisma.sessionSet.findFirst({
      where: { session: { userId, date: toDateColumn(dayISO) }, poolExerciseId: null },
      select: { weight: true, reps: true, distance: true, meters: true, seconds: true },
    });
    const value = prior ? valueForMetric(prior, res.metric) : null;
    return {
      plannedWorkoutId: plan.id,
      name: plan.name,
      muscleGroup: (plan as { muscleGroup?: string | null }).muscleGroup ?? null,
      exercises: [{ poolExerciseId: "", name: res.label, metric: res.metric, unit, value }],
    };
  }

  if (plan.exercises.length === 0) return null;

  const sets = await prisma.sessionSet.findMany({
    where: {
      session: { userId, date: toDateColumn(dayISO) },
      poolExerciseId: { not: null },
    },
    select: {
      poolExerciseId: true,
      weight: true,
      reps: true,
      distance: true,
      meters: true,
      seconds: true,
    },
  });
  const loggedByPool = new Map<string, LoggedSet>(
    sets
      .filter((s) => s.poolExerciseId)
      .map((s) => [s.poolExerciseId as string, s as LoggedSet]),
  );

  const exercises: PlannedMovement[] = plan.exercises.map((pe) => {
    const metric = (pe.metric ?? "WEIGHT") as string;
    const unit = metricUnit(metric as Metric, system);
    const logged = loggedByPool.get(pe.poolExerciseId);
    return {
      poolExerciseId: pe.poolExerciseId,
      name: pe.poolExercise.name,
      metric,
      unit,
      value: logged ? valueForMetric(logged, metric) : null,
    };
  });

  return {
    plannedWorkoutId: plan.id,
    name: plan.name,
    muscleGroup: (plan as { muscleGroup?: string | null }).muscleGroup ?? null,
    exercises,
  };
}

/** The plans that count for a day. Only workouts that existed on this day count
 *  for it, so a plan built later never makes a past day look "overdue" (it was
 *  scheduled under a different, already-logged plan). Mirrors the generator's
 *  trainsSince clamp. */
function dayPlanWhere(userId: string, dayISO: string) {
  return {
    userId,
    dayOfWeek: dayOfWeek(dayISO),
    isRest: false,
    createdAt: { lt: toDateColumn(addDays(dayISO, 1)) },
  };
}

/**
 * How far through its plan a day is, for settling the day's workout task.
 *
 * `done`: every plan is done (planDone). A plan with nothing at all to enter —
 * a run or a swim logged as one number — is done once logged or skipped; those
 * plans are left out of loadTodayPlannedWorkouts, so they are read here.
 * `logged`: anything recorded against a plan. `planNames`: every plan's name
 * (cut to 40), so a session under any other name is known to be unplanned.
 * `planCount` 0 means nothing was planned.
 */
export async function loadDayPlanProgress(
  userId: string,
  dayISO: string,
): Promise<{ done: boolean; logged: boolean; planNames: string[]; planCount: number }> {
  const day = toDateColumn(dayISO);
  const [movementPlans, allPlans, skipRows, sessionRows] = (await Promise.all([
    loadTodayPlannedWorkouts(userId, dayISO),
    prisma.plannedWorkout.findMany({
      where: dayPlanWhere(userId, dayISO),
      select: {
        id: true,
        name: true,
        category: true,
        hiitWorkoutId: true,
        _count: { select: { exercises: true } },
      },
    }),
    prisma.workoutMovementSkip.findMany({
      where: { userId, date: day },
      select: { slot: true },
    }),
    prisma.workoutSession.findMany({
      where: { userId, date: day, isRest: false },
      select: { name: true, category: true },
    }),
  ])) as [
    NonNullable<TodayPlanned>[],
    {
      id: string;
      name: string;
      category: string | null;
      hiitWorkoutId: string | null;
      _count: { exercises: number };
    }[],
    { slot: string }[],
    { name: string | null; category: string | null }[],
  ];
  const skipped = new Set(skipRows.map((r) => r.slot));
  const sessionKeys = new Set(
    sessionRows
      .filter((r) => r.name)
      .map((r) => `${(r.name as string).slice(0, 40)}|${r.category ?? ""}`),
  );
  const soloPlans = allPlans.filter(
    (p) => !p.hiitWorkoutId && p._count.exercises === 0,
  );
  const soloLogged = soloPlans.map((p) =>
    sessionKeys.has(`${p.name.slice(0, 40)}|${p.category ?? ""}`),
  );
  const soloDone = soloPlans.map(
    (p, i) => soloLogged[i] || skipped.has(planSlot(p.id)),
  );
  return {
    done: movementPlans.every(planDone) && soloDone.every(Boolean),
    logged: movementPlans.some(planHasLog) || soloLogged.some(Boolean),
    planNames: allPlans.map((p) => p.name.slice(0, 40)),
    planCount: movementPlans.length + soloPlans.length,
  };
}

/** All of a person's planned workouts for the day (a day can have several, e.g.
 *  Core AND Arms). Same per-plan shape as loadTodayPlannedWorkout, but every
 *  non-empty plan is returned so the card/logger can show them all. */
export async function loadTodayPlannedWorkouts(
  userId: string,
  dayISO: string,
): Promise<NonNullable<TodayPlanned>[]> {
  const system = await loadWorkoutUnitSystem();

  const plans = await prisma.plannedWorkout.findMany({
    where: dayPlanWhere(userId, dayISO),
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      name: true,
      category: true,
      muscleGroup: true,
      hiitWorkoutId: true,
      hiitWorkout: { select: { type: true } },
      exercises: {
        orderBy: { sortOrder: "asc" },
        select: {
          poolExerciseId: true,
          metric: true,
          tracked: true,
          poolExercise: { select: { name: true } },
        },
      },
    },
  });

  // The day's skips and its sessions, read once for every plan below.
  const day = toDateColumn(dayISO);
  const [skipRows, sessionRows] = (await Promise.all([
    prisma.workoutMovementSkip.findMany({
      where: { userId, date: day },
      select: { slot: true },
    }),
    prisma.workoutSession.findMany({
      where: { userId, date: day, isRest: false },
      select: { name: true, category: true },
    }),
  ])) as [{ slot: string }[], { name: string | null; category: string | null }[]];
  const skipped = new Set(skipRows.map((r) => r.slot));
  // A HIIT plan's name is cut to 40 characters and its session's to 60, so
  // compare on the shorter.
  const sessionKeys = new Set(
    sessionRows
      .filter((r) => r.name)
      .map((r) => `${(r.name as string).slice(0, 40)}|${r.category ?? ""}`),
  );
  const hasSession = (p: { name: string; category: string | null }) =>
    sessionKeys.has(`${p.name.slice(0, 40)}|${p.category ?? ""}`);

  // Every weight movement in the day's plans, in one read. Per-plan or
  // per-movement queries would multiply by however many cards the day holds.
  const statIds = [
    ...new Set(
      (plans as unknown as { exercises: { poolExerciseId: string }[] }[])
        .flatMap((p) => p.exercises.map((e) => e.poolExerciseId))
        .filter(Boolean),
    ),
  ];
  const statsById = await loadMovementStats(userId, statIds);

  const out: NonNullable<TodayPlanned>[] = [];
  for (const plan of plans) {
    const hiit = plan as unknown as {
      hiitWorkoutId: string | null;
      hiitWorkout: { type: string } | null;
    };
    if (hiit.hiitWorkoutId && hiit.hiitWorkout) {
      const res = hiitResult(hiit.hiitWorkout.type as WorkoutType);
      const unit = metricUnit(res.metric, system);
      const prior = await prisma.sessionSet.findFirst({
        where: { session: { userId, date: toDateColumn(dayISO) }, poolExerciseId: null },
        select: { weight: true, reps: true, distance: true, meters: true, seconds: true },
      });
      const value = prior ? valueForMetric(prior, res.metric) : null;
      out.push({
        plannedWorkoutId: plan.id,
        name: plan.name,
        muscleGroup: (plan as { muscleGroup?: string | null }).muscleGroup ?? null,
        category: (plan as { category?: string | null }).category ?? null,
        exercises: [
          {
            poolExerciseId: "",
            name: res.label,
            metric: res.metric,
            unit,
            value,
            tracked: true,
            reps: null,
            skipped: skipped.has(planSlot(plan.id)),
          },
        ],
        sessionLogged: hasSession(plan as { name: string; category: string | null }),
      });
      continue;
    }
    if (plan.exercises.length === 0) continue;

    const sets = await prisma.sessionSet.findMany({
      where: { session: { userId, date: toDateColumn(dayISO) }, poolExerciseId: { not: null } },
      select: {
        poolExerciseId: true,
        swappedFromId: true,
        poolExercise: { select: { name: true } },
        weight: true,
        reps: true,
        distance: true,
        meters: true,
        seconds: true,
      },
    });
    // A set logged for a one-day swap belongs to the PLANNED slot it replaced,
    // so key by that; otherwise the planned row comes back blank and the day
    // looks unlogged even though it isn't.
    // A movement logged set by set has several: the slot shows its top set,
    // the same rule as everywhere else (topSet), not whichever came last.
    const slotSets = new Map<string, SlotLog[]>();
    for (const s of sets) {
      if (!s.poolExerciseId) continue;
      const slot = (s.swappedFromId ?? s.poolExerciseId) as string;
      const list = slotSets.get(slot) ?? [];
      list.push(s as unknown as SlotLog);
      slotSets.set(slot, list);
    }
    const loggedBySlot = new Map<string, SlotLog>();
    for (const [slot, list] of slotSets) {
      const top = topSet(list);
      if (top) loggedBySlot.set(slot, top);
    }
    type PlanEx = { poolExerciseId: string; metric: string | null; tracked?: boolean; poolExercise: { name: string } };
    const exercises: PlannedMovement[] = (plan.exercises as PlanEx[]).map((pe: PlanEx) => {
      const metric = (pe.metric ?? "WEIGHT") as string;
      const unit = metricUnit(metric as Metric, system);
      const logged = loggedBySlot.get(pe.poolExerciseId);
      const swapped =
        logged && logged.poolExerciseId && logged.poolExerciseId !== pe.poolExerciseId
          ? { poolExerciseId: logged.poolExerciseId, name: logged.poolExercise?.name ?? "" }
          : null;
      return {
        poolExerciseId: pe.poolExerciseId,
        name: pe.poolExercise.name,
        metric,
        unit,
        value: logged ? valueForMetric(logged, metric) : null,
        loggedAs: swapped,
        // Only weights carry a record worth printing; a plank's "best" is a
        // duration and belongs in a different shape than this card has.
        stats: metric === "WEIGHT" ? (statsById[pe.poolExerciseId] ?? null) : null,
        tracked: (pe as { tracked?: boolean }).tracked !== false,
        // Sent back so a reopened day refills the reps box as well as the
        // weight. Without it the phone came back with the weight alone.
        reps: metric === "WEIGHT" && logged ? logged.reps : null,
        skipped: skipped.has(pe.poolExerciseId),
      };
    });
    out.push({
      plannedWorkoutId: plan.id,
      name: plan.name,
      muscleGroup: (plan as { muscleGroup?: string | null }).muscleGroup ?? null,
      category: (plan as { category?: string | null }).category ?? null,
      exercises,
      sessionLogged: hasSession(plan as { name: string; category: string | null }),
    });
  }
  return out;
}

/**
 * A person's workout history and per-movement weight progress, for the Workouts
 * page. Series = max weight per day per pool movement (the graph); history =
 * recent sessions with a short label and result line.
 */
/** value = the day's heaviest weight (the record); reps = that set's rep count
 *  when it was logged, carried as context, never as the record itself. */
export type GraphPoint = {
  date: string;
  value: number;
  reps?: number | null;
  /** LIGHT or TEST: a program's light or test day, drawn hollow (v0.611). */
  intent?: string | null;
};
/** Body-map facts for one movement, in the shape the clients consume. */
function bodyMapFor(name: string, filed: string | null) {
  const g = groupsFor(name, filed as MuscleGroup | null);
  return {
    navRegion: navRegionFor(name, filed as MuscleGroup | null),
    shadePrimary: g.primary,
    shadeSecondary: g.secondary,
    view: g.view,
  };
}

export type ProgressSeries = {
  poolExerciseId: string;
  name: string;
  /** The muscle group this movement is planned under, for grouping. */
  muscleGroup?: string | null;
  /** True when a plan marks this movement tracked; false for history-only
   *  movements (a rotation or plan-less person has only these). */
  tracked?: boolean;
  unit: string;
  points: GraphPoint[];
  /** Heaviest set ever logged for this movement — the record, plus the reps it
   *  was done for. Null until something is logged. */
  best?: { date: string; value: number; reps: number | null } | null;
  /** Best weight actually lifted at each rep count. Real sets only. */
  repMaxes?: { reps: number; value: number; date: string }[];
  /** The same line for one rep range at a time ("4–6 reps"), so sets are
   *  compared with sets like them (v0.610). Only ranges with a point. */
  bands?: { key: string; label: string; points: GraphPoint[] }[];
  /**
   * Body-map facts, resolved HERE so the two clients cannot drift. The
   * involvement table is a single TypeScript file; reimplementing it in Kotlin
   * would mean two tables to keep honest about what a deadlift works.
   *
   * navRegion — the one region that selects this movement.
   * shadePrimary / shadeSecondary — the groups it lights, strongly and faintly.
   * view — which figure it shows on.
   */
  navRegion?: string | null;
  shadePrimary?: string | null;
  shadeSecondary?: string[];
  view?: string;
};
export type WorkoutHistoryEntry = {
  id: string;
  date: string;
  label: string;
  result: string;
  isRest: boolean;
};
export type WorkoutProgress = {
  series: ProgressSeries[];
  /** Weekdays (0 = Sunday) that get a grid row: the plan's days, or the
   *  rotation's working days, or the days actually trained. Empty = hide. */
  planDays?: { day: number; groups: string[] }[];
  /** Muscle group the body map opens on: today's plan, today's rotation slot,
   *  or the most recently trained group. */
  defaultGroup?: string | null;
  /** Which movement to show by default: today's tracked weights, or the next
   *  day that has one. Null when there's nothing to graph. */
  defaultId: string | null;
  history: WorkoutHistoryEntry[];
};

export async function loadWorkoutProgress(
  userId: string,
  todayISO: string,
): Promise<WorkoutProgress> {
  const system = await loadWorkoutUnitSystem();
  const weightUnit = metricUnit("WEIGHT" as Metric, system);
  const dow = dayOfWeek(todayISO);

  const [plans, recent, rotationRow] = await Promise.all([
    prisma.plannedWorkout.findMany({
      where: { userId },
      select: {
        dayOfWeek: true,
        isRest: true,
        category: true,
        muscleGroup: true,
        exercises: {
          orderBy: { sortOrder: "asc" },
          select: {
            poolExerciseId: true,
            tracked: true,
            metric: true,
            poolExercise: {
              select: { name: true, category: true, muscleGroup: true },
            },
          },
        },
      },
    }),
    prisma.workoutSession.findMany({
      where: { userId },
      // Ordered and taken by DUE date because that is all Postgres can sort on
      // here (no COALESCE in a Prisma orderBy). Over-fetched, then re-sorted
      // and trimmed below on the day each one was actually done — a workout due
      // three weeks ago but caught up on yesterday has to survive the `take` to
      // appear at the top of the list where it belongs.
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 60,
      select: {
        id: true,
        date: true,
        completedOn: true,
        name: true,
        isRest: true,
        sets: {
          orderBy: { setNumber: "asc" },
          select: {
            weight: true,
            reps: true,
            unit: true,
            poolExercise: { select: { name: true } },
          },
        },
      },
    }),
    prisma.workoutRotation.findUnique({
      where: { userId },
      select: {
        isActive: true,
        anchorDate: true,
        restMask: true,
        slots: {
          orderBy: { position: "asc" },
          select: { position: true, name: true, category: true, muscleGroup: true, isRest: true },
        },
      },
    }),
  ]);

  // The person's tracked weight movements (the only ones graphed / selectable).
  const isWeight = (poolCat: string | null, metric: string | null) =>
    poolCat === "WEIGHTS" || metric === "WEIGHT";
  const trackedNames = new Map<string, string>();
  // The plan's muscle group names the card on the logging screen ("Core"), so
  // it names the progress block too; the movement's own group is the fallback
  // for a plan that never set one.
  const trackedGroups = new Map<string, string | null>();
  for (const p of plans) {
    const planGroup = (p as { muscleGroup?: string | null }).muscleGroup ?? null;
    for (const e of p.exercises) {
      if (e.tracked && isWeight(e.poolExercise.category, e.metric)) {
        trackedNames.set(e.poolExerciseId, e.poolExercise.name);
        const own =
          (e.poolExercise as { muscleGroup?: string | null }).muscleGroup ?? null;
        if (!trackedGroups.get(e.poolExerciseId)) {
          trackedGroups.set(e.poolExerciseId, planGroup ?? own);
        }
      }
    }
  }

  // Snapshot of what the PLAN tracks, taken before history widens the map
  // below, so `tracked` means "a plan asked for this" and not "this exists".
  const plannedIds = new Set(trackedNames.keys());
  const trackedIds = [...trackedNames.keys()];

  // Max weight per day. The universe is every movement with a logged weight
  // set, NOT just the ones a plan marks tracked: a person on a rotation has no
  // planned movements at all (a rotation slot carries a muscle group and no
  // exercises), and a person with no plan has nothing either. Restricting to
  // tracked left both with an empty progress view while their history sat in
  // the table. `tracked` survives as a flag on each series so a planned
  // movement can still be preferred in the UI.
  const wSets = await prisma.sessionSet.findMany({
    where: { session: { userId }, weight: { not: null } },
    select: {
      weight: true,
      reps: true,
      poolExerciseId: true,
      poolExercise: { select: { name: true, muscleGroup: true } },
      session: { select: { date: true, completedOn: true, intent: true } },
    },
  });
  // A movement seen only in history still needs a name and a group.
  for (const s of wSets) {
    if (!s.poolExerciseId || !s.poolExercise) continue;
    if (!trackedNames.has(s.poolExerciseId)) {
      trackedNames.set(s.poolExerciseId, s.poolExercise.name);
    }
    if (!trackedGroups.get(s.poolExerciseId)) {
      trackedGroups.set(
        s.poolExerciseId,
        (s.poolExercise as { muscleGroup?: string | null }).muscleGroup ?? null,
      );
    }
  }

  // Which weekdays get a row in the attendance grid, worked out once here so
  // both clients agree. Three kinds of person, three sources:
  //   weekly plan  -> the weekdays the plan uses
  //   rotation     -> every weekday that is not a fixed rest day (a rotation is
  //                   still a plan; what it lacks is a weekly shape)
  //   neither      -> the weekdays that actually carry a logged session, so it
  //                   is not seven mostly-empty rows
  // Nothing at all leaves this empty and the clients hide the card.
  const rot = rotationRow as unknown as {
    isActive: boolean;
    anchorDate: Date;
    restMask: number;
    slots: { position: number; name: string; category: string | null; muscleGroup: string | null; isRest: boolean }[];
  } | null;
  const rotationShape =
    rot && rot.isActive && rot.slots.length > 0
      ? {
          anchorISO: fromDateColumn(rot.anchorDate),
          restMask: rot.restMask,
          slots: rot.slots.map((sl) => ({
            position: sl.position,
            name: sl.name,
            category: sl.category,
            muscleGroup: sl.muscleGroup,
            isRest: sl.isRest,
          })),
        }
      : null;

  const planDays: { day: number; groups: string[] }[] = [];
  for (let d = 0; d < 7; d++) {
    const onDay = plans.filter((p) => p.dayOfWeek === d && !p.isRest);
    if (onDay.length === 0) continue;
    const groups: string[] = [];
    for (const p of onDay) {
      const g = (p as { muscleGroup?: string | null }).muscleGroup ?? null;
      if (g && !groups.includes(g)) groups.push(g);
    }
    planDays.push({ day: d, groups });
  }
  if (planDays.length === 0 && rotationShape) {
    for (let d = 0; d < 7; d++) {
      if ((rotationShape.restMask & (1 << d)) !== 0) continue;
      planDays.push({ day: d, groups: [] });
    }
  }
  if (planDays.length === 0) {
    const seen = new Set<number>();
    for (const s2 of wSets) seen.add(dayOfWeek(doneOn(s2.session)));
    for (const d of [...seen].sort((a, b) => a - b)) planDays.push({ day: d, groups: [] });
  }

  // Which muscle group the body map opens on. Today's plan first, then today's
  // rotation slot, then whatever was trained most recently — a person with no
  // plan still has a last workout, and that is the one they want.
  let defaultGroup: string | null = null;
  const todaysPlans = plans.filter((p) => p.dayOfWeek === dow && !p.isRest);
  for (const p of todaysPlans) {
    const g = (p as { muscleGroup?: string | null }).muscleGroup ?? null;
    if (g) { defaultGroup = g; break; }
  }
  if (!defaultGroup && rotationShape) {
    const r = slotForDate(rotationShape, todayISO);
    if (r.kind === "workout") defaultGroup = r.slot.muscleGroup ?? null;
  }
  if (!defaultGroup) {
    let latest = "";
    for (const s2 of wSets) {
      if (!s2.poolExercise) continue;
      const d = doneOn(s2.session);
      const g = (s2.poolExercise as { muscleGroup?: string | null }).muscleGroup ?? null;
      if (g && d > latest) { latest = d; defaultGroup = g; }
    }
  }

  const perDay = new Map<string, Map<string, { value: number; reps: number | null }>>();
  // movement -> every weighted set with reps, dated, for the rep-range lines
  const dated = new Map<string, { weight: number; reps: number; date: string }[]>();
  // movement -> reps -> heaviest weight actually lifted at that rep count
  const repMaxes = new Map<string, Map<number, { value: number; date: string }>>();
  // Days logged as a program's light or test day, drawn hollow (v0.611).
  const intentOn = new Map<string, string>();
  for (const s of wSets) {
    if (s.weight == null || !s.poolExerciseId) continue;
    const d = doneOn(s.session);
    const intent = (s.session as { intent?: string | null }).intent;
    if (intent) intentOn.set(d, intent);
    const m = perDay.get(s.poolExerciseId) ?? new Map<string, { value: number; reps: number | null }>();
    const prev = m.get(d);
    // Heaviest wins the day; on a tie the set with more reps is the better one.
    if (!prev || s.weight > prev.value || (s.weight === prev.value && (s.reps ?? 0) > (prev.reps ?? 0))) {
      m.set(d, { value: s.weight, reps: s.reps });
    }
    perDay.set(s.poolExerciseId, m);
    if (s.reps != null && s.reps > 0) {
      const list = dated.get(s.poolExerciseId) ?? [];
      list.push({ weight: s.weight, reps: s.reps, date: d });
      dated.set(s.poolExerciseId, list);
      const rm = repMaxes.get(s.poolExerciseId) ?? new Map<number, { value: number; date: string }>();
      const cur = rm.get(s.reps);
      if (!cur || s.weight > cur.value) rm.set(s.reps, { value: s.weight, date: d });
      repMaxes.set(s.poolExerciseId, rm);
    }
  }

  const series: ProgressSeries[] = [...trackedNames.entries()]
    .map(([id, name]) => ({
      poolExerciseId: id,
      name,
      muscleGroup: trackedGroups.get(id) ?? null,
      tracked: plannedIds.has(id),
      ...bodyMapFor(name, trackedGroups.get(id) ?? null),
      unit: weightUnit,
      points: [...(perDay.get(id)?.entries() ?? [])]
        .map(([date, p]) => ({ date, value: p.value, reps: p.reps, intent: intentOn.get(date) ?? null }))
        .sort((a, b) => (a.date < b.date ? -1 : 1)),
      // The heaviest set ever: the headline number, with the reps it was done
      // for as context. Never an estimate.
      best:
        [...(perDay.get(id)?.entries() ?? [])]
          .map(([date, p]) => ({ date, value: p.value, reps: p.reps }))
          .sort((a, b) => b.value - a.value || (b.reps ?? 0) - (a.reps ?? 0))[0] ?? null,
      repMaxes: [...(repMaxes.get(id)?.entries() ?? [])]
        .map(([reps, r]) => ({ reps, value: r.value, date: r.date }))
        .sort((a, b) => a.reps - b.reps),
      bands: REP_BANDS.map((b) => ({
        key: b.key,
        label: b.label,
        points: bandPoints(dated.get(id) ?? [], b),
      })).filter((b) => b.points.length > 0),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  // Default: today's tracked weights, else the next day that has some.
  const weightsOn = (d: number): string[] =>
    plans
      .filter((p) => p.dayOfWeek === d && p.category === "WEIGHTS" && !p.isRest)
      .flatMap((p) =>
        p.exercises
          .filter((e) => e.tracked && isWeight(e.poolExercise.category, e.metric))
          .map((e) => e.poolExerciseId),
      );
  let defaultId: string | null = weightsOn(dow)[0] ?? null;
  if (!defaultId) {
    for (let i = 1; i <= 7; i++) {
      const found = weightsOn((dow + i) % 7)[0];
      if (found) {
        defaultId = found;
        break;
      }
    }
  }
  if (!defaultId) {
    defaultId =
      series.find((s) => s.points.length > 0)?.poolExerciseId ??
      series[0]?.poolExerciseId ??
      null;
  }

  // Typed off the query rather than left implicit: real in the Docker build,
  // `any` in a sandbox with no generated client, and explicit in both.
  // Annotated into its own binding before sorting: chaining .sort() straight
  // off .map() leaves the comparator's parameters untyped whenever the query
  // row type is unavailable, and the annotation on `history` lands too late to
  // help. This way the array being sorted is the typed one.
  const rows: WorkoutHistoryEntry[] = recent.map((s: (typeof recent)[number]) => ({
    id: s.id,
    // The day it was done, not the day it counts for.
    date: doneOn(s as unknown as { date: Date; completedOn?: Date | null }),
    label: s.isRest ? "Rest day" : s.name?.trim() || "Workout",
    result: s.isRest ? "" : historyResult(s.sets),
    isRest: s.isRest,
  }));
  // Newest-first by the date now being SHOWN. Leaving the due-date order in
  // place would print Monday's catch-up under its real 10/6 label but below a
  // 10/6 entry, and a list whose dates do not descend reads as broken.
  rows.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  const history: WorkoutHistoryEntry[] = rows.slice(0, 20);

  return { series, defaultId, history, planDays, defaultGroup };
}

function historyResult(
  sets: {
    weight: number | null;
    reps: number | null;
    unit: string | null;
    poolExercise: { name: string } | null;
  }[],
): string {
  if (sets.length === 0) return "";
  if (sets.length === 1) {
    const x = sets[0];
    if (x.weight != null && x.reps != null) {
      return `${trimNum(x.weight)}${x.unit ?? ""} × ${x.reps}`;
    }
    if (x.weight != null) return `${trimNum(x.weight)}${x.unit ?? ""}`;
    return x.poolExercise?.name ?? "Logged";
  }
  const names = [
    ...new Set(sets.map((x) => x.poolExercise?.name).filter((n): n is string => !!n)),
  ];
  // One movement, several sets: "5 sets · top 185 × 1", not its name.
  if (names.length === 1 && sets.some((x) => x.weight != null)) return setsSummary(sets);
  if (names.length === 0) return `${sets.length} movements`;
  const shown = names.slice(0, 3).join(", ");
  return names.length > 3 ? `${shown} +${names.length - 3}` : shown;
}

function trimNum(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

/**
 * Everything the "Log a different workout" form needs: the loggable categories
 * (each with its metric choices and units) and the shared exercise pool.
 * Mirrors the web's CustomWorkoutForm config (workouts-grid.tsx). HIIT is
 * omitted for now (it uses a dedicated builder).
 */
export type MetricOption = { key: string; label: string; unit: string };
export type LogCategory = {
  key: string;
  label: string;
  isPool: boolean;
  metrics: MetricOption[];
  load: boolean;
};
export type PoolExerciseLite = { id: string; name: string; category: string; muscleGroup: string | null };
export type HiitLogOption = {
  id: string;
  name: string;
  hero: boolean;
  resultMetric: string;
  resultLabel: string;
  resultUnit: string;
};

export type WorkoutPool = {
  categories: LogCategory[];
  exercises: PoolExerciseLite[];
  hiitWorkouts: HiitLogOption[];
  muscleGroups: { key: string; label: string }[];
};

const CATEGORY_LABELS: Record<string, string> = {
  WEIGHTS: "Weights",
  HIIT: "HIIT/CrossFit",
  RUNNING: "Running",
  ROWING: "Rowing",
  SPORT: "Sport",
  STRETCHING: "Stretching",
  ISOMETRIC: "Isometric",
  RUCKING: "Rucking",
};
const METRIC_LABELS: Record<string, string> = {
  DURATION: "Time",
  REPS: "Reps / rounds",
  DISTANCE: "Distance",
  METERS: "Meters",
  WEIGHT: "Weight",
};
// key: [category], value: metric config (locked or choices, + load, + isPool).
const CAT_CFG: Record<
  string,
  { locked?: string; choices?: string[]; load?: boolean; pool: boolean }
> = {
  // Not locked: a weights session routinely holds a plank or counts sit-ups.
  // This table feeds the phone's catalogue, so leaving it locked here while
  // widening metricChoicesFor() would let the web offer a choice the phone could
  // not. Two tables, one answer.
  WEIGHTS: { choices: ["WEIGHT", "DURATION", "REPS"], pool: true },
  HIIT: { choices: ["DURATION", "REPS"], pool: true },
  RUNNING: { choices: ["DISTANCE", "METERS"], pool: false },
  ROWING: { locked: "METERS", pool: false },
  RUCKING: { locked: "DISTANCE", load: true, pool: false },
  SPORT: { choices: ["DURATION", "REPS"], pool: true },
  STRETCHING: { choices: ["DURATION", "REPS"], pool: true },
  ISOMETRIC: { choices: ["DURATION", "REPS"], pool: true },
};
// Order shown in the picker.
const CAT_ORDER = ["WEIGHTS", "HIIT", "RUNNING", "ROWING", "RUCKING", "SPORT", "STRETCHING", "ISOMETRIC"];

function unitForMetric(metric: string, system: string): string {
  switch (metric) {
    case "WEIGHT":
      return system === "metric" ? "kg" : "lb";
    case "DISTANCE":
      return system === "metric" ? "km" : "mi";
    case "METERS":
      return "m";
    case "REPS":
      return "reps";
    default:
      return "";
  }
}

export async function loadWorkoutPool(userId?: string): Promise<WorkoutPool> {
  const system = await loadWorkoutUnitSystem();

  const categories: LogCategory[] = CAT_ORDER.map((key) => {
    const cfg = CAT_CFG[key];
    const metricKeys = cfg.locked ? [cfg.locked] : (cfg.choices ?? ["REPS"]);
    return {
      key,
      label: CATEGORY_LABELS[key] ?? key,
      isPool: cfg.pool,
      load: !!cfg.load,
      metrics: metricKeys.map((m) => ({
        key: m,
        label: METRIC_LABELS[m] ?? m,
        unit: unitForMetric(m, system),
      })),
    };
  });

  const exercises = await prisma.poolExercise.findMany({
    where: {
      isActive: true,
      OR: [{ ownerId: null }, ...(userId ? [{ ownerId: userId }] : [])],
    },
    orderBy: { name: "asc" },
    select: { id: true, name: true, category: true, muscleGroup: true },
  });

  // Named HIIT/CrossFit workouts you can log: the shared library (admin, normal +
  // Hero) plus your own. Same set the browse list and web use.
  const hiitRows = await prisma.hiitWorkout.findMany({
    where: { OR: [{ ownerId: null, approved: true }, ...(userId ? [{ ownerId: userId }] : [])] },
    orderBy: [{ heroWod: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, type: true, heroWod: true },
  });
  const hiitWorkouts: HiitLogOption[] = hiitRows.map((w) => {
    const res = hiitResult(w.type as WorkoutType);
    return {
      id: w.id,
      name: w.heroWod ? `${w.name} (Hero)` : w.name,
      hero: w.heroWod,
      resultMetric: res.metric,
      resultLabel: res.label,
      resultUnit: metricUnit(res.metric, system),
    };
  });

  const muscleGroups = (MUSCLE_GROUPS as string[]).map((m) => ({
    key: m,
    label: (MUSCLE_GROUP_LABEL as Record<string, string>)[m] ?? m,
  }));

  return {
    categories,
    exercises: exercises.map((e) => ({
      id: e.id,
      name: e.name,
      category: e.category as string,
      muscleGroup: (e as { muscleGroup?: string | null }).muscleGroup ?? null,
    })),
    hiitWorkouts,
    muscleGroups,
  };
}

/** Named workouts this person can browse: the shared approved library plus
 *  their own. Mirrors the web "Browse workouts" list. */
export type BrowsableWorkout = {
  id: string;
  name: string;
  type: string;
  typeLabel: string;
  personal: boolean;
  heroWod: boolean;
  detail: string;
};

export async function loadBrowsableWorkouts(
  userId: string,
): Promise<BrowsableWorkout[]> {
  const rows = await prisma.hiitWorkout.findMany({
    where: {
      OR: [{ ownerId: null, approved: true }, { ownerId: userId }],
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      type: true,
      heroWod: true,
      notes: true,
      ownerId: true,
      movements: {
        orderBy: { position: "asc" },
        select: {
          reps: true,
          distance: true,
          weight: true,
          poolExercise: { select: { name: true } },
        },
      },
    },
  });

  return rows.map((w) => {
    const moves = w.movements.map((m) =>
      formatHiitMovement({
        name: m.poolExercise?.name ?? "—",
        reps: m.reps,
        distance: m.distance,
        weight: m.weight,
      }),
    );
    const detail = w.notes?.trim()
      ? w.notes.trim()
      : moves.length > 0
        ? moves.join(", ")
        : "No details yet.";
    return {
      id: w.id,
      name: w.name,
      type: w.type as string,
      typeLabel: (WORKOUT_TYPE_LABEL as Record<string, string>)[w.type] ?? (w.type as string),
      personal: w.ownerId === userId,
      heroWod: w.heroWod,
      detail,
    };
  });
}

/** The person's weekly plan (7 days), each workout flattened to a name + a
 *  one-line detail, mirroring the web PlanBuilder rows. */
export type PlanWorkoutLite = {
  id: string;
  name: string;
  isRest: boolean;
  detail: string;
};
export type PlanDayLite = { day: number; workouts: PlanWorkoutLite[] };

export async function loadPlan(userId: string): Promise<PlanDayLite[]> {
  const rows = await prisma.plannedWorkout.findMany({
    where: { userId },
    orderBy: [{ dayOfWeek: "asc" }, { sortOrder: "asc" }],
    select: {
      id: true,
      name: true,
      dayOfWeek: true,
      category: true,
      isRest: true,
      hiitWorkout: {
        select: {
          type: true,
          movements: {
            orderBy: { position: "asc" },
            select: {
              reps: true,
              distance: true,
              weight: true,
              poolExercise: { select: { name: true } },
            },
          },
        },
      },
      exercises: {
        orderBy: { sortOrder: "asc" },
        select: { tracked: true, poolExercise: { select: { name: true } } },
      },
    },
  });

  const byDay = new Map<number, PlanWorkoutLite[]>();
  for (let d = 0; d < 7; d++) byDay.set(d, []);
  for (const w of rows) {
    byDay.get(w.dayOfWeek)?.push({
      id: w.id,
      name: w.name,
      isRest: w.isRest,
      detail: planDetail(w),
    });
  }
  return [...byDay.entries()].map(([day, workouts]) => ({ day, workouts }));
}

function planDetail(w: {
  category: string | null;
  isRest: boolean;
  hiitWorkout: {
    type: string;
    movements: { reps: number | null; distance: number | null; weight: number | null; poolExercise: { name: string } | null }[];
  } | null;
  exercises: { tracked: boolean; poolExercise: { name: string } | null }[];
}): string {
  if (w.hiitWorkout) {
    const label = (WORKOUT_TYPE_LABEL as Record<string, string>)[w.hiitWorkout.type] ?? w.hiitWorkout.type;
    if (w.hiitWorkout.movements.length === 0) return label;
    const moves = w.hiitWorkout.movements
      .map((m) => formatHiitMovement({ name: m.poolExercise?.name ?? "—", reps: m.reps, distance: m.distance, weight: m.weight }))
      .join(", ");
    return `${label} · ${moves}`;
  }
  if (w.isRest) return "";
  if (w.exercises.length > 0) {
    return w.exercises
      .map((e) => (e.tracked ? e.poolExercise?.name ?? "—" : `${e.poolExercise?.name ?? "—"} (no log)`))
      .join(" · ");
  }
  if (w.category) {
    const m = defaultMetricFor(w.category as never);
    return `Log ${(METRIC_LABEL_SHORT as Record<string, string>)[m].toLowerCase()} on completion`;
  }
  return "Legacy workout";
}

/** Everything the "Add workout" plan picker needs. */
export type PlanMetric = { key: string; label: string };
export type PlanCategoryOption = {
  key: string;
  label: string;
  kind: string; // "weights" | "hiit" | "metricOnly" | "pool"
  metrics: PlanMetric[];
  defaultMetric: string;
};
export type PlanOptions = {
  categories: PlanCategoryOption[];
  muscleGroups: { key: string; label: string }[];
  /** `metric`: the movement's own "Logs as", null = the category default (v0.609). */
  exercises: { id: string; name: string; category: string; muscleGroup: string | null; metric: string | null }[];
  hiitWorkouts: { id: string; name: string; personal: boolean }[];
};

const PLAN_CAT_ORDER = ["WEIGHTS", "HIIT", "ISOMETRIC", "STRETCHING", "SPORT", "RUNNING", "ROWING", "RUCKING"];

export async function loadPlanOptions(userId: string): Promise<PlanOptions> {
  const categories: PlanCategoryOption[] = PLAN_CAT_ORDER.map((c) => {
    const kind = c === "WEIGHTS" ? "weights"
      : c === "HIIT" ? "hiit"
      : (METRIC_ONLY_CATEGORIES as string[]).includes(c) ? "metricOnly"
      : "pool";
    const choices = metricChoicesFor(c as never) as string[];
    return {
      key: c,
      label: (CATEGORY_LABEL as Record<string, string>)[c] ?? c,
      kind,
      metrics: choices.map((m) => ({ key: m, label: (METRIC_LABEL_SHORT as Record<string, string>)[m] ?? m })),
      defaultMetric: defaultMetricFor(c as never) as string,
    };
  });

  const [exRows, hiit] = await Promise.all([
    prisma.poolExercise.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, category: true, muscleGroup: true, metric: true },
    }),
    loadBrowsableWorkouts(userId),
  ]);

  return {
    categories,
    muscleGroups: (MUSCLE_GROUPS as string[]).map((m) => ({
      key: m,
      label: (MUSCLE_GROUP_LABEL as Record<string, string>)[m] ?? m,
    })),
    exercises: exRows.map((e) => ({
      id: e.id,
      name: e.name,
      category: e.category as string,
      muscleGroup: (e.muscleGroup as string | null) ?? null,
      metric: (e.metric as string | null) ?? null,
    })),
    hiitWorkouts: hiit.map((w) => ({ id: w.id, name: w.name, personal: w.personal })),
  };
}

/** The person's rotation (if any), with a 10-day preview computed here so the
 *  app doesn't reimplement the cycle math. */
export type RotationSlotLite = { id: string; position: number; name: string; label: string; isRest: boolean };
export type RotationPreviewDay = { date: string; label: string; rest: boolean };
export type RotationView = {
  active: boolean;
  anchorISO: string | null;
  restMask: number;
  slots: RotationSlotLite[];
  preview: RotationPreviewDay[];
};

export async function loadRotation(userId: string): Promise<RotationView> {
  const row = await prisma.workoutRotation.findUnique({
    where: { userId },
    select: {
      isActive: true,
      anchorDate: true,
      restMask: true,
      slots: {
        orderBy: { position: "asc" },
        select: { id: true, position: true, name: true, category: true, muscleGroup: true, isRest: true },
      },
    },
  });

  if (!row || !row.isActive) {
    return { active: false, anchorISO: null, restMask: 0, slots: [], preview: [] };
  }

  const anchorISO = fromDateColumn(row.anchorDate);
  const slots: RotationSlotLite[] = row.slots.map((s) => ({
    id: s.id,
    position: s.position,
    name: s.name,
    label: s.isRest
      ? "Rest"
      : s.muscleGroup
        ? (MUSCLE_GROUP_LABEL as Record<string, string>)[s.muscleGroup] ?? s.name
        : s.name,
    isRest: s.isRest,
  }));

  const shape = {
    anchorISO,
    restMask: row.restMask,
    slots: row.slots.map((s) => ({
      position: s.position,
      name: s.name,
      category: s.category as string | null,
      muscleGroup: s.muscleGroup as string | null,
      isRest: s.isRest,
    })),
  };
  const preview: RotationPreviewDay[] = Array.from({ length: 10 }, (_, i) => {
    const iso = addDays(todayISO(), i);
    const r = slotForDate(shape, iso);
    const label =
      r.kind === "workout"
        ? r.slot.muscleGroup
          ? (MUSCLE_GROUP_LABEL as Record<string, string>)[r.slot.muscleGroup] ?? r.slot.name
          : r.slot.name
        : "Rest";
    return { date: iso, label, rest: r.kind !== "workout" };
  });

  return { active: true, anchorISO, restMask: row.restMask, slots, preview };
}

export type OverdueWorkoutDay = {
  date: string;
  workouts: Awaited<ReturnType<typeof loadTodayPlannedWorkouts>>;
};

/** Past days whose "Worked out?" prompt is still pending — the overdue workouts
 *  that piled up — each with that day's scheduled plan, newest-missed last, for
 *  the Overdue section on the log page. */
/** The day a session was actually done. `date` is the day it COUNTS for —
 *  adherence is keyed on it — so an overdue workout logged later carries the
 *  real day here, and charts and history should use this. */

export async function loadOverdueWorkoutDays(
  userId: string,
  beforeISO: string,
): Promise<OverdueWorkoutDay[]> {
  const [tasks, stale] = await Promise.all([
    prisma.task.findMany({
      where: {
        userId,
        category: "EXERCISE",
        generatedFrom: { startsWith: "workout:" },
        // Not just PENDING: a day whose task was completed by *something else*
        // (a sport confirm, an ad-hoc log) can still have an untouched scheduled
        // workout. We decide overdue by whether the scheduled workout itself was
        // logged, below — not by the binary day task.
        status: { in: ["PENDING", "COMPLETE"] },
        dueDate: { lt: toDateColumn(beforeISO) },
      },
      orderBy: { dueDate: "asc" },
      select: { dueDate: true },
    }),
    loadStaleContext(beforeISO),
  ]);
  const seen = new Set<string>();
  const out: OverdueWorkoutDay[] = [];
  for (const t of tasks) {
    const iso = fromDateColumn(t.dueDate);
    // Same rule the dashboard uses: once a missed workout ages past the overdue
    // window it has cleared (its weekday came around again), so drop it.
    if (daysBetween(iso, beforeISO) > stale.workoutOverdueDays) continue;
    if (seen.has(iso)) continue;
    seen.add(iso);
    const workouts = await loadTodayPlannedWorkouts(userId, iso);
    // A scheduled workout is still due if none of its exercises were logged,
    // whatever else happened that day — unless it was skipped through.
    const unlogged = workouts.filter(
      (w) =>
        w.exercises.length > 0 &&
        w.exercises.every((e) => e.value == null) &&
        !planDone(w),
    );
    if (unlogged.length > 0) out.push({ date: iso, workouts: unlogged });
  }
  return out;
}

/** Just the dates of a person's overdue workouts (a scheduled workout whose
 *  exercises weren't logged), newest-missed last. The web has the weekly plan,
 *  so it renders each day's plan itself. */
export async function loadOverdueWorkoutDates(
  userId: string,
  beforeISO: string,
): Promise<string[]> {
  const days = await loadOverdueWorkoutDays(userId, beforeISO);
  return days.map((d) => d.date);
}

// ---------------------------------------------------------------------------
// The day page (web): one movement's sets, the day's state, the week strip.

export type MovementSetRow = {
  weight: number | null;
  reps: number | null;
  seconds: number | null;
};

export type MovementLog = {
  /** The day's sets for this planned movement (or its swap), in order. */
  sets: MovementSetRow[];
  /** When the day's sets were logged with a swap: what was done instead. */
  loggedAs: { poolExerciseId: string; name: string } | null;
  /** The most recent earlier day with sets for the movement being done. */
  last: { date: string; sets: MovementSetRow[] } | null;
  skipped: boolean;
  /** Best weight at each rep count before this day, for the movement being
   *  done (records.ts repRecords); the logger shows a few and marks new bests. */
  records: RepRecord[];
  /** How it felt and anything that hurt, once answered (v0.610). */
  feedback: { effort: string | null; hurt: string | null } | null;
  /** The sets to aim for, when the planned movement has a set scheme (a
   *  program wrote it): these fill the greyed hints in place of last time
   *  (v0.611). Weights can be null: last time's fills those. */
  target: {
    /** "Strength waves · Week 2 of 4", or just the scheme without a program. */
    title: string;
    /** "Work up to a top set", "3 × 8–12". */
    scheme: string;
    sets: { weight: number | null; reps: number; top?: boolean }[];
  } | null;
};

const setRow = (s: { weight: number | null; reps: number | null; seconds: number | null }): MovementSetRow => ({
  weight: s.weight,
  reps: s.reps,
  seconds: s.seconds,
});

/**
 * Everything the set logger needs for one planned movement on a day. `doing`
 * is the movement whose history fills the hints: the planned one, or a swap
 * chosen today; when omitted, a swap already logged for the day is used.
 */
export async function loadMovementLog(
  userId: string,
  dateISO: string,
  slotId: string,
  doing?: string | null,
): Promise<MovementLog> {
  const day = toDateColumn(dateISO);
  const [daySets, skip] = (await Promise.all([
    prisma.sessionSet.findMany({
      where: {
        session: { userId, date: day, isRest: false },
        OR: [{ poolExerciseId: slotId, swappedFromId: null }, { swappedFromId: slotId }],
      },
      orderBy: [{ setNumber: "asc" }, { createdAt: "asc" }],
      select: {
        poolExerciseId: true,
        weight: true,
        reps: true,
        seconds: true,
        poolExercise: { select: { name: true } },
      },
    }),
    prisma.workoutMovementSkip.findFirst({
      where: { userId, date: day, slot: slotId },
      select: { slot: true },
    }),
  ])) as [
    {
      poolExerciseId: string | null;
      weight: number | null;
      reps: number | null;
      seconds: number | null;
      poolExercise: { name: string } | null;
    }[],
    { slot: string } | null,
  ];
  const swapped = daySets.find((s) => s.poolExerciseId && s.poolExerciseId !== slotId);
  const loggedAs = swapped
    ? { poolExerciseId: swapped.poolExerciseId as string, name: swapped.poolExercise?.name ?? "" }
    : null;
  const movement = doing || loggedAs?.poolExerciseId || slotId;

  const prior = (await prisma.sessionSet.findFirst({
    where: { poolExerciseId: movement, session: { userId, isRest: false, date: { lt: day } } },
    orderBy: { session: { date: "desc" } },
    select: { session: { select: { date: true } } },
  })) as { session: { date: Date } } | null;
  let last: MovementLog["last"] = null;
  if (prior) {
    const rows = (await prisma.sessionSet.findMany({
      where: { poolExerciseId: movement, session: { userId, isRest: false, date: prior.session.date } },
      orderBy: [{ setNumber: "asc" }, { createdAt: "asc" }],
      select: { weight: true, reps: true, seconds: true },
    })) as { weight: number | null; reps: number | null; seconds: number | null }[];
    last = { date: fromDateColumn(prior.session.date), sets: rows.map(setRow) };
  }
  const [earlier, fb] = (await Promise.all([
    prisma.sessionSet.findMany({
      where: {
        poolExerciseId: movement,
        weight: { gt: 0 },
        reps: { gt: 0 },
        session: { userId, isRest: false, date: { lt: day } },
      },
      select: { weight: true, reps: true, session: { select: { date: true } } },
    }),
    prisma.workoutFeedback.findUnique({
      where: { userId_date_slot: { userId, date: day, slot: slotId } },
      select: { effort: true, hurt: true },
    }),
  ])) as [
    { weight: number | null; reps: number | null; session: { date: Date } }[],
    { effort: string | null; hurt: string | null } | null,
  ];
  const records = repRecords(
    earlier.map((s) => ({ weight: s.weight, reps: s.reps, date: fromDateColumn(s.session.date) })),
  );
  const target = await movementTarget(userId, dateISO, slotId, movement, last?.sets ?? [], records);
  return {
    sets: daySets.map(setRow),
    loggedAs,
    last,
    skipped: !!skip,
    records,
    feedback: fb ? { effort: fb.effort, hurt: fb.hurt } : null,
    target,
  };
}

/** A planned movement's targets for a day, from its set scheme and the
 *  person's program (v0.611). Null when the movement has no scheme. */
async function movementTarget(
  userId: string,
  dateISO: string,
  slotId: string,
  movement: string,
  lastSets: MovementSetRow[],
  records: RepRecord[],
): Promise<MovementLog["target"]> {
  const planned = await plannedSlotFor(userId, dateISO, slotId);
  const scheme = parseScheme(planned?.scheme);
  if (!planned || !scheme) return null;
  const active = await loadActiveProgram(userId);
  const fromProgram = active && planned.programRole ? active : null;
  const program: Program = fromProgram?.program ?? { ...FREE_PROGRAM };
  const week = fromProgram ? programWeek(program, fromProgram.blockStartedOn, dateISO) : 1;
  const role = program.days.flatMap((d) => d.roles).find((r) => r.key === planned.programRole);
  const units = await loadWeightUnits();
  const unit = units[(planned.muscleGroup ?? "CHEST") as MuscleGroup] ?? "lb";
  const bestForThree = records.filter((r) => r.reps >= 3).reduce((m, r) => Math.max(m, r.weight), 0) || null;
  const sets = targetsFor({
    program,
    week,
    scheme,
    unit,
    lower: role?.lower,
    // A swap keeps the scheme but not the planned lift's training max.
    trainingMax: movement === slotId ? (fromProgram?.trainingMaxes[slotId] ?? null) : null,
    last: lastSets.map((s) => ({ weight: s.weight, reps: s.reps })),
    bestForThree,
  });
  if (sets.length === 0) return null;
  const intent = weekIntent(program, week);
  return {
    title: fromProgram ? `${program.name} · ${weekLabel(program, week)}` : "",
    scheme: intent === "TEST" ? "Work up to a heavy 3" : schemeLabel(scheme),
    sets,
  };
}

/** Targets for a scheme outside any program: one week, no light or test weeks. */
const FREE_PROGRAM: Program = {
  key: "",
  name: "",
  blurb: "",
  weeks: 1,
  lightWeeks: [],
  testWeeks: [],
  defaultDays: [],
  days: [],
};

export type DayMovementState = {
  /** The day's sets in a few words ("5 sets · top 185 × 1"); empty when none. */
  summary: string;
  setCount: number;
  skipped: boolean;
  /** Swapped for the day: the movement done instead. */
  loggedAs: string | null;
  /** The last earlier day's sets in a few words, for a movement not done yet. */
  last: string;
};

export type DayLogState = {
  /** Keyed by planned movement (pool exercise id). */
  movements: Record<string, DayMovementState>;
  /** Planned workouts done for the day (planDone), by planned workout id. */
  doneWorkouts: string[];
  /** Workout-level skips ("plan:<id>"). */
  skippedPlans: string[];
  /** Names of the day's sessions, for plans that log with no movement. */
  sessionNames: string[];
  rested: boolean;
  /** The person's program and its week on this day, if one is running (v0.611). */
  program: ProgramInfo | null;
};

/** The day page's state for a person and date, read in a handful of queries. */
export async function loadDayLogState(
  userId: string,
  dateISO: string,
  /** The day's plans when the caller already has them (the phone's day read). */
  plannedIn?: NonNullable<TodayPlanned>[],
): Promise<DayLogState> {
  const day = toDateColumn(dateISO);
  const [planned, sets, skips, sessions] = (await Promise.all([
    plannedIn ?? loadTodayPlannedWorkouts(userId, dateISO),
    prisma.sessionSet.findMany({
      where: { session: { userId, date: day, isRest: false }, poolExerciseId: { not: null } },
      orderBy: [{ setNumber: "asc" }, { createdAt: "asc" }],
      select: {
        poolExerciseId: true,
        swappedFromId: true,
        weight: true,
        reps: true,
        seconds: true,
        unit: true,
        poolExercise: { select: { name: true } },
      },
    }),
    prisma.workoutMovementSkip.findMany({ where: { userId, date: day }, select: { slot: true } }),
    prisma.workoutSession.findMany({ where: { userId, date: day }, select: { name: true, isRest: true } }),
  ])) as [
    NonNullable<TodayPlanned>[],
    {
      poolExerciseId: string | null;
      swappedFromId: string | null;
      weight: number | null;
      reps: number | null;
      seconds: number | null;
      unit: string | null;
      poolExercise: { name: string } | null;
    }[],
    { slot: string }[],
    { name: string | null; isRest: boolean }[],
  ];
  const skipped = new Set(skips.map((s) => s.slot));
  const bySlot = new Map<string, typeof sets>();
  for (const s of sets) {
    const slot = (s.swappedFromId ?? s.poolExerciseId) as string;
    const list = bySlot.get(slot) ?? [];
    list.push(s);
    bySlot.set(slot, list);
  }

  const slots = [...new Set(planned.flatMap((p) => p.exercises.map((e) => e.poolExerciseId)).filter(Boolean))];
  // Last time for each planned movement: its sets on the most recent earlier
  // day. One read over the person's history of these movements.
  const history = (slots.length
    ? await prisma.sessionSet.findMany({
        where: {
          poolExerciseId: { in: slots },
          session: { userId, isRest: false, date: { lt: day } },
        },
        orderBy: [{ setNumber: "asc" }, { createdAt: "asc" }],
        select: {
          poolExerciseId: true,
          weight: true,
          reps: true,
          seconds: true,
          unit: true,
          session: { select: { date: true } },
        },
      })
    : []) as {
    poolExerciseId: string | null;
    weight: number | null;
    reps: number | null;
    seconds: number | null;
    unit: string | null;
    session: { date: Date };
  }[];
  const lastBy = new Map<string, { date: number; rows: typeof history }>();
  for (const h of history) {
    const id = h.poolExerciseId as string;
    const t = h.session.date.getTime();
    const cur = lastBy.get(id);
    if (!cur || t > cur.date) lastBy.set(id, { date: t, rows: [h] });
    else if (t === cur.date) cur.rows.push(h);
  }

  const movements: Record<string, DayMovementState> = {};
  for (const slot of slots) {
    const today = bySlot.get(slot) ?? [];
    const swap = today.find((s) => s.poolExerciseId !== slot);
    const prev = lastBy.get(slot);
    movements[slot] = {
      summary: setsSummary(today, today[0]?.unit ?? null),
      setCount: today.length,
      skipped: skipped.has(slot),
      loggedAs: swap?.poolExercise?.name ?? null,
      last: prev ? setsSummary(prev.rows, prev.rows[0]?.unit ?? null) : "",
    };
  }

  return {
    movements,
    doneWorkouts: planned.filter((p) => planDone(p)).map((p) => p.plannedWorkoutId),
    skippedPlans: [...skipped].filter((s) => s.startsWith("plan:")),
    sessionNames: sessions.filter((s) => !s.isRest && s.name).map((s) => s.name as string),
    rested: sessions.some((s) => s.isRest),
    program: await programInfoFor(userId, dateISO),
  };
}

export type WeekStripDay = {
  date: string;
  task: "PENDING" | "COMPLETE" | "SKIPPED" | null;
  rested: boolean;
  logged: boolean;
};

/** The last `days` days up to today, for the day page's week strip. */
export async function loadWeekStrip(
  userId: string,
  today: string,
  days = 8,
): Promise<{ days: WeekStripDay[]; overdue: string[] }> {
  const from = addDays(today, -(days - 1));
  const [tasks, sessions, overdue] = (await Promise.all([
    prisma.task.findMany({
      where: {
        userId,
        category: "EXERCISE",
        dueDate: { gte: toDateColumn(from), lte: toDateColumn(today) },
      },
      select: { dueDate: true, status: true },
    }),
    prisma.workoutSession.findMany({
      where: { userId, date: { gte: toDateColumn(from), lte: toDateColumn(today) } },
      select: { date: true, isRest: true },
    }),
    loadOverdueWorkoutDates(userId, today),
  ])) as [
    { dueDate: Date; status: string }[],
    { date: Date; isRest: boolean }[],
    string[],
  ];
  const taskBy = new Map(tasks.map((t) => [fromDateColumn(t.dueDate), t.status]));
  const out: WeekStripDay[] = [];
  for (let i = 0; i < days; i++) {
    const date = addDays(from, i);
    const own = sessions.filter((s) => fromDateColumn(s.date) === date);
    const status = taskBy.get(date);
    out.push({
      date,
      task: status === "PENDING" || status === "COMPLETE" || status === "SKIPPED" ? status : null,
      rested: own.some((s) => s.isRest),
      logged: own.some((s) => !s.isRest),
    });
  }
  return { days: out, overdue };
}

export type TrainingWeek = {
  /** Sunday the week starts on. */
  start: string;
  /** Days with something logged (not rest). */
  days: number;
  sets: number;
  /** Minutes where recorded: a session's duration, or timed sets. */
  minutes: number;
  /** Every workout due was done or excused (weeksInARow's rule). */
  trained: boolean;
};

/**
 * The last `weeks` weeks of training, oldest first, and the weeks trained in a
 * row (v0.610). Consistency, not weight: a light week or a week of skips for
 * an injury still counts.
 */
export async function loadWeeklyTraining(
  userId: string,
  today: string,
  weeks = 12,
): Promise<{ weeks: TrainingWeek[]; inARow: number }> {
  const thisWeek = startOfWeek(today);
  const from = addDays(thisWeek, -7 * (weeks - 1));
  // The run can be longer than the chart: look back a year for it.
  const runFrom = addDays(thisWeek, -7 * 51);
  const [tasks, sessions] = (await Promise.all([
    prisma.task.findMany({
      where: {
        userId,
        category: "EXERCISE",
        dueDate: { gte: toDateColumn(runFrom), lte: toDateColumn(today) },
      },
      select: { dueDate: true, status: true },
    }),
    prisma.workoutSession.findMany({
      where: { userId, isRest: false, date: { gte: toDateColumn(runFrom), lte: toDateColumn(today) } },
      select: {
        date: true,
        durationMin: true,
        sets: { select: { seconds: true } },
      },
    }),
  ])) as [
    { dueDate: Date; status: string }[],
    { date: Date; durationMin: number | null; sets: { seconds: number | null }[] }[],
  ];

  type Acc = { days: Set<string>; sets: number; minutes: number; due: number; open: number };
  const acc = new Map<string, Acc>();
  const get = (start: string) => {
    let a = acc.get(start);
    if (!a) {
      a = { days: new Set(), sets: 0, minutes: 0, due: 0, open: 0 };
      acc.set(start, a);
    }
    return a;
  };
  for (const t of tasks) {
    const d = fromDateColumn(t.dueDate);
    const a = get(startOfWeek(d));
    a.due++;
    // Today's workout can still be done; only an earlier one left pending counts.
    if (t.status === "PENDING" && d < today) a.open++;
  }
  for (const s of sessions) {
    // Counted on the day it counts for, like the task it settles.
    const d = fromDateColumn(s.date);
    const a = get(startOfWeek(d));
    a.days.add(d);
    a.sets += s.sets.length;
    const timed = s.sets.reduce((n, x) => n + (x.seconds ?? 0), 0) / 60;
    a.minutes += s.durationMin ?? Math.round(timed);
  }

  const run: { start: string; due: number; open: number; logged: boolean; current: boolean }[] = [];
  for (let start = thisWeek; start >= runFrom; start = addDays(start, -7)) {
    const a = acc.get(start);
    run.push({
      start,
      due: a?.due ?? 0,
      open: a?.open ?? 0,
      logged: (a?.days.size ?? 0) > 0,
      current: start === thisWeek,
    });
  }
  const inARow = weeksInARow(run);

  const out: TrainingWeek[] = [];
  for (let i = 0; i < weeks; i++) {
    const start = addDays(from, 7 * i);
    const a = acc.get(start);
    const due = a?.due ?? 0;
    const open = a?.open ?? 0;
    const logged = (a?.days.size ?? 0) > 0;
    out.push({
      start,
      days: a?.days.size ?? 0,
      sets: a?.sets ?? 0,
      minutes: Math.round(a?.minutes ?? 0),
      trained: open === 0 && (due > 0 || logged),
    });
  }
  return { weeks: out, inARow };
}
