import "server-only";
import { adjustAnswer, adjustIsLight, parseAdjust, type Adjust } from "@/lib/workouts/adjust";
import { prisma } from "@/lib/prisma";
import { addDays, dayOfWeek, fromDateColumn, toDateColumn } from "@/lib/dates";
import type { MuscleGroup } from "@/lib/workouts/catalog";
import type { RepRecord } from "@/lib/workouts/records";
import {
  RULES,
  daySuggestion,
  lightFactor,
  movementSuggestion,
  type FeedbackIn,
  type SessionIn,
  type Suggestion,
} from "@/lib/workouts/suggest";
import { programIntentFor } from "@/lib/workouts/program-run";
import { soreSpotsFor } from "@/lib/workouts/sore-run";
import { SORE_LABEL } from "@/lib/workouts/sore";
import { loadsArea } from "@/lib/workouts/adjust";

/** The answers a person gave on a day: "<slot>|<key>" → answer. */
async function answersOn(userId: string, dateISO: string): Promise<Map<string, string>> {
  const rows = (await prisma.workoutSuggestionAnswer.findMany({
    where: { userId, date: toDateColumn(dateISO) },
    select: { key: true, slot: true, answer: true },
  })) as { key: string; slot: string; answer: string }[];
  return new Map(rows.map((r) => [`${r.slot}|${r.key}`, r.answer]));
}

/** How much lighter today is, when the person chose that (null: normal). */
export async function dayLightFactor(userId: string, dateISO: string): Promise<number | null> {
  const row = (await prisma.workoutSuggestionAnswer.findUnique({
    where: { userId_date_key_slot: { userId, date: toDateColumn(dateISO), key: "day", slot: "" } },
    select: { answer: true },
  })) as { answer: string } | null;
  return lightFactor(row?.answer);
}

/** Today's adjustment (v0.658; Go light before), or null. */
export async function dayAdjust(userId: string, dateISO: string): Promise<Adjust | null> {
  const row = (await prisma.workoutSuggestionAnswer.findUnique({
    where: { userId_date_key_slot: { userId, date: toDateColumn(dateISO), key: "day", slot: "" } },
    select: { answer: true },
  })) as { answer: string } | null;
  return parseAdjust(row?.answer);
}

/** Adjust today; replaces any earlier choice. */
export async function setAdjust(userId: string, dateISO: string, a: Adjust): Promise<void> {
  const date = toDateColumn(dateISO);
  const answer = adjustAnswer(a);
  await prisma.workoutSuggestionAnswer.upsert({
    where: { userId_date_key_slot: { userId, date, key: "day", slot: "" } },
    create: { userId, date, key: "day", slot: "", answer },
    update: { answer },
  });
}

/** Undo: today's plan comes back whole. */
export async function clearAdjust(userId: string, dateISO: string): Promise<void> {
  const date = toDateColumn(dateISO);
  const row = (await prisma.workoutSuggestionAnswer.findUnique({
    where: { userId_date_key_slot: { userId, date, key: "day", slot: "" } },
    select: { answer: true },
  })) as { answer: string } | null;
  if (parseAdjust(row?.answer)) {
    await prisma.workoutSuggestionAnswer.delete({
      where: { userId_date_key_slot: { userId, date, key: "day", slot: "" } },
    });
  }
}

/** LIGHT when today was made lighter, else the program's week (LIGHT/TEST). */
export async function dayIntentFor(userId: string, dateISO: string): Promise<"LIGHT" | "TEST" | null> {
  if ((await dayLightFactor(userId, dateISO)) || adjustIsLight(await dayAdjust(userId, dateISO))) return "LIGHT";
  return programIntentFor(userId, dateISO);
}

/**
 * Answer a suggestion: hides it for the day. "light" and "ease" also make the
 * whole day lighter (the loggers' hints drop to 80% / 90%). Saying it twice is
 * harmless, so a phone write queued offline is safe to replay.
 */
export async function answerSuggestion(
  userId: string,
  dateISO: string,
  key: string,
  slot: string,
  answer: string,
): Promise<void> {
  const date = toDateColumn(dateISO);
  const put = (k: string, s: string, a: string) =>
    prisma.workoutSuggestionAnswer.upsert({
      where: { userId_date_key_slot: { userId, date, key: k, slot: s } },
      create: { userId, date, key: k, slot: s, answer: a },
      update: { answer: a },
    });
  // "Work around it" (v0.675) makes today a Hurt day on that area, with stand-ins.
  if (answer.startsWith("around:")) {
    const { applyAdjust } = await import("@/lib/workouts/adjust-run");
    await put(key.slice(0, 40), slot.slice(0, 60), "around");
    await applyAdjust(userId, dateISO, { mode: "hurt", area: answer.slice(7), replace: true });
    return;
  }
  await put(key.slice(0, 40), slot.slice(0, 60), answer.slice(0, 20));
  if (answer === "light" || answer === "ease") await put("day", "", answer);
}

/** The first sore spot today's plan loads, with those moves (v0.675). */
async function soreToday(userId: string, dateISO: string): Promise<{ area: string; label: string; moves: string[] } | null> {
  const spots = await soreSpotsFor(userId);
  if (spots.length === 0) return null;
  const plans = (await prisma.plannedWorkout.findMany({
    where: { userId, dayOfWeek: dayOfWeek(dateISO), isRest: false, category: "WEIGHTS" as never, createdAt: { lt: toDateColumn(addDays(dateISO, 1)) } },
    select: { muscleGroup: true, core: true, exercises: { orderBy: { sortOrder: "asc" }, select: { poolExercise: { select: { name: true } } } } },
  })) as { muscleGroup: string | null; core: unknown; exercises: { poolExercise: { name: string } }[] }[];
  for (const s of spots) {
    const moves = plans.flatMap((p) =>
      p.exercises.map((e) => e.poolExercise.name).filter((n) => loadsArea(s.area, n, p.core != null ? null : p.muscleGroup)),
    );
    if (moves.length) return { area: s.area, label: SORE_LABEL[s.area], moves: [...new Set(moves)] };
  }
  return null;
}

async function recentFeedback(userId: string, dateISO: string): Promise<FeedbackIn[]> {
  const rows = (await prisma.workoutFeedback.findMany({
    where: {
      userId,
      date: { gte: toDateColumn(addDays(dateISO, -RULES.hardDays - 4)), lte: toDateColumn(dateISO) },
    },
    select: { date: true, effort: true, hurt: true, slot: true },
  })) as { date: Date; effort: string | null; hurt: string | null; slot: string }[];
  // What each answer was about: a movement's muscle group, or cardio /
  // conditioning / sport (v0.619).
  const ids = [...new Set(rows.map((r) => r.slot).filter((x) => !x.includes(":")))];
  const groups = new Map(
    (ids.length
      ? ((await prisma.poolExercise.findMany({ where: { id: { in: ids } }, select: { id: true, muscleGroup: true } })) as {
          id: string;
          muscleGroup: string | null;
        }[])
      : []
    ).map((p) => [p.id, p.muscleGroup]),
  );
  const kind = (slot: string) =>
    slot.startsWith("cardio:") ? "CARDIO" : slot.startsWith("hiit:") ? "HIIT" : slot.startsWith("sport:") ? "SPORT" : groups.get(slot) ?? null;
  return rows.map((r) => ({ date: fromDateColumn(r.date), effort: r.effort, hurt: r.hurt, group: kind(r.slot) }));
}

/** The latest day a person started a program or got new plan entries. */
async function planChangedOn(userId: string): Promise<string | null> {
  const [program, plan] = (await Promise.all([
    prisma.personProgram.findFirst({ where: { userId }, orderBy: { startedOn: "desc" }, select: { startedOn: true } }),
    prisma.plannedWorkout.findFirst({ where: { userId }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
  ])) as [{ startedOn: Date } | null, { createdAt: Date } | null];
  const a = program ? fromDateColumn(program.startedOn) : null;
  const b = plan ? plan.createdAt.toISOString().slice(0, 10) : null;
  return a && b ? (a > b ? a : b) : a ?? b;
}

/** The day page's card for a person and day (at most one). */
export async function daySuggestionFor(userId: string, dateISO: string): Promise<Suggestion | null> {
  const [answers, feedback, last, intent, changed, sore] = await Promise.all([
    answersOn(userId, dateISO),
    recentFeedback(userId, dateISO),
    prisma.workoutSession.findFirst({
      where: { userId, isRest: false, date: { lt: toDateColumn(dateISO) } },
      orderBy: { date: "desc" },
      select: { date: true },
    }) as Promise<{ date: Date } | null>,
    programIntentFor(userId, dateISO),
    planChangedOn(userId),
    soreToday(userId, dateISO),
  ]);
  const answered = new Set([...answers.keys()].filter((k) => k.startsWith("|")).map((k) => k.slice(1)));
  return daySuggestion({
    sore,
    planChangedOn: changed,
    today: dateISO,
    lastTrained: last ? fromDateColumn(last.date) : null,
    feedback,
    light: answers.has("|day"),
    programIntent: intent,
    answered,
  });
}

/**
 * One movement's card, and its recent top for the big-jump note. `movement`
 * is what's being done (a swap's id when swapped); `slot` the planned one.
 */
export async function movementSuggestionFor(input: {
  userId: string;
  dateISO: string;
  slot: string;
  movement: string;
  hasTarget: boolean;
  records: readonly RepRecord[];
  lower: boolean;
  unit: string;
}): Promise<{ suggestion: Suggestion | null; recentTop: number | null }> {
  const { userId, dateISO, slot, movement } = input;
  const [answers, feedback, pool, sets, sore] = await Promise.all([
    answersOn(userId, dateISO),
    recentFeedback(userId, dateISO),
    prisma.poolExercise.findUnique({ where: { id: movement }, select: { name: true, muscleGroup: true } }) as Promise<{
      name: string;
      muscleGroup: string | null;
    } | null>,
    prisma.sessionSet.findMany({
      where: {
        poolExerciseId: movement,
        session: {
          userId,
          isRest: false,
          date: { lt: toDateColumn(dateISO), gte: toDateColumn(addDays(dateISO, -7 * (RULES.stallWeeks + 2))) },
        },
      },
      orderBy: [{ setNumber: "asc" }],
      select: { weight: true, reps: true, session: { select: { date: true } } },
    }) as Promise<{ weight: number | null; reps: number | null; session: { date: Date } }[]>,
    soreSpotsFor(userId),
  ]);

  const byDay = new Map<string, SessionIn["sets"][number][]>();
  for (const s of sets) {
    const d = fromDateColumn(s.session.date);
    const list = byDay.get(d) ?? [];
    list.push({ weight: s.weight, reps: s.reps });
    byDay.set(d, list);
  }
  const efforts = (await prisma.workoutFeedback.findMany({
    where: { userId, slot, date: { in: [...byDay.keys()].map(toDateColumn) } },
    select: { date: true, effort: true },
  })) as { date: Date; effort: string | null }[];
  const effortOn = new Map(efforts.map((e) => [fromDateColumn(e.date), e.effort]));
  const history: SessionIn[] = [...byDay.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([date, list]) => ({ date, sets: list, effort: effortOn.get(date) ?? null }));

  const recentFrom = addDays(dateISO, -RULES.recentDays);
  const recentTop =
    history
      .filter((h) => h.date >= recentFrom)
      .flatMap((h) => h.sets.map((s) => s.weight ?? 0))
      .reduce((m, w) => Math.max(m, w), 0) || null;

  const lastBestOn = input.records.reduce<string | null>((m, r) => (m == null || r.date > m ? r.date : m), null);
  const answered = new Set(
    [...answers.keys()].filter((k) => k.startsWith(`${slot}|`)).map((k) => k.slice(slot.length + 1)),
  );
  const suggestion = movementSuggestion({
    today: dateISO,
    name: pool?.name ?? "this",
    muscleGroup: (pool?.muscleGroup as MuscleGroup | null) ?? null,
    history,
    hasTarget: input.hasTarget,
    lower: input.lower,
    unit: input.unit,
    feedback,
    lastBestOn,
    answered,
    sore,
  });
  return { suggestion, recentTop };
}
