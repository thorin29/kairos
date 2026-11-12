import "server-only";
import { swapsFor } from "@/lib/workouts/day-swap-run";
import { planWeekday, type DaySwap } from "@/lib/workouts/day-swap";
import { shownGroup } from "@/lib/workouts/involvement";
import { REP_BANDS, bandPoints } from "@/lib/workouts/records";
import { prisma } from "@/lib/prisma";
import { dayOfWeek, fromDateColumn, toDateColumn } from "@/lib/dates";
import { getSetting } from "@/lib/settings";
import { loadMovementStats, type MovementStats } from "@/lib/queries/movement-stats";
import { setsSummary } from "@/lib/workouts/sets";
import { loadDayOrders, type DayOrders } from "@/lib/workouts/day-order";
import { programByKey } from "@/lib/workouts/programs";
import { groupHistory } from "@/lib/workouts/history";
import { loadProgramSpans, sportLabels } from "@/lib/workouts/history-run";
import type { HeatMap } from "@/lib/workouts/heat";
import { loadHeat } from "@/lib/workouts/heat-run";
import { coreDayView, syncCoreDays } from "@/lib/workouts/core-run";
import { cardLines, type CardEntry } from "@/lib/workouts/day-title";
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
  /** For stacking one progress block per muscle group; "LOWER_BACK" for the
   *  lower-back moves listed beside the deadlifts (v0.672). */
  muscleGroup?: MuscleGroup | "LOWER_BACK" | null;
  unit: string;
  color: string;
  /** value = the day's heaviest weight (the record). reps = how many that set
   *  was, when it was logged — never part of the record, only context. */
  points: { date: string; value: number; reps?: number | null; intent?: string | null }[];
  /** The heaviest set ever logged for this movement. */
  best?: { value: number; reps: number | null; date: string } | null;
  /** Best weight actually lifted at each rep count — real lifts, no estimates.
   *  Only rep counts that have been logged appear. */
  repMaxes?: { reps: number; value: number; date: string }[];
  /** The line for one rep range at a time (records.ts REP_BANDS), so sets
   *  are compared with sets like them. Only ranges with a point (v0.610). */
  bands?: { key: string; label: string; points: { date: string; value: number; reps: number }[] }[];
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
  /** Every session that day: the entry is the day (v0.627). */
  ids: string[];
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
  /** Its set structure ("same:3x5", "wave:2026-11-02"), or null for any sets (v0.615). */
  scheme?: string | null;
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
  /** A Warm-up's routine (v0.622): "lib:<key>" or a routine id; null: a plain check. */
  warmup?: string | null;
  /** A Core day's rotation (v0.637); null for anything else. */
  core?: { rotation: string[]; test: boolean; at: number; withTest?: boolean; kind?: "core" | "arms" | "iso" } | null;
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
  /** Days swapped this week or lately (v0.677): plan[planWeekday(swaps, day)]. */
  swaps: DaySwap[];
  user: { id: string; name: string; color: string; avatarPath: string | null; avatarPosition: string | null };
  categories: WorkoutCategory[];
  exercises: ExerciseDef[];
  weightSeries: GraphSeries[];
  /** Every tracked movement, not just today's. What the body map navigates. */
  trackedSeries: GraphSeries[];
  /** The body map's heat view (v0.635). */
  heat: HeatMap;
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
  /** The day page's section order: every day, and weekdays with their own (v0.615). */
  sectionOrder: DayOrders;
  todayPlanned: { id: string; name: string }[];
  reminders: Reminder[];
};

export type WorkoutsBoard = {
  people: PersonWorkout[];
  unitSystem: UnitSystem;
};

/** Each weekday's home-card lines (v0.638): the main workout, and the rest. */
async function loadWorkoutCardLines(userId: string): Promise<Map<number, { title: string | null; extras: string[] }>> {
  const [planned, program] = (await Promise.all([
    prisma.plannedWorkout.findMany({
      where: { userId, isRest: false },
      orderBy: [{ dayOfWeek: "asc" }, { sortOrder: "asc" }],
      select: {
        dayOfWeek: true,
        name: true,
        category: true,
        hiitWorkout: { select: { name: true } },
        exercises: {
          where: { programRole: { not: null } },
          orderBy: { sortOrder: "asc" },
          select: { programRole: true, poolExercise: { select: { name: true } } },
        },
      },
    }),
    prisma.personProgram.findFirst({ where: { userId, status: "ACTIVE" }, select: { programKey: true } }),
  ])) as [
    {
      dayOfWeek: number;
      name: string;
      category: string | null;
      hiitWorkout: { name: string } | null;
      exercises: { programRole: string | null; poolExercise: { name: string } | null }[];
    }[],
    { programKey: string } | null,
  ];

  // On a program the day reads as the program and its main lift ("Strength
  // waves · Back squats"), not every block of the day (v0.619).
  const prog = programByKey(program?.programKey);
  const mainRoles = new Set(prog ? prog.days.flatMap((d) => d.roles.filter((r) => r.main).map((r) => r.key)) : []);
  const byDay = new Map<number, CardEntry[]>();
  for (const p of planned) {
    const mains = prog
      ? p.exercises
          .filter((e) => e.programRole && mainRoles.has(e.programRole) && e.poolExercise)
          .map((e) => {
            const n = e.poolExercise!.name.trim();
            return n.charAt(0).toUpperCase() + n.slice(1);
          })
      : [];
    const list = byDay.get(p.dayOfWeek) ?? [];
    list.push({ name: p.name, category: p.category, hiitName: p.hiitWorkout?.name ?? null, mains });
    byDay.set(p.dayOfWeek, list);
  }
  const out = new Map<number, { title: string | null; extras: string[] }>();
  for (const [day, entries] of byDay) out.set(day, cardLines(entries, prog?.name ?? null));
  return out;
}

/** Each weekday's workout title for the home card and the day page (see `cardLines`). */
export async function loadWorkoutPlanNames(userId: string): Promise<Map<number, string>> {
  const out = new Map<number, string>();
  for (const [day, l] of await loadWorkoutCardLines(userId)) if (l.title) out.set(day, l.title);
  return out;
}

/**
 * What else is on each weekday besides the main workout, for the line under
 * the home card's title (v0.628, v0.638): conditioning, cardio, a sport, a
 * second workout. Never the warm-up, never what the title already says.
 */
export async function loadWorkoutDayExtras(userId: string): Promise<Map<number, string[]>> {
  const out = new Map<number, string[]>();
  for (const [day, l] of await loadWorkoutCardLines(userId)) if (l.extras.length) out.set(day, l.extras);
  return out;
}

export async function loadWorkoutsBoard(todayISO: string): Promise<WorkoutsBoard> {
  // Core days move on to the workout now due before anything reads the plan (v0.637).
  await syncCoreDays(undefined, todayISO);
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
    // A day swapped this week (v0.677) follows the other weekday's plan.
    const swaps = await swapsFor(person.id);
    const dow = planWeekday(swaps, todayISO);
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
          session: { select: { date: true, completedOn: true, intent: true } },
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
              poolExercise: { select: { name: true } },
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
          warmup: true,
          core: true,
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
              scheme: true,
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
        take: 60,
        select: {
          id: true,
          name: true,
          category: true,
          workoutType: true,
          isRest: true,
          date: true,
          completedOn: true,
          sourceEventId: true,
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
              poolExercise: { select: { name: true } },
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
      session: { date: Date; intent?: string | null };
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
    const dated = new Map<string, { weight: number; reps: number; date: string }[]>();
    // Days logged as a program's light or test day, drawn hollow (v0.611).
    const intentOn = new Map<string, string>();
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
      if (set.session.intent) intentOn.set(d, set.session.intent);
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
        const list = dated.get(id) ?? [];
        list.push({ weight: set.weight, reps: set.reps, date: d });
        dated.set(id, list);
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
        // The hinge family sits under Deadlift whatever it's filed under (v0.671).
        muscleGroup: (shownGroup(meta.name, meta.muscleGroup ?? null) as MuscleGroup | "LOWER_BACK" | null) ?? null,
        unit: meta.muscleGroup ? weightUnits[meta.muscleGroup] : "",
        color: LINE_COLORS[i % LINE_COLORS.length],
        points: [...perMovementDay.get(id)!.entries()]
          .map(([date, p]) => ({ date, value: p.value, reps: p.reps, intent: intentOn.get(date) ?? null }))
          .sort((a, b) => (a.date < b.date ? -1 : 1)),
        best: [...perMovementDay.get(id)!.entries()]
          .map(([date, p]) => ({ date, value: p.value, reps: p.reps }))
          .sort((a, b) => b.value - a.value || (b.reps ?? 0) - (a.reps ?? 0))[0] ?? null,
        repMaxes: [...(repMaxes.get(id)?.entries() ?? [])]
          .map(([reps, r]) => ({ reps, value: r.value, date: r.date }))
          .sort((a, b) => a.reps - b.reps),
        bands: REP_BANDS.map((b) => ({ key: b.key, label: b.label, points: bandPoints(dated.get(id) ?? [], b) })).filter(
          (b) => b.points.length > 0,
        ),
      }))
      .filter((s) => s.points.length > 0);

    const todayPoolIds = new Set<string>();
    // Today's planned movements, for the places that mean "today".
    for (const w of plannedRows as unknown as {
      dayOfWeek: number;
      exercises: { poolExerciseId: string; tracked: boolean }[];
    }[]) {
      if (w.dayOfWeek === dow) {
        for (const e of w.exercises) todayPoolIds.add(e.poolExerciseId);
      }
    }

    // Everything the person has ever logged a weight for, whatever the plan or
    // program is now (v0.634): the body map, records and Workout days grid are
    // history. Narrowing to the plan's tracked movements made a muscle no longer
    // programmed (Arms) vanish from all three, its records unreachable. The
    // body map navigates by muscle, not by date, so it isn't narrowed to today.
    const trackedSeries: GraphSeries[] = allSeries;

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

    const recent = (recentSessions ?? []) as unknown as (SessShape & { date: Date; sourceEventId?: string | null })[];
    // One entry per day, named by what was trained and the program it was
    // part of (v0.627); a game by its kind.
    const games = await sportLabels(recent.map((s) => s.sourceEventId ?? null));
    const history: HistoryEntry[] = groupHistory(
      recent.map((s) => ({
        id: s.id,
        date: fromDateColumn((s as { completedOn?: Date | null }).completedOn ?? s.date),
        label: (s.sourceEventId && games.get(s.sourceEventId)) || workoutLabel(s),
        result: s.isRest ? "" : workoutResult(s),
        isRest: s.isRest,
        category: (s.category as string | null) ?? null,
      })),
      await loadProgramSpans(person.id),
      30,
    ).map((d) => ({ id: d.id, ids: d.ids, dateISO: d.date, label: d.label, result: d.result, isRest: d.isRest }));

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
      warmup: string | null;
      core: unknown;
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
        scheme: string | null;
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
          warmup: w.warmup,
          core: coreDayView(w.core),
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
              scheme: e.scheme ?? null,
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
      swaps,
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
      heat: await loadHeat(
        person.id,
        todayISO,
        metricUnit("WEIGHT" as Metric, unitRaw === "metric" ? "metric" : "imperial"),
      ),
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
      sectionOrder: await loadDayOrders(person.id),
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
  poolExercise?: { name: string } | null;
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
  if (s.sets.some((x) => x.weight != null)) return "Strength";
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
      ...new Set(
        sets
          .map((x) => x.exercise?.name ?? x.poolExercise?.name)
          .filter((n): n is string => !!n),
      ),
    ];
    // One movement logged set by set: "5 sets · top 185 × 1".
    if (names.length === 1 && sets.some((x) => x.weight != null)) return setsSummary(sets);
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
  /** How it's logged; null = the category's default (v0.609.0). */
  metric: Metric | null;
  /** The how-to shown behind ⓘ (v0.613.0). */
  about: string | null;
  /** Library tags (v0.613.0): equipment keys, type, and the library entry. */
  equipment: string | null;
  pattern: string | null;
  libraryKey: string | null;
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
        metric: true,
        about: true,
        equipment: true,
        pattern: true,
        libraryKey: true,
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
