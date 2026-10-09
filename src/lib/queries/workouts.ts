import "server-only";
import { prisma } from "@/lib/prisma";
import { dayOfWeek, fromDateColumn, toDateColumn } from "@/lib/dates";
import { getSetting } from "@/lib/settings";
import { loadMovementStats, type MovementStats } from "@/lib/queries/movement-stats";
import {
  CATEGORY_LABEL,
  LINE_COLORS,
  MUSCLE_GROUPS,
  UNIT_SYSTEM_KEY,
  DEFAULT_WEIGHT_UNIT,
  WORKOUT_TYPE_LABEL,
  defaultMetricFor,
  metricUnit,
  weightUnitKey,
  type Implement,
  type Metric,
  type MuscleGroup,
  type UnitSystem,
  type WeightUnit,
  type WorkoutCategory,
  type WorkoutType,
} from "@/lib/workouts/catalog";

export type GraphSeries = {
  exerciseId: string;
  name: string;
  /** For stacking one progress block per muscle group. */
  muscleGroup?: MuscleGroup | null;
  unit: string;
  color: string;
  /** value = the day's heaviest weight (the record). reps = how many that set
   *  was, when it was logged — never part of the record, only context. */
  points: { date: string; value: number; reps?: number | null }[];
  /** The heaviest set ever logged for this movement. */
  best?: { value: number; reps: number | null; date: string } | null;
  /** Best weight actually lifted at each rep count — real lifts, no estimates.
   *  Only rep counts that have been logged appear. */
  repMaxes?: { reps: number; value: number; date: string }[];
};

export type ExerciseDef = {
  id: string;
  name: string;
  category: WorkoutCategory;
  implement: Implement | null;
  unit: string;
  metric: Metric;
  tracked: boolean;
  weekdays: number[];
  paused: boolean;
  endDate: string | null;
};

export type TodayExercise = {
  exerciseId: string;
  name: string;
  unit: string;
  metric: Metric;
  logged: { weight: number | null; reps: number | null } | null;
};

export type Reminder = { kind: "paused" | "ending" | "ended"; text: string };

export type TodayWorkout = {
  id: string;
  label: string;
  result: string;
};

export type HistoryEntry = {
  id: string;
  dateISO: string;
  label: string;
  result: string;
  isRest: boolean;
};

export type PlanExercise = {
  id: string;
  poolExerciseId: string;
  name: string;
  muscleGroup: MuscleGroup | null;
  tracked: boolean;
  metric: Metric | null;
  unit: string;
  /** Record / best reps / last, for the summary under the entry fields. Shared
   *  with the phone's plan query so both report the same record. */
  stats?: MovementStats | null;
};

export type PlanWorkout = {
  id: string;
  name: string;
  category: WorkoutCategory | null;
  muscleGroup: MuscleGroup | null;
  isRest: boolean;
  hiit: {
    id: string;
    type: WorkoutType;
    movements: {
      name: string;
      reps: number | null;
      distance: number | null;
      weight: number | null;
    }[];
  } | null;
  exercises: PlanExercise[];
};

export type PlanDay = { day: number; workouts: PlanWorkout[] };

export type PersonWorkout = {
  user: { id: string; name: string; color: string; avatarPath: string | null; avatarPosition: string | null };
  categories: WorkoutCategory[];
  exercises: ExerciseDef[];
  weightSeries: GraphSeries[];
  /** Every tracked movement, not just today's. What the body map navigates. */
  trackedSeries: GraphSeries[];
  /** Weekdays (0 = Sunday) the plan uses, with the muscle groups on each, so
   *  the attendance grid only draws rows that mean something. */
  planDays: { day: number; groups: string[] }[];
  today: {
    scheduled: TodayExercise[];
    workedOut: boolean;
    rested: boolean;
    paused: string | null;
  };
  todayWorkouts: TodayWorkout[];
  history: HistoryEntry[];
  plan: PlanDay[];
  rotation: RotationData | null;
  /** Optional future date the weekly plan begins on; "" = active now. */
  weeklyStart: string;
  /** Whether the weekly plan is active (false = paused, can run alongside a rotation). */
  weeklyActive: boolean;
  todayPlanned: { id: string; name: string }[];
  reminders: Reminder[];
};

export type WorkoutsBoard = {
  people: PersonWorkout[];
  unitSystem: UnitSystem;
};

/**
 * The top named workout on each weekday for one person, so a workout prompt on
 * the dashboard can read "Leg day" instead of a bare "Workout". Keyed by
 * weekday (0 = Sunday) and taken from the plan at read time, so it names the
 * carried-over prompts already sitting there and follows any plan edit without
 * a rewrite. "Top" is the first non-rest workout of the day by sort order.
 * Days with only a legacy per-exercise schedule (no named plan) are absent, and
 * the caller keeps the plain "Workout" label for those.
 */
export async function loadWorkoutPlanNames(
  userId: string,
): Promise<Map<number, string>> {
  const planned = await prisma.plannedWorkout.findMany({
    where: { userId, isRest: false },
    orderBy: [{ dayOfWeek: "asc" }, { sortOrder: "asc" }],
    select: { dayOfWeek: true, name: true },
  });

  // Join every named planned workout for the day (in order) so a Legs + Chest
  // day reads "Legs · Chest" rather than just the first block.
  // Each name once per day: two chest plans on a Monday are two rows here but
  // one muscle group to the reader, and "Chest \u00b7 Chest \u00b7 Legs" said nothing
  // the single "Chest" did not.
  const byDay = new Map<number, string[]>();
  for (const p of planned) {
    const name = p.name.trim();
    if (!name) continue;
    const list = byDay.get(p.dayOfWeek) ?? [];
    if (list.some((n) => n.toLowerCase() === name.toLowerCase())) continue;
    list.push(name);
    byDay.set(p.dayOfWeek, list);
  }
  const out = new Map<number, string>();
  for (const [day, names] of byDay) out.set(day, names.join(" \u00b7 "));
  return out;
}

export async function loadWorkoutsBoard(todayISO: string): Promise<WorkoutsBoard> {
  const dow = dayOfWeek(todayISO);
  const today = toDateColumn(todayISO);

  // A household pause (vacation) covering today pauses everyone's workout for
  // the day: the plan prompt steps aside and a note takes its place, but the
  // "log something else" path stays open so a session can still be recorded.
  const activePause = await prisma.pause.findFirst({
    where: { startDate: { lte: today }, endDate: { gte: today } },
    orderBy: { startDate: "asc" },
    select: { name: true },
  });
  const pausedName = activePause?.name ?? null;

  const [people, unitRaw, weightUnits] = await Promise.all([
    prisma.user.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, displayName: true, color: true, avatarPath: true, avatarPosition: true },
    }),
    getSetting(UNIT_SYSTEM_KEY),
    loadWeightUnits(),
  ]);

  const cards: PersonWorkout[] = [];

  for (const person of people) {
    const [exercises, schedules, weightSets, task, todaySessions, plannedRows, recentSessions, rotationRow] =
      await Promise.all([
      prisma.exercise.findMany({
        where: { userId: person.id, isActive: true },
        orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
      }),
      prisma.workoutSchedule.findMany({
        where: { userId: person.id },
        select: { exerciseId: true, dayOfWeek: true, isPaused: true, endDate: true },
      }),
      prisma.sessionSet.findMany({
        where: {
          weight: { not: null },
          poolExerciseId: { not: null },
          session: { userId: person.id },
          poolExercise: { category: "WEIGHTS" },
        },
        select: {
          poolExerciseId: true,
          weight: true,
          reps: true,
          session: { select: { date: true, completedOn: true } },
          poolExercise: { select: { name: true, muscleGroup: true } },
        },
      }),
      prisma.task.findFirst({
        where: { userId: person.id, category: "EXERCISE", dueDate: today },
        select: { status: true },
      }),
      prisma.workoutSession.findMany({
        where: { userId: person.id, date: today },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          name: true,
          category: true,
          workoutType: true,
          isRest: true,
          sets: {
            select: {
              exerciseId: true,
              weight: true,
              reps: true,
              distance: true,
              meters: true,
              seconds: true,
              unit: true,
              exercise: { select: { name: true } },
            },
          },
        },
      }),
      prisma.plannedWorkout.findMany({
        where: { userId: person.id },
        orderBy: [{ dayOfWeek: "asc" }, { sortOrder: "asc" }],
        select: {
          id: true,
          dayOfWeek: true,
          name: true,
          category: true,
          muscleGroup: true,
          isRest: true,
          hiitWorkoutId: true,
          hiitWorkout: {
            select: {
              type: true,
              movements: {
                orderBy: { position: "asc" },
                select: { reps: true, distance: true, weight: true, poolExercise: { select: { name: true } } },
              },
            },
          },
          exercises: {
            orderBy: { sortOrder: "asc" },
            select: {
              id: true,
              poolExerciseId: true,
              tracked: true,
              metric: true,
              poolExercise: { select: { name: true, muscleGroup: true } },
            },
          },
        },
      }),
      prisma.workoutSession.findMany({
        // `lt: today` meant a session logged today could never appear in Recent
        // workouts — the web showed yesterday onwards while the phone, which
        // reads a different query, showed the same day correctly.
        where: { userId: person.id, date: { lte: today } },
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        take: 30,
        select: {
          id: true,
          name: true,
          category: true,
          workoutType: true,
          isRest: true,
          date: true,
          completedOn: true,
          sets: {
            select: {
              exerciseId: true,
              weight: true,
              reps: true,
              distance: true,
              meters: true,
              seconds: true,
              unit: true,
              exercise: { select: { name: true } },
            },
          },
        },
      }),
      prisma.workoutRotation.findUnique({
        where: { userId: person.id },
        select: {
          anchorDate: true,
          restMask: true,
          isActive: true,
          slots: {
            orderBy: { position: "asc" },
            select: {
              id: true,
              position: true,
              name: true,
              category: true,
              muscleGroup: true,
              isRest: true,
            },
          },
        },
      }),
    ]);

    const rotRow = rotationRow as unknown as {
      anchorDate: Date;
      restMask: number;
      isActive: boolean;
      slots: {
        id: string;
        position: number;
        name: string;
        category: string | null;
        muscleGroup: string | null;
        isRest: boolean;
      }[];
    } | null;
    const rotation: RotationData | null =
      rotRow && rotRow.isActive
        ? {
            anchorISO: fromDateColumn(rotRow.anchorDate),
            restMask: rotRow.restMask,
            slots: rotRow.slots.map((s) => ({
              id: s.id,
              position: s.position,
              name: s.name,
              category: s.category as WorkoutCategory | null,
              muscleGroup: s.muscleGroup as MuscleGroup | null,
              isRest: s.isRest,
            })),
          }
        : null;

    const exRows = exercises as unknown as {
      id: string; name: string; unit: string; implement: string | null;
      category: string; metric: string; tracked: boolean;
    }[];
    const wSets = weightSets as unknown as {
      poolExerciseId: string;
      weight: number | null;
      reps: number | null;
      session: { date: Date };
      poolExercise: { name: string; muscleGroup: MuscleGroup | null } | null;
    }[];
    const sessions = (todaySessions ?? []) as unknown as SessShape[];
    // Prefill for the scheduled-lift prompt: what's already logged today for
    // each exercise, gathered across every session on the day.
    const tSets = sessions.flatMap((s) => s.sets);

    // schedule lookup per exercise
    const schedByExercise = new Map<string, { days: number[]; paused: boolean; endDate: string | null }>();
    for (const s of schedules) {
      const entry = schedByExercise.get(s.exerciseId) ?? { days: [], paused: false, endDate: null };
      entry.days.push(s.dayOfWeek);
      entry.paused = entry.paused || s.isPaused;
      entry.endDate = s.endDate ? fromDateColumn(s.endDate) : entry.endDate;
      schedByExercise.set(s.exerciseId, entry);
    }

    const defs: ExerciseDef[] = exRows.map((e) => {
      const sched = schedByExercise.get(e.id);
      return {
        id: e.id,
        name: e.name,
        category: e.category as WorkoutCategory,
        implement: (e.implement as Implement) ?? null,
        unit: e.unit,
        metric: e.metric as Metric,
        tracked: e.tracked,
        weekdays: sched?.days.sort((a, b) => a - b) ?? [],
        paused: sched?.paused ?? false,
        endDate: sched?.endDate ?? null,
      };
    });

    const categories = [...new Set(defs.map((d) => d.category))];

    // Per-person progress: max weight per pool movement per day. Scoped to
    // today's planned movements when there's a plan (so the card shows where
    // you're at for today's lifts); otherwise every movement they've logged.
    const movMeta = new Map<string, { name: string; muscleGroup: MuscleGroup | null }>();
    const perMovementDay = new Map<string, Map<string, { value: number; reps: number | null }>>();
    // movementId -> reps -> best weight at that rep count
    const repMaxes = new Map<string, Map<number, { value: number; date: string }>>();
    for (const set of wSets) {
      if (set.weight == null || !set.poolExercise) continue;
      const id = set.poolExerciseId;
      if (!movMeta.has(id)) {
        movMeta.set(id, {
          name: set.poolExercise.name,
          muscleGroup: set.poolExercise.muscleGroup,
        });
      }
      // The day it was actually done. An overdue workout keeps `date` as the
      // day it counts for; the chart should mark the day you trained.
      const d = fromDateColumn(
        (set.session as { completedOn?: Date | null }).completedOn ?? set.session.date,
      );
      const m = perMovementDay.get(id) ?? new Map<string, { value: number; reps: number | null }>();
      const prev = m.get(d);
      // Heaviest wins the day; on equal weight the one with more reps wins,
      // because that is the better set.
      if (!prev || set.weight > prev.value || (set.weight === prev.value && (set.reps ?? 0) > (prev.reps ?? 0))) {
        m.set(d, { value: set.weight, reps: set.reps });
      }
      perMovementDay.set(id, m);

      // Best weight at each rep count, from real logged sets only.
      if (set.reps != null && set.reps > 0) {
        const rm = repMaxes.get(id) ?? new Map<number, { value: number; date: string }>();
        const cur = rm.get(set.reps);
        if (!cur || set.weight > cur.value) rm.set(set.reps, { value: set.weight, date: d });
        repMaxes.set(id, rm);
      }
    }

    const allSeries: GraphSeries[] = [...movMeta.entries()]
      .sort((a, b) => a[1].name.localeCompare(b[1].name))
      .map(([id, meta], i) => ({
        exerciseId: id, // pool movement id — the legend/series key
        name: meta.name,
        muscleGroup: meta.muscleGroup ?? null,
        unit: meta.muscleGroup ? weightUnits[meta.muscleGroup] : "",
        color: LINE_COLORS[i % LINE_COLORS.length],
        points: [...perMovementDay.get(id)!.entries()]
          .map(([date, p]) => ({ date, value: p.value, reps: p.reps }))
          .sort((a, b) => (a.date < b.date ? -1 : 1)),
        best: [...perMovementDay.get(id)!.entries()]
          .map(([date, p]) => ({ date, value: p.value, reps: p.reps }))
          .sort((a, b) => b.value - a.value || (b.reps ?? 0) - (a.reps ?? 0))[0] ?? null,
        repMaxes: [...(repMaxes.get(id)?.entries() ?? [])]
          .map(([reps, r]) => ({ reps, value: r.value, date: r.date }))
          .sort((a, b) => a.reps - b.reps),
      }))
      .filter((s) => s.points.length > 0);

    const todayPoolIds = new Set<string>();
    // Graphable universe = movements a plan marks TRACKED, matching the phone,
    // which has always graphed tracked movements only. Without this the web also
    // charted anything ever logged (an extra/custom workout), so the same person
    // saw different lifts on the two clients.
    const trackedPoolIds = new Set<string>();
    for (const w of plannedRows as unknown as {
      dayOfWeek: number;
      exercises: { poolExerciseId: string; tracked: boolean }[];
    }[]) {
      for (const e of w.exercises) {
        if (e.tracked) trackedPoolIds.add(e.poolExerciseId);
      }
      if (w.dayOfWeek === dow) {
        for (const e of w.exercises) todayPoolIds.add(e.poolExerciseId);
      }
    }

    // Everything the person tracks, whatever day it belongs to. The body map
    // navigates by muscle, not by date, so narrowing this to today would make
    // every other region unreachable — not merely unselected, but absent from
    // the payload and therefore dead on the page.
    const trackedSeries: GraphSeries[] =
      trackedPoolIds.size > 0
        ? allSeries.filter((s) => trackedPoolIds.has(s.exerciseId))
        : allSeries;

    // Today's slice, kept for the places that really do mean "today".
    let weightSeries = trackedSeries;
    if (todayPoolIds.size > 0) {
      const scoped = trackedSeries.filter((s) => todayPoolIds.has(s.exerciseId));
      if (scoped.length > 0) weightSeries = scoped;
    }

    // Today's prompt
    const loggedByExercise = new Map(
      tSets.map((s) => [s.exerciseId, s]),
    );
    const scheduled: TodayExercise[] = defs
      .filter((d) => {
        const sched = schedByExercise.get(d.id);
        return sched && !sched.paused && sched.days.includes(dow) &&
          (!sched.endDate || sched.endDate >= todayISO);
      })
      .map((d) => {
        const logged = loggedByExercise.get(d.id);
        return {
          exerciseId: d.id,
          name: d.name,
          unit: d.unit,
          metric: d.metric,
          logged: logged
            ? { weight: logged.weight ?? null, reps: logged.reps ?? null }
            : null,
        };
      });

    const hasRealWorkout = sessions.some(
      (s) => !s.isRest && (s.sets.length > 0 || (s.name?.trim().length ?? 0) > 0),
    );
    const rested = sessions.some((s) => s.isRest) && !hasRealWorkout;
    const workedOut = task?.status === "COMPLETE" && !rested;

    const todayWorkouts: TodayWorkout[] = sessions
      .filter((s) => !s.isRest && (s.sets.length > 0 || (s.name?.trim().length ?? 0) > 0))
      .map((s) => ({ id: s.id, label: workoutLabel(s), result: workoutResult(s) }));

    const recent = (recentSessions ?? []) as unknown as (SessShape & { date: Date })[];
    const history: HistoryEntry[] = recent.map((s) => ({
      id: s.id,
      dateISO: fromDateColumn(
        (s as { completedOn?: Date | null }).completedOn ?? s.date,
      ),
      label: s.isRest ? "Rest day" : workoutLabel(s),
      result: s.isRest ? "" : workoutResult(s),
      isRest: s.isRest,
    }));

    // Reminders
    const reminders: Reminder[] = [];
    if (pausedName) {
      reminders.push({
        kind: "paused",
        text: `Workouts are paused for ${pausedName}. Log anything you do to keep track.`,
      });
    }
    for (const d of defs) {
      if (d.paused) {
        reminders.push({ kind: "paused", text: `${d.name} is paused — resume when you're back to it.` });
      } else if (d.endDate) {
        if (d.endDate < todayISO) {
          reminders.push({ kind: "ended", text: `${d.name} has ended — set up a new plan when ready.` });
        } else {
          const days = Math.round(
            (Date.parse(`${d.endDate}T00:00:00Z`) - Date.parse(`${todayISO}T00:00:00Z`)) / 86_400_000,
          );
          if (days <= 14) {
            reminders.push({
              kind: "ending",
              text: `${d.name} ends in ${days} day${days === 1 ? "" : "s"} — extend it or plan what's next.`,
            });
          }
        }
      }
    }

    const pRows = plannedRows as unknown as {
      id: string;
      dayOfWeek: number;
      name: string;
      category: WorkoutCategory | null;
      muscleGroup: MuscleGroup | null;
      isRest: boolean;
      hiitWorkoutId: string | null;
      hiitWorkout: {
        type: WorkoutType;
        movements: {
        reps: number | null;
        distance: number | null;
        weight: number | null;
        poolExercise: { name: string } | null;
      }[];
      } | null;
      exercises: {
        id: string;
        poolExerciseId: string;
        tracked: boolean;
        metric: Metric | null;
        poolExercise: { name: string; muscleGroup: MuscleGroup | null } | null;
      }[];
    }[];
    // One read for every movement in this person's week. The stats only exist
    // for sets that carried a weight, so a duration movement simply has no
    // entry and the card shows nothing — no metric test needed here.
    const planStats = await loadMovementStats(
      person.id,
      [...new Set(pRows.flatMap((w) => w.exercises.map((e) => e.poolExerciseId)).filter(Boolean))],
    );
    const plan = Array.from({ length: 7 }, (_, day) => ({
      day,
      workouts: pRows
        .filter((w) => w.dayOfWeek === day)
        .map((w) => ({
          id: w.id,
          name: w.name,
          category: w.category,
          muscleGroup: w.muscleGroup,
          isRest: w.isRest,
          hiit:
            w.hiitWorkoutId && w.hiitWorkout
              ? {
                  id: w.hiitWorkoutId,
                  type: w.hiitWorkout.type,
                  movements: w.hiitWorkout.movements.map((m) => ({
                    name: m.poolExercise?.name ?? "—",
                    reps: m.reps,
                    distance: m.distance,
                    weight: m.weight,
                  })),
                }
              : null,
          exercises: w.exercises.map((e) => {
            const mg = e.poolExercise?.muscleGroup ?? null;
            return {
              id: e.id,
              poolExerciseId: e.poolExerciseId,
              name: e.poolExercise?.name ?? "—",
              muscleGroup: mg,
              tracked: e.tracked,
              metric: e.metric,
              unit: mg ? weightUnits[mg] : "",
              stats: planStats[e.poolExerciseId] ?? null,
            };
          }),
        })),
    }));
    const todayPlanned = (plan[dow]?.workouts ?? []).filter((w) => !w.isRest);

    // Weekdays the plan actually uses, with the muscle groups on each. The
    // attendance grid draws a row per planned weekday only; a row for a day
    // nobody trains is noise.
    const planDays: { day: number; groups: string[] }[] = [];
    for (let d = 0; d < 7; d++) {
      const onDay = pRows.filter((p) => p.dayOfWeek === d && !p.isRest);
      if (onDay.length === 0) continue;
      const groups: string[] = [];
      for (const p of onDay) {
        if (p.muscleGroup && !groups.includes(p.muscleGroup)) groups.push(p.muscleGroup);
      }
      planDays.push({ day: d, groups });
    }

    cards.push({
      user: {
        id: person.id,
        name: person.displayName ?? person.name,
        color: person.color,
        avatarPath: person.avatarPath,
        avatarPosition: person.avatarPosition,
      },
      categories,
      exercises: defs,
      weightSeries,
      trackedSeries,
      planDays,
      today: {
        scheduled: pausedName ? [] : scheduled,
        workedOut,
        rested,
        paused: pausedName,
      },
      todayWorkouts,
      history,
      plan,
      rotation,
      weeklyStart: (await getSetting(`weeklyStart:${person.id}`)) ?? "",
      weeklyActive: (await getSetting(`weeklyActive:${person.id}`)) !== "0",
      todayPlanned: pausedName ? [] : todayPlanned,
      reminders,
    });
  }

  return {
    people: cards,
    unitSystem: unitRaw === "metric" ? "metric" : "imperial",
  };
}

export async function loadWorkoutUnitSystem(): Promise<UnitSystem> {
  const raw = await getSetting(UNIT_SYSTEM_KEY);
  return raw === "metric" ? "metric" : "imperial";
}

export type WeightUnits = Record<MuscleGroup, WeightUnit>;

/** The per-muscle-group weight unit (lb/kg), set in the pool admin. */
export async function loadWeightUnits(): Promise<WeightUnits> {
  const pairs = await Promise.all(
    MUSCLE_GROUPS.map(async (mg) => {
      const v = await getSetting(weightUnitKey(mg));
      return [mg, v === "kg" ? "kg" : DEFAULT_WEIGHT_UNIT] as const;
    }),
  );
  return Object.fromEntries(pairs) as WeightUnits;
}

export type WorkoutAdminRow = {
  id: string;
  name: string;
  color: string;
  loggedCount: number;
};

export async function loadWorkoutAdmin(): Promise<{
  people: WorkoutAdminRow[];
}> {
  const users = await prisma.user.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      name: true,
      displayName: true,
      color: true,
      workoutSessions: { where: { isRest: false }, select: { id: true } },
    },
  });

  return {
    people: users.map((u) => ({
      id: u.id,
      name: u.displayName ?? u.name,
      color: u.color,
      loggedCount: u.workoutSessions.length,
    })),
  };
}

// --- today's workout list: labels and result summaries -------------------

type SetShape = {
  exerciseId: string;
  weight: number | null;
  reps: number | null;
  distance: number | null;
  meters: number | null;
  seconds: number | null;
  unit: string | null;
  exercise: { name: string } | null;
};

type SessShape = {
  id: string;
  name: string | null;
  category: string | null;
  workoutType: WorkoutType | null;
  isRest: boolean;
  sets: SetShape[];
};

function fmtNum(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
}

function fmtDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** What to call a workout in the day's list. */
function workoutLabel(s: SessShape): string {
  if (s.name && s.name.trim()) return s.name.trim();
  if (s.category) return CATEGORY_LABEL[s.category as WorkoutCategory] ?? "Workout";
  if (s.sets.some((x) => x.weight != null)) return "Weights";
  if (s.sets.length > 0) return "Workout";
  return "Worked out";
}

/** A short human summary of what was recorded. */
function workoutResult(s: SessShape): string {
  const sets = s.sets;
  if (s.workoutType) {
    const one = sets[0];
    const tl = WORKOUT_TYPE_LABEL[s.workoutType];
    if (!one) return tl;
    if (s.workoutType === "FOR_TIME" && one.seconds != null) {
      return `${tl} · ${fmtDuration(one.seconds)}`;
    }
    if (one.reps != null) {
      return `${tl} · ${one.reps}${s.workoutType === "AMRAP" ? " rounds" : ""}`;
    }
    return tl;
  }
  if (sets.length === 0) return "";
  if (sets.length > 1) {
    const names = [
      ...new Set(sets.map((x) => x.exercise?.name).filter((n): n is string => !!n)),
    ];
    if (names.length === 0) return `${sets.length} exercises`;
    const shown = names.slice(0, 3).join(", ");
    return names.length > 3 ? `${shown} +${names.length - 3}` : shown;
  }
  const x = sets[0];
  if (x.weight != null && x.reps != null) {
    return `${fmtNum(x.weight)}${x.unit ?? ""} × ${x.reps}`;
  }
  if (x.distance != null) {
    const base = `${fmtNum(x.distance)} ${x.unit ?? ""}`.trim();
    return x.weight != null ? `${base} · ${fmtNum(x.weight)} load` : base;
  }
  if (x.meters != null) return `${fmtNum(x.meters)} m`;
  if (x.seconds != null) return fmtDuration(x.seconds);
  if (x.reps != null) return `${x.reps} reps`;
  if (x.weight != null) return `${fmtNum(x.weight)} ${x.unit ?? ""}`.trim();
  return "";
}

// --- admin: one person's workout records (for cleanup) --------------------

export type PersonRecordExercise = {
  id: string;
  name: string;
  category: WorkoutCategory;
  tracked: boolean;
  days: number[];
};

export type PersonRecordSession = {
  id: string;
  dateISO: string;
  label: string;
  result: string;
  isRest: boolean;
};

export type PersonHiitWorkout = {
  id: string;
  name: string;
  type: WorkoutType;
  approved: boolean;
  shareRequested: boolean;
  movements: {
    name: string;
    reps: number | null;
    distance: number | null;
    weight: number | null;
  }[];
};

export type PendingHiitShare = {
  id: string;
  name: string;
  type: WorkoutType;
  ownerName: string;
  movements: {
    name: string;
    reps: number | null;
    distance: number | null;
    weight: number | null;
  }[];
};

export type RotationSlotData = {
  id: string;
  position: number;
  name: string;
  category: WorkoutCategory | null;
  muscleGroup: MuscleGroup | null;
  isRest: boolean;
};

export type RotationData = {
  anchorISO: string;
  restMask: number;
  slots: RotationSlotData[];
};

export type PersonWorkoutRecords = {
  user: { id: string; name: string; color: string } | null;
  exercises: PersonRecordExercise[];
  planned: { id: string; dayOfWeek: number; name: string }[];
  sessions: PersonRecordSession[];
  hiitWorkouts: PersonHiitWorkout[];
  rotation: RotationData | null;
};

export async function loadPersonWorkoutRecords(
  userId: string,
): Promise<PersonWorkoutRecords> {
  const [user, exercises, schedules, planned, sessions, hiitRows] =
    await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, displayName: true, color: true },
      }),
      prisma.exercise.findMany({
        where: { userId, isActive: true },
        orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
        select: { id: true, name: true, category: true, tracked: true },
      }),
      prisma.workoutSchedule.findMany({
        where: { userId },
        select: { exerciseId: true, dayOfWeek: true },
      }),
      prisma.plannedWorkout.findMany({
        where: { userId },
        orderBy: [{ dayOfWeek: "asc" }, { sortOrder: "asc" }],
        select: { id: true, dayOfWeek: true, name: true },
      }),
      prisma.workoutSession.findMany({
        where: { userId },
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        take: 40,
        select: {
          id: true,
          name: true,
          category: true,
          isRest: true,
          date: true,
          completedOn: true,
          sets: {
            select: {
              exerciseId: true,
              weight: true,
              reps: true,
              distance: true,
              meters: true,
              seconds: true,
              unit: true,
              exercise: { select: { name: true } },
            },
          },
        },
      }),
      prisma.hiitWorkout.findMany({
        where: { ownerId: userId },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: {
          id: true,
          name: true,
          type: true,
          approved: true,
          shareRequested: true,
          movements: {
            orderBy: { position: "asc" },
            select: { reps: true, distance: true, weight: true, poolExercise: { select: { name: true } } },
          },
        },
      }),
    ]);

  const rotationRow = (await prisma.workoutRotation.findUnique({
    where: { userId },
    select: {
      anchorDate: true,
      restMask: true,
      isActive: true,
      slots: {
        orderBy: { position: "asc" },
        select: {
          id: true,
          position: true,
          name: true,
          category: true,
          muscleGroup: true,
          isRest: true,
        },
      },
    },
  })) as unknown as {
    anchorDate: Date;
    restMask: number;
    isActive: boolean;
    slots: {
      id: string;
      position: number;
      name: string;
      category: string | null;
      muscleGroup: string | null;
      isRest: boolean;
    }[];
  } | null;

  const rotation: RotationData | null =
    rotationRow && rotationRow.isActive
      ? {
          anchorISO: fromDateColumn(rotationRow.anchorDate),
          restMask: rotationRow.restMask,
          slots: rotationRow.slots.map((s) => ({
            id: s.id,
            position: s.position,
            name: s.name,
            category: s.category as WorkoutCategory | null,
            muscleGroup: s.muscleGroup as MuscleGroup | null,
            isRest: s.isRest,
          })),
        }
      : null;

  const daysByExercise = new Map<string, number[]>();
  for (const s of schedules) {
    const arr = daysByExercise.get(s.exerciseId) ?? [];
    arr.push(s.dayOfWeek);
    daysByExercise.set(s.exerciseId, arr);
  }

  const exRows = exercises as unknown as {
    id: string; name: string; category: string; tracked: boolean;
  }[];
  const sessRows = (sessions ?? []) as unknown as (SessShape & { date: Date })[];

  return {
    user: user
      ? { id: user.id, name: user.displayName ?? user.name, color: user.color }
      : null,
    exercises: exRows.map((e) => ({
      id: e.id,
      name: e.name,
      category: e.category as WorkoutCategory,
      tracked: e.tracked,
      days: (daysByExercise.get(e.id) ?? []).sort((a, b) => a - b),
    })),
    planned: planned as unknown as { id: string; dayOfWeek: number; name: string }[],
    sessions: sessRows.map((s) => ({
      id: s.id,
      dateISO: fromDateColumn(
        (s as { completedOn?: Date | null }).completedOn ?? s.date,
      ),
      label: s.isRest ? "Rest day" : workoutLabel(s),
      result: s.isRest ? "" : workoutResult(s),
      isRest: s.isRest,
    })),
    hiitWorkouts: (hiitRows as unknown as {
      id: string;
      name: string;
      type: WorkoutType;
      approved: boolean;
      shareRequested: boolean;
      movements: {
        reps: number | null;
        distance: number | null;
        weight: number | null;
        poolExercise: { name: string } | null;
      }[];
    }[]).map((w) => ({
      id: w.id,
      name: w.name,
      type: w.type,
      approved: w.approved,
      shareRequested: w.shareRequested,
      movements: w.movements.map((m) => ({
        name: m.poolExercise?.name ?? "—",
        reps: m.reps,
        distance: m.distance,
        weight: m.weight,
      })),
    })),
    rotation,
  };
}

/** Workouts a person has asked to share, awaiting admin approval. */
export async function loadPendingHiitShares(): Promise<PendingHiitShare[]> {
  const rows = (await prisma.hiitWorkout.findMany({
    where: { shareRequested: true, approved: false, ownerId: { not: null } },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      type: true,
      owner: { select: { name: true, displayName: true } },
      movements: {
        orderBy: { position: "asc" },
        select: { reps: true, distance: true, weight: true, poolExercise: { select: { name: true } } },
      },
    },
  })) as unknown as {
    id: string;
    name: string;
    type: WorkoutType;
    owner: { name: string; displayName: string | null } | null;
    movements: {
      reps: number | null;
      distance: number | null;
      weight: number | null;
      poolExercise: { name: string } | null;
    }[];
  }[];

  return rows.map((w) => ({
    id: w.id,
    name: w.name,
    type: w.type,
    ownerName: w.owner?.displayName ?? w.owner?.name ?? "Someone",
    movements: w.movements.map((m) => ({
      name: m.poolExercise?.name ?? "—",
      reps: m.reps,
      distance: m.distance,
      weight: m.weight,
    })),
  }));
}

// --- admin: the exercise pool --------------------------------------------

export type PoolEntry = {
  id: string;
  category: WorkoutCategory;
  name: string;
  muscleGroup: MuscleGroup | null;
  isActive: boolean;
  unit: string; // weights: the muscle group's lb/kg; otherwise ""
};

export async function loadExercisePool(): Promise<PoolEntry[]> {
  const [rows, weightUnits] = await Promise.all([
    prisma.poolExercise.findMany({
      orderBy: [
        { category: "asc" },
        { muscleGroup: "asc" },
        { sortOrder: "asc" },
        { name: "asc" },
      ],
      select: {
        id: true,
        category: true,
        name: true,
        muscleGroup: true,
        isActive: true,
      },
    }),
    loadWeightUnits(),
  ]);
  const list = rows as unknown as Omit<PoolEntry, "unit">[];
  return list.map((p) => ({
    ...p,
    unit:
      p.category === "WEIGHTS" && p.muscleGroup
        ? weightUnits[p.muscleGroup]
        : "",
  }));
}

// --- cross-person comparison --------------------------------------------

export type CompareSeries = {
  id: string;
  name: string;
  color: string;
  unit: string;
  points: { date: string; value: number }[];
  /**
   * One entry per distinct WEIGHT this person has lifted, carrying the best
   * reps they managed at it and the last time they did.
   *
   * Deliberately not one entry per set: 175x2 and 175x3 are the same bar drawn
   * twice, and the honest answer for a weight is the best you did at it. The
   * client caps the list; the server sends it newest-first so the cap keeps
   * what is current rather than whatever happens to be heaviest.
   */
  bars?: { value: number; reps: number; date: string }[];
};

export type MovementComparison = {
  poolExerciseId: string;
  name: string;
  category: WorkoutCategory;
  muscleGroup: MuscleGroup | null;
  metric: Metric;
  unit: string;
  series: CompareSeries[];
};

/**
 * One entry per pool movement that anyone has logged, each carrying a line per
 * person: their best value per day for that movement. This is what the pool
 * buys us — because every set points at a shared movement, the same lift lines
 * up across people. Duration is charted in minutes; everything else in its own
 * unit. Movements with no logged data are left out.
 */
export async function loadMovementComparisons(): Promise<MovementComparison[]> {
  const [people, unitRaw, sets, weightUnits] = await Promise.all([
    prisma.user.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, displayName: true, color: true },
    }),
    getSetting(UNIT_SYSTEM_KEY),
    prisma.sessionSet.findMany({
      where: { poolExerciseId: { not: null } },
      select: {
        poolExerciseId: true,
        weight: true,
        reps: true,
        distance: true,
        meters: true,
        seconds: true,
        session: { select: { userId: true, date: true, completedOn: true } },
        poolExercise: {
          select: { name: true, category: true, muscleGroup: true },
        },
      },
    }),
    loadWeightUnits(),
  ]);

  const unitSystem: UnitSystem = unitRaw === "metric" ? "metric" : "imperial";
  const unitForMovement = (metric: Metric, mg: MuscleGroup | null): string =>
    metric === "WEIGHT" && mg ? weightUnits[mg] : metricUnit(metric, unitSystem);

  const rows = sets as unknown as {
    poolExerciseId: string;
    weight: number | null;
    reps: number | null;
    distance: number | null;
    meters: number | null;
    seconds: number | null;
    session: { userId: string; date: Date };
    poolExercise: {
      name: string;
      category: WorkoutCategory;
      muscleGroup: MuscleGroup | null;
    } | null;
  }[];

  const nameById = new Map<string, string>(
    people.map((p) => [p.id, p.displayName ?? p.name]),
  );
  const colorById = new Map<string, string>(
    people.map((p) => [p.id, p.color]),
  );
  const orderById = new Map<string, number>(
    people.map((p, i) => [p.id, i]),
  );

  const valueOf = (
    r: (typeof rows)[number],
    metric: Metric,
  ): number | null => {
    switch (metric) {
      case "WEIGHT":
        return r.weight;
      case "REPS":
        return r.reps;
      case "DISTANCE":
        return r.distance;
      case "METERS":
        return r.meters;
      case "DURATION":
        return r.seconds != null ? r.seconds / 60 : null;
    }
  };

  // poolExerciseId -> { meta, userId -> (dateISO -> best value) }
  const byMovement = new Map<
    string,
    {
      name: string;
      category: WorkoutCategory;
      muscleGroup: MuscleGroup | null;
      metric: Metric;
      perUser: Map<string, Map<string, number>>;
    }
  >();

  const barSets = new Map<string, Map<number, { reps: number; date: string }>>();

  for (const r of rows) {
    if (!r.poolExercise) continue;
    const metric = defaultMetricFor(r.poolExercise.category);
    const value = valueOf(r, metric);
    if (value == null) continue;

    let m = byMovement.get(r.poolExerciseId);
    if (!m) {
      m = {
        name: r.poolExercise.name,
        category: r.poolExercise.category,
        muscleGroup: r.poolExercise.muscleGroup,
        metric,
        perUser: new Map(),
      };
      byMovement.set(r.poolExerciseId, m);
    }

    const uid = r.session.userId;
    const day = fromDateColumn(
      (r.session as { completedOn?: Date | null }).completedOn ?? r.session.date,
    );
    const perDay = m.perUser.get(uid) ?? new Map<string, number>();
    perDay.set(day, Math.max(perDay.get(day) ?? 0, value));
    m.perUser.set(uid, perDay);

    // One bar per WEIGHT, keeping the best reps at it and the latest date it
    // was lifted. Weights only: reps mean nothing against a distance.
    if (metric === "WEIGHT" && r.weight != null) {
      const key = `${r.poolExerciseId}:${uid}`;
      const byWeight = barSets.get(key) ?? new Map<number, { reps: number; date: string }>();
      const cur = byWeight.get(r.weight);
      // A set exists because it was done, so the floor is one rep. Older rows
      // predate rep logging and carry null; showing "175 x 0" says the lift
      // was not completed, which is the opposite of what the row means.
      const reps = Math.max(r.reps ?? 1, 1);
      byWeight.set(r.weight, {
        reps: Math.max(reps, cur?.reps ?? 0),
        date: !cur || day > cur.date ? day : cur.date,
      });
      barSets.set(key, byWeight);
    }
  }

  const out: MovementComparison[] = [];
  for (const [poolExerciseId, m] of byMovement) {
    const series: CompareSeries[] = [...m.perUser.entries()]
      .filter(([uid]) => orderById.has(uid))
      .sort((a, b) => (orderById.get(a[0]) ?? 0) - (orderById.get(b[0]) ?? 0))
      .map(([uid, days]) => ({
        id: uid,
        name: nameById.get(uid) ?? "Unknown",
        color: colorById.get(uid) ?? "#0f5c63",
        unit: unitForMovement(m.metric, m.muscleGroup),
        points: [...days.entries()]
          .map(([date, value]) => ({ date, value }))
          .sort((a, b) => (a.date < b.date ? -1 : 1)),
        // Newest first, so a cap on the client keeps what is current.
        bars: [...(barSets.get(`${poolExerciseId}:${uid}`)?.entries() ?? [])]
          .map(([value, b]) => ({ value, reps: b.reps, date: b.date }))
          .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.value - a.value)),
      }))
      .filter((s) => s.points.length > 0);

    if (series.length === 0) continue;

    out.push({
      poolExerciseId,
      name: m.name,
      category: m.category,
      muscleGroup: m.muscleGroup,
      metric: m.metric,
      unit: unitForMovement(m.metric, m.muscleGroup),
      series,
    });
  }

  out.sort((a, b) =>
    a.category === b.category
      ? a.name.localeCompare(b.name)
      : CATEGORY_LABEL[a.category].localeCompare(CATEGORY_LABEL[b.category]),
  );

  return out;
}

// --- HIIT / CrossFit named workouts -------------------------------------

export type HiitMovementRow = {
  poolExerciseId: string;
  name: string;
  reps: number | null;
  distance: number | null;
  weight: number | null;
  position: number;
};

export type HiitWorkoutRow = {
  id: string;
  name: string;
  type: WorkoutType;
  capSec: number | null;
  pyramidStart: number | null;
  pyramidEnd: number | null;
  pyramidStep: number | null;
  heroWod: boolean;
  instructions: string | null;
  movements: HiitMovementRow[];
};

/** The shared, approved HIIT/CrossFit workout pool, with their movements. */
export async function loadHiitWorkouts(): Promise<HiitWorkoutRow[]> {
  const rows = (await prisma.hiitWorkout.findMany({
    where: { ownerId: null, approved: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      type: true,
      capSec: true,
      pyramidStart: true,
      pyramidEnd: true,
      pyramidStep: true,
      heroWod: true,
      notes: true,
      movements: {
        orderBy: { position: "asc" },
        select: {
          poolExerciseId: true,
          reps: true,
          distance: true,
          weight: true,
          position: true,
          poolExercise: { select: { name: true } },
        },
      },
    },
  })) as unknown as {
    id: string;
    name: string;
    type: WorkoutType;
    capSec: number | null;
    pyramidStart: number | null;
    pyramidEnd: number | null;
    pyramidStep: number | null;
    heroWod: boolean;
    notes: string | null;
    movements: {
      poolExerciseId: string;
      reps: number | null;
      distance: number | null;
      weight: number | null;
      position: number;
      poolExercise: { name: string } | null;
    }[];
  }[];

  return rows.map((w) => ({
    id: w.id,
    name: w.name,
    type: w.type,
    capSec: w.capSec,
    pyramidStart: w.pyramidStart,
    pyramidEnd: w.pyramidEnd,
    pyramidStep: w.pyramidStep,
    heroWod: w.heroWod,
    instructions: w.notes,
    movements: w.movements.map((m) => ({
      poolExerciseId: m.poolExerciseId,
      name: m.poolExercise?.name ?? "—",
      reps: m.reps,
      distance: m.distance,
      weight: m.weight,
      position: m.position,
    })),
  }));
}

export type BoardHiitWorkout = {
  id: string;
  name: string;
  type: WorkoutType;
  ownerId: string | null; // null = shared pool
  approved: boolean;
  shareRequested: boolean;
  heroWod: boolean;
  instructions: string | null;
  movements: HiitMovementRow[];
};

/**
 * For the logging dropdown: the shared/approved pool plus every person's own
 * workouts. The grid narrows to shared + the open person's own.
 */
export async function loadHiitWorkoutsForBoard(): Promise<BoardHiitWorkout[]> {
  const rows = (await prisma.hiitWorkout.findMany({
    where: { OR: [{ ownerId: null, approved: true }, { ownerId: { not: null } }] },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      type: true,
      ownerId: true,
      approved: true,
      shareRequested: true,
      heroWod: true,
      notes: true,
      movements: {
        orderBy: { position: "asc" },
        select: {
          poolExerciseId: true,
          reps: true,
          distance: true,
          weight: true,
          position: true,
          poolExercise: { select: { name: true } },
        },
      },
    },
  })) as unknown as {
    id: string;
    name: string;
    type: WorkoutType;
    ownerId: string | null;
    approved: boolean;
    shareRequested: boolean;
    heroWod: boolean;
    notes: string | null;
    movements: {
      poolExerciseId: string;
      reps: number | null;
      distance: number | null;
      weight: number | null;
      position: number;
      poolExercise: { name: string } | null;
    }[];
  }[];

  return rows.map((w) => ({
    id: w.id,
    name: w.name,
    type: w.type,
    ownerId: w.ownerId,
    approved: w.approved,
    shareRequested: w.shareRequested,
    heroWod: w.heroWod,
    instructions: w.notes,
    movements: w.movements.map((m) => ({
      poolExerciseId: m.poolExerciseId,
      name: m.poolExercise?.name ?? "—",
      reps: m.reps,
      distance: m.distance,
      weight: m.weight,
      position: m.position,
    })),
  }));
}
