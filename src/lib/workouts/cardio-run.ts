import "server-only";
import { prisma } from "@/lib/prisma";
import { toDateColumn } from "@/lib/dates";
import { loadWorkoutUnitSystem } from "@/lib/queries/workouts";
import { historyResult } from "@/lib/queries/workout-log";
import { logPlannedWorkout, settleWorkoutTask } from "@/lib/workouts/mark";
import { CARDIO_CATEGORIES } from "@/lib/workouts/blocks";
import { cardioActivity, cardioSlot } from "@/lib/workouts/cardio";

/** One cardio session on a day, as the day page lists it. */
export type CardioEntry = {
  sessionId: string;
  /** "Rowing", "Jump rope", or the planned rowing's name. */
  name: string;
  /** "2,000 m · 7:45 · 1:56.3 /500m". */
  summary: string;
  /** From Concept2: its result, and the hand entry it replaced (Undo). */
  concept2: { resultId: string; replaced: string | null } | null;
  /** How it felt (EASY / SOLID / HARD / TOO_HARD) and anything that hurt. */
  effort: string | null;
  hurt: string | null;
};

/** The day's cardio: every row, run, ruck and other cardio, oldest first. */
export async function cardioDay(userId: string, dateISO: string): Promise<CardioEntry[]> {
  const date = toDateColumn(dateISO);
  const sessions = (await prisma.workoutSession.findMany({
    where: { userId, date, isRest: false, category: { in: CARDIO_CATEGORIES as never } },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      sets: {
        orderBy: { setNumber: "asc" },
        select: {
          weight: true,
          reps: true,
          unit: true,
          distance: true,
          meters: true,
          seconds: true,
          poolExercise: { select: { name: true } },
        },
      },
    },
  })) as {
    id: string;
    name: string | null;
    sets: Parameters<typeof historyResult>[0];
  }[];
  if (sessions.length === 0) return [];
  const ids = sessions.map((s) => s.id);
  const [ledger, feedback] = (await Promise.all([
    prisma.concept2Result.findMany({
      where: { userId, sessionId: { in: ids } },
      select: { resultId: true, sessionId: true, replaced: true, meters: true, seconds: true },
    }),
    prisma.workoutFeedback.findMany({
      where: { userId, date, slot: { in: ids.map(cardioSlot) } },
      select: { slot: true, effort: true, hurt: true },
    }),
  ])) as [
    { resultId: string; sessionId: string | null; replaced: unknown }[],
    { slot: string; effort: string | null; hurt: string | null }[],
  ];
  const c2 = new Map(ledger.map((l) => [l.sessionId as string, l]));
  const fb = new Map(feedback.map((f) => [f.slot, f]));
  return sessions.map((s) => {
    const l = c2.get(s.id);
    const hand = l?.replaced as { sets?: Parameters<typeof historyResult>[0] } | null | undefined;
    const f = fb.get(cardioSlot(s.id));
    return {
      sessionId: s.id,
      name: s.name ?? "Cardio",
      summary: historyResult(s.sets),
      concept2: l
        ? {
            resultId: l.resultId,
            replaced: hand
              ? historyResult(
                  (hand.sets ?? []).map((x) => ({
                    weight: null,
                    reps: null,
                    unit: (x as { unit?: string | null }).unit ?? null,
                    distance: (x as { distance?: number | null }).distance ?? null,
                    meters: (x as { meters?: number | null }).meters ?? null,
                    seconds: (x as { seconds?: number | null }).seconds ?? null,
                    poolExercise: null,
                  })),
                ) || "Rowing"
              : null,
          }
        : null,
      effort: f?.effort ?? null,
      hurt: f?.hurt ?? null,
    };
  });
}

/** Whether anything counting as cardio was logged on a day. */
export async function cardioLogged(userId: string, dateISO: string): Promise<boolean> {
  const n = (await prisma.workoutSession.count({
    where: { userId, date: toDateColumn(dateISO), isRest: false, category: { in: CARDIO_CATEGORIES as never } },
  })) as number;
  return n > 0;
}

export type CardioIn = {
  activity: string;
  meters?: number | null;
  distance?: number | null;
  seconds?: number | null;
  load?: number | null;
  /** The day it was really done, when logging a past day late. */
  completedOnISO?: string | null;
};

const pos = (n: unknown, max: number): number | null =>
  typeof n === "number" && Number.isFinite(n) && n > 0 && n <= max ? n : null;

/**
 * Log one cardio session for a day. Needs at least one number. Returns the
 * session, or null when nothing usable was sent.
 */
export async function logCardio(userId: string, dateISO: string, input: CardioIn): Promise<string | null> {
  const a = cardioActivity(input.activity);
  if (!a) return null;
  const meters = a.meters ? pos(input.meters, 500_000) : null;
  const distance = a.distance ? pos(input.distance, 1000) : null;
  const seconds = pos(input.seconds, 24 * 3600);
  const load = a.load ? pos(input.load, 500) : null;
  if (meters == null && distance == null && seconds == null) return null;
  const system = await loadWorkoutUnitSystem();
  const completedOn =
    input.completedOnISO && /^\d{4}-\d{2}-\d{2}$/.test(input.completedOnISO) && input.completedOnISO !== dateISO
      ? toDateColumn(input.completedOnISO)
      : null;
  const session = await prisma.workoutSession.create({
    data: {
      userId,
      date: toDateColumn(dateISO),
      completedOn,
      name: a.name,
      category: a.category,
      finished: true,
      isRest: false,
      sets: {
        create: [
          {
            setNumber: 1,
            meters,
            distance,
            seconds: seconds != null ? Math.round(seconds) : null,
            weight: load,
            unit: meters != null ? "m" : distance != null ? (system === "metric" ? "km" : "mi") : null,
            finished: true,
          },
        ],
      },
    },
    select: { id: true },
  });
  await settleWorkoutTask(userId, dateISO, { fallbackComplete: true });
  return session.id;
}

/**
 * Remove a cardio session. A Concept2 row stays out afterwards (it would come
 * straight back on the next check otherwise).
 */
export async function removeCardio(userId: string, sessionId: string): Promise<boolean> {
  const s = (await prisma.workoutSession.findFirst({
    where: { id: sessionId, userId, category: { in: CARDIO_CATEGORIES as never } },
    select: { id: true, date: true },
  })) as { id: string; date: Date } | null;
  if (!s) return false;
  await prisma.concept2Result.updateMany({
    where: { userId, sessionId: s.id },
    data: { dismissed: true, sessionId: null },
  });
  await prisma.workoutFeedback.deleteMany({ where: { userId, slot: cardioSlot(s.id) } });
  await prisma.workoutSession.delete({ where: { id: s.id } });
  await settleWorkoutTask(userId, s.date.toISOString().slice(0, 10), { fromSkip: true });
  return true;
}

/**
 * A Warm-up plan done (or not) for a day: its session, named after the plan,
 * is what marks it, the same as any plan with nothing to enter.
 */
export async function setWarmupDone(
  userId: string,
  dateISO: string,
  plannedWorkoutId: string,
  done: boolean,
  completedOnISO?: string | null,
): Promise<boolean> {
  const plan = (await prisma.plannedWorkout.findFirst({
    where: { id: plannedWorkoutId, userId },
    select: { name: true, category: true },
  })) as { name: string; category: string | null } | null;
  if (!plan) return false;
  if (done) {
    await logPlannedWorkout(userId, dateISO, plannedWorkoutId, [], { completedOnISO: completedOnISO ?? null });
  } else {
    await prisma.workoutSession.deleteMany({
      where: { userId, date: toDateColumn(dateISO), isRest: false, name: plan.name, category: plan.category as never },
    });
  }
  await settleWorkoutTask(userId, dateISO, { fallbackComplete: done, fromSkip: !done });
  return true;
}

export type SimplePlan = {
  plannedWorkoutId: string;
  name: string;
  /** WARMUP, or CARDIO (an older Rowing / Running / Rucking plan counts as CARDIO). */
  category: "WARMUP" | "CARDIO";
  done: boolean;
  skipped: boolean;
};

/**
 * The day's Warm-up and Cardio plans for the phone, which lays out the rest
 * from movements: these hold none. Cardio is done by any cardio that day, a
 * Warm-up by its own session.
 */
export async function simplePlansFor(userId: string, dateISO: string): Promise<SimplePlan[]> {
  const date = toDateColumn(dateISO);
  const [plans, sessions, skips] = (await Promise.all([
    prisma.plannedWorkout.findMany({
      where: {
        userId,
        dayOfWeek: new Date(`${dateISO}T00:00:00Z`).getUTCDay(),
        isRest: false,
        hiitWorkoutId: null,
        category: { in: ["WARMUP", ...CARDIO_CATEGORIES] as never },
        createdAt: { lt: new Date(Date.parse(`${dateISO}T00:00:00Z`) + 86_400_000) },
      },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, category: true, _count: { select: { exercises: true } } },
    }),
    prisma.workoutSession.findMany({
      where: { userId, date, isRest: false },
      select: { name: true, category: true },
    }),
    prisma.workoutMovementSkip.findMany({ where: { userId, date }, select: { slot: true } }),
  ])) as [
    { id: string; name: string; category: string | null; _count: { exercises: number } }[],
    { name: string | null; category: string | null }[],
    { slot: string }[],
  ];
  const anyCardio = sessions.some((row) => row.category != null && CARDIO_CATEGORIES.includes(row.category));
  const skipped = new Set(skips.map((k) => k.slot));
  return plans
    .filter((p) => p._count.exercises === 0)
    .map((p) => {
      const warmup = p.category === "WARMUP";
      return {
        plannedWorkoutId: p.id,
        name: p.name,
        category: warmup ? ("WARMUP" as const) : ("CARDIO" as const),
        done: warmup
          ? sessions.some((row) => row.category === "WARMUP" && (row.name ?? "").slice(0, 40) === p.name.slice(0, 40))
          : anyCardio,
        skipped: skipped.has(`plan:${p.id}`),
      };
    });
}
