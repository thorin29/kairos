import "server-only";
import { prisma } from "@/lib/prisma";
import { fromDateColumn } from "@/lib/dates";
import { doneOn } from "@/lib/queries/movement-stats";
import { OPTIONAL_CATEGORIES } from "@/lib/workouts/blocks";
import type { MuscleGroup } from "@/lib/workouts/catalog";
import { groupsFor } from "@/lib/workouts/involvement";
import { buildHeat, type HeatMap, type HeatSet } from "@/lib/workouts/heat";

/** Groups that have a place on the body. Full body has none. */
const ON_BODY = new Set(["CHEST", "BACK", "ARMS", "LEGS", "SHOULDERS", "CORE", "DEADLIFT"]);

/**
 * The body map's heat view for one person (v0.635): every finished set with
 * reps or a timed hold (v0.636), from strength work (warm-up and cardio sessions are left out), with
 * how each movement felt that day. Shared by the web board and the phone.
 */
export async function loadHeat(userId: string, todayISO: string, unit: string): Promise<HeatMap> {
  const [rows, feedback] = (await Promise.all([
    prisma.sessionSet.findMany({
      where: {
        finished: true,
        OR: [{ reps: { gt: 0 } }, { seconds: { gt: 0 } }],
        poolExerciseId: { not: null },
        session: { userId, isRest: false },
      },
      select: {
        weight: true,
        reps: true,
        seconds: true,
        poolExerciseId: true,
        swappedFromId: true,
        poolExercise: { select: { name: true, muscleGroup: true } },
        session: { select: { date: true, completedOn: true, category: true } },
      },
    }),
    prisma.workoutFeedback.findMany({
      where: { userId, effort: { not: null } },
      select: { date: true, slot: true, effort: true },
    }),
  ])) as [
    {
      weight: number | null;
      reps: number | null;
      seconds: number | null;
      poolExerciseId: string | null;
      swappedFromId: string | null;
      poolExercise: { name: string; muscleGroup: string | null } | null;
      session: { date: Date; completedOn: Date | null; category: string | null };
    }[],
    { date: Date; slot: string; effort: string | null }[],
  ];

  // Feedback is filed under the planned movement on the day it was planned for.
  const effortOn = new Map(feedback.map((f) => [`${fromDateColumn(f.date)}|${f.slot}`, f.effort]));
  const groups = new Map<string, ReturnType<typeof groupsFor>>();

  const sets: HeatSet[] = [];
  for (const r of rows) {
    if (!r.poolExerciseId || !r.poolExercise) continue;
    if (r.session.category && OPTIONAL_CATEGORIES.includes(r.session.category)) continue;
    let g = groups.get(r.poolExerciseId);
    if (!g) {
      g = groupsFor(r.poolExercise.name, r.poolExercise.muscleGroup as MuscleGroup | null);
      groups.set(r.poolExerciseId, g);
    }
    const primary = g.primary && ON_BODY.has(g.primary) ? g.primary : null;
    const secondary = g.secondary.filter((x) => ON_BODY.has(x) && x !== "DEADLIFT");
    if (!primary && secondary.length === 0) continue;
    const slot = r.swappedFromId ?? r.poolExerciseId;
    sets.push({
      date: doneOn(r.session),
      movement: r.poolExerciseId,
      name: r.poolExercise.name,
      primary,
      secondary,
      weight: r.weight,
      reps: r.reps,
      seconds: r.seconds,
      marksDay: r.session.category !== "HIIT",
      effort:
        effortOn.get(`${fromDateColumn(r.session.date)}|${slot}`) ??
        effortOn.get(`${doneOn(r.session)}|${slot}`) ??
        null,
    });
  }
  return buildHeat(sets, todayISO, unit);
}
