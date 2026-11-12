import "server-only";
import { buildCoreMoves } from "@/lib/workouts/core-moves";
import { buildCoreSummary } from "@/lib/workouts/core-progress";
import {
  buildCardioCharts,
  buildConditioningCharts,
  type CardioActivityKey,
  type CardioSession,
  type ConditioningSession,
} from "@/lib/workouts/endurance-charts";
import type { WorkoutType } from "@/lib/workouts/catalog";
import { sportDayLabel } from "@/lib/sport/label";
import { soreSpotsFor } from "@/lib/workouts/sore-run";
import { workoutPausesFor } from "@/lib/workouts/pause-run";
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
  const { days: adjusted, marks } = await adjustedDays(userId);
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
  const endurance = await cardioEntries(userId, effortOn);
  const training: TrainingHeat = buildTrainingHeat(
    sets.map((s, i) => ({ ...s, credit: scores[i].credit, light: light[i] })),
    endurance.entries,
    todayISO,
    await pausesFor(userId),
  );
  const coreMoves = buildCoreMoves(sets);
  return {
    ...heat,
    training,
    marks,
    coreMoves,
    coreSummary: buildCoreSummary(coreMoves, heat.plank ?? [], todayISO),
    cardioCharts: buildCardioCharts(endurance.cardio, todayISO),
    conditioningCharts: buildConditioningCharts(endurance.conditioning, todayISO),
    sore: await soreSpotsFor(userId),
  };
}

/** Days made lighter (Lighter today, or an Adjust today choice). */
async function adjustedDays(userId: string): Promise<{ days: Set<string>; marks: { date: string; label: string }[] }> {
  const rows = (await prisma.workoutSuggestionAnswer.findMany({
    where: { userId, key: "day" },
    select: { date: true, answer: true },
  })) as { date: Date; answer: string }[];
  const marks: { date: string; label: string }[] = [];
  for (const r of rows) {
    const adj = parseAdjust(r.answer);
    const label = adj ? ADJUST_LABEL[adj.mode] ?? "Adjusted" : lightFactor(r.answer) != null ? "Lighter" : null;
    if (label) marks.push({ date: fromDateColumn(r.date), label });
  }
  marks.sort((a, b) => (a.date < b.date ? -1 : 1));
  return { days: new Set(marks.map((m) => m.date)), marks };
}

const ADJUST_LABEL: Record<string, string> = { low: "Low energy", time: "Short", sick: "Sick", hurt: "Hurt" };

/** Pauses (none yet): when they exist, the weeks in them change nothing. */
async function pausesFor(userId: string): Promise<Pause[]> {
  // Household pauses and the person's own (v0.678).
  return (await workoutPausesFor(userId)).map((p) => ({ from: p.from, to: p.to }));
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
async function cardioEntries(
  userId: string,
  effortOn: Map<string, string | null>,
): Promise<{ entries: CardioEntry[]; cardio: CardioSession[]; conditioning: ConditioningSession[] }> {
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
      workoutType: true,
      version: true,
      sets: { orderBy: { setNumber: "asc" }, select: { seconds: true, reps: true, meters: true, distance: true, unit: true, weight: true } },
    },
  })) as {
    id: string;
    date: Date;
    completedOn: Date | null;
    name: string | null;
    category: string;
    durationMin: number | null;
    sourceEventId: string | null;
    workoutType: string | null;
    version: string | null;
    sets: {
      seconds: number | null;
      reps: number | null;
      meters: number | null;
      distance: number | null;
      unit: string | null;
      weight: number | null;
    }[];
  }[];
  const hiitEffort = new Map<string, string | null>();
  for (const [k, v] of effortOn) {
    const [d, slot] = k.split("|");
    if (slot.startsWith("hiit:") || slot.startsWith("pick:")) hiitEffort.set(d, v);
  }
  const cardio: CardioSession[] = [];
  const conditioning: ConditioningSession[] = [];
  const entries = rows.map((r) => {
    const day = fromDateColumn(r.date);
    const secs = r.sets.reduce((t, x) => t + (x.seconds ?? 0), 0);
    const minutes = r.durationMin ?? (secs > 0 ? Math.round(secs / 60) : r.category === "HIIT" ? 15 : 0);
    const effort =
      r.category === "SPORT"
        ? (effortOn.get(`${day}|sport:${r.sourceEventId}`) ?? null)
        : r.category === "HIIT"
          ? (hiitEffort.get(day) ?? null)
          : (effortOn.get(`${day}|cardio:${r.id}`) ?? null);
    // A sport day goes by its sport, never the event's name (v0.673).
    const kind = r.category === "SPORT" ? sportDayLabel(r.name).toLowerCase() : KIND_WORD[r.category] ?? "cardio";
    const type = r.category === "SPORT" ? "sport" : r.category === "HIIT" ? "conditioning" : "cardio";
    if (CARDIO_CATEGORIES.includes(r.category)) {
      const sum = (k: "meters" | "distance") => {
        const xs = r.sets.map((x) => x[k]).filter((v): v is number => v != null && v > 0);
        return xs.length ? xs.reduce((t, v) => t + v, 0) : null;
      };
      const loads = r.sets.map((x) => x.weight).filter((v): v is number => v != null && v > 0);
      cardio.push({
        date: doneOn(r),
        activity: (["ROWING", "RUNNING", "RUCKING"].includes(r.category) ? r.category : "CARDIO") as CardioActivityKey,
        meters: sum("meters"),
        distance: sum("distance"),
        unit: r.sets.find((x) => x.distance != null)?.unit ?? null,
        seconds: secs > 0 ? secs : null,
        minutes,
        load: loads.length ? Math.max(...loads) : null,
        effort,
      });
    } else if (r.category === "HIIT") {
      conditioning.push({
        date: doneOn(r),
        name: r.name ?? "Conditioning",
        type: (r.workoutType as WorkoutType | null) ?? null,
        version: r.version,
        reps: r.sets[0]?.reps ?? null,
        seconds: r.sets[0]?.seconds ?? null,
        minutes,
      });
    }
    return { date: doneOn(r), minutes, effort, kind, type } as CardioEntry;
  });
  return { entries, cardio, conditioning };
}
