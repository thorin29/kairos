import "server-only";
import { prisma } from "@/lib/prisma";
import { fromDateColumn } from "@/lib/dates";
import { doneOn } from "@/lib/queries/movement-stats";
import { OPTIONAL_CATEGORIES } from "@/lib/workouts/blocks";
import type { MuscleGroup } from "@/lib/workouts/catalog";
import { groupsFor } from "@/lib/workouts/involvement";
import { buildHeat, scoreSets, type HeatMap, type HeatSet } from "@/lib/workouts/heat";
import { buildTrainingHeat, type CardioEntry, type Pause, type TrainingHeat } from "@/lib/workouts/training-heat";
import { lightFactor } from "@/lib/workouts/suggest";
import { parseAdjust } from "@/lib/workouts/adjust";
import { CARDIO_CATEGORIES } from "@/lib/workouts/blocks";

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
        session: { select: { date: true, completedOn: true, category: true, intent: true } },
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
      session: { date: Date; completedOn: Date | null; category: string | null; intent: string | null };
    }[],
    { date: Date; slot: string; effort: string | null }[],
  ];

  // Feedback is filed under the planned movement on the day it was planned for.
  const effortOn = new Map(feedback.map((f) => [`${fromDateColumn(f.date)}|${f.slot}`, f.effort]));
  const groups = new Map<string, ReturnType<typeof groupsFor>>();

  const sets: HeatSet[] = [];
  const light: boolean[] = [];
  const adjusted = await adjustedDays(userId);
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
    // Light, deload and test weeks and adjusted days aren't judged for strength.
    light.push(
      r.session.intent === "LIGHT" || r.session.intent === "TEST" || adjusted.has(fromDateColumn(r.session.date)),
    );
  }
  const heat = buildHeat(sets, todayISO, unit);
  const scores = scoreSets(sets);
  const training: TrainingHeat = buildTrainingHeat(
    sets.map((s, i) => ({ ...s, credit: scores[i].credit, light: light[i] })),
    await cardioEntries(userId, effortOn),
    todayISO,
    await pausesFor(userId),
  );
  return { ...heat, training };
}

/** Days made lighter (Lighter today, or an Adjust today choice). */
async function adjustedDays(userId: string): Promise<Set<string>> {
  const rows = (await prisma.workoutSuggestionAnswer.findMany({
    where: { userId, key: "day" },
    select: { date: true, answer: true },
  })) as { date: Date; answer: string }[];
  return new Set(rows.filter((r) => lightFactor(r.answer) != null || parseAdjust(r.answer)).map((r) => fromDateColumn(r.date)));
}

/** Pauses (none yet): when they exist, the weeks in them change nothing. */
async function pausesFor(_userId: string): Promise<Pause[]> {
  return [];
}

const KIND_WORD: Record<string, string> = {
  ROWING: "rowing",
  RUNNING: "running",
  RUCKING: "rucking",
  CARDIO: "cardio",
  SPORT: "sport",
  HIIT: "conditioning",
};

/**
 * Endurance work: sport (hockey), rowing, running, rucking, other cardio and
 * conditioning, with minutes and how hard each felt (its own feedback;
 * conditioning goes by any conditioning feedback that day).
 */
async function cardioEntries(userId: string, effortOn: Map<string, string | null>): Promise<CardioEntry[]> {
  const rows = (await prisma.workoutSession.findMany({
    where: { userId, isRest: false, category: { in: [...CARDIO_CATEGORIES, "SPORT", "HIIT"] as never } },
    select: {
      id: true,
      date: true,
      completedOn: true,
      name: true,
      category: true,
      durationMin: true,
      sourceEventId: true,
      sets: { select: { seconds: true } },
    },
  })) as {
    id: string;
    date: Date;
    completedOn: Date | null;
    name: string | null;
    category: string;
    durationMin: number | null;
    sourceEventId: string | null;
    sets: { seconds: number | null }[];
  }[];
  const hiitEffort = new Map<string, string | null>();
  for (const [k, v] of effortOn) {
    const [d, slot] = k.split("|");
    if (slot.startsWith("hiit:") || slot.startsWith("pick:")) hiitEffort.set(d, v);
  }
  return rows.map((r) => {
    const day = fromDateColumn(r.date);
    const secs = r.sets.reduce((t, x) => t + (x.seconds ?? 0), 0);
    const minutes = r.durationMin ?? (secs > 0 ? Math.round(secs / 60) : r.category === "HIIT" ? 15 : 0);
    const effort =
      r.category === "SPORT"
        ? (effortOn.get(`${day}|sport:${r.sourceEventId}`) ?? null)
        : r.category === "HIIT"
          ? (hiitEffort.get(day) ?? null)
          : (effortOn.get(`${day}|cardio:${r.id}`) ?? null);
    const kind =
      r.category === "SPORT" ? (/hockey|skate|puck|ice/i.test(r.name ?? "") ? "hockey" : (r.name ?? "sport").toLowerCase()) : KIND_WORD[r.category] ?? "cardio";
    return { date: doneOn(r), minutes, effort, kind };
  });
}
