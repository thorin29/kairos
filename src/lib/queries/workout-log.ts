import "server-only";
import { prisma } from "@/lib/prisma";
import { slotForDate } from "@/lib/workouts/rotation";
import { formatHiitMovement, WORKOUT_TYPE_LABEL, METRIC_LABEL_SHORT, defaultMetricFor, metricChoicesFor, MUSCLE_GROUPS, MUSCLE_GROUP_LABEL, CATEGORY_LABEL, METRIC_ONLY_CATEGORIES, hiitResult } from "@/lib/workouts/catalog";
import type { WorkoutType } from "@/generated/prisma/client";
import { addDays, todayISO, dayOfWeek, fromDateColumn, toDateColumn, daysBetween } from "@/lib/dates";
import { metricUnit, type Metric, type MuscleGroup } from "@/lib/workouts/catalog";
import { loadWorkoutUnitSystem } from "@/lib/queries/workouts";
import { doneOn, loadMovementStats, type MovementStats } from "@/lib/queries/movement-stats";
import { loadStaleContext } from "@/lib/chores/stale";
import { groupsFor, navRegionFor } from "@/lib/workouts/involvement";

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
};


export type TodayPlanned = {
  plannedWorkoutId: string;
  name: string;
  /** Used to group same-muscle plans onto one card (Chest + Chest together). */
  muscleGroup: string | null;
  exercises: PlannedMovement[];
} | null;

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

/** All of a person's planned workouts for the day (a day can have several, e.g.
 *  Core AND Arms). Same per-plan shape as loadTodayPlannedWorkout, but every
 *  non-empty plan is returned so the card/logger can show them all. */
export async function loadTodayPlannedWorkouts(
  userId: string,
  dayISO: string,
): Promise<NonNullable<TodayPlanned>[]> {
  const dow = dayOfWeek(dayISO);
  const system = await loadWorkoutUnitSystem();

  const plans = await prisma.plannedWorkout.findMany({
    // Only workouts that existed on this day count for it, so a plan built later
    // never makes a past day look "overdue" (it was scheduled under a different,
    // already-logged plan). Mirrors the generator's trainsSince clamp.
    where: {
      userId,
      dayOfWeek: dow,
      isRest: false,
      createdAt: { lt: toDateColumn(addDays(dayISO, 1)) },
    },
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
      exercises: [{ poolExerciseId: "", name: res.label, metric: res.metric, unit, value }],
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
    const loggedBySlot = new Map<string, SlotLog>(
      sets
        .filter((s) => s.poolExerciseId)
        .map((s) => [
          (s.swappedFromId ?? s.poolExerciseId) as string,
          s as unknown as SlotLog,
        ]),
    );
    const exercises: PlannedMovement[] = plan.exercises.map((pe) => {
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
      };
    });
    out.push({
      plannedWorkoutId: plan.id,
      name: plan.name,
      muscleGroup: (plan as { muscleGroup?: string | null }).muscleGroup ?? null,
      exercises,
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
export type GraphPoint = { date: string; value: number; reps?: number | null };
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
      session: { select: { date: true, completedOn: true } },
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
  // movement -> reps -> heaviest weight actually lifted at that rep count
  const repMaxes = new Map<string, Map<number, { value: number; date: string }>>();
  for (const s of wSets) {
    if (s.weight == null || !s.poolExerciseId) continue;
    const d = doneOn(s.session);
    const m = perDay.get(s.poolExerciseId) ?? new Map<string, { value: number; reps: number | null }>();
    const prev = m.get(d);
    // Heaviest wins the day; on a tie the set with more reps is the better one.
    if (!prev || s.weight > prev.value || (s.weight === prev.value && (s.reps ?? 0) > (prev.reps ?? 0))) {
      m.set(d, { value: s.weight, reps: s.reps });
    }
    perDay.set(s.poolExerciseId, m);
    if (s.reps != null && s.reps > 0) {
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
        .map(([date, p]) => ({ date, value: p.value, reps: p.reps }))
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
      return "rep";
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
  exercises: { id: string; name: string; category: string; muscleGroup: string | null }[];
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
      select: { id: true, name: true, category: true, muscleGroup: true },
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
    // whatever else happened that day.
    const unlogged = workouts.filter(
      (w) => w.exercises.length > 0 && w.exercises.every((e) => e.value == null),
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
