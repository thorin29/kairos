import "server-only";
import { prisma } from "@/lib/prisma";
import { addDays, fromDateColumn, toDateColumn } from "@/lib/dates";
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

/** LIGHT when today was made lighter, else the program's week (LIGHT/TEST). */
export async function dayIntentFor(userId: string, dateISO: string): Promise<"LIGHT" | "TEST" | null> {
  if (await dayLightFactor(userId, dateISO)) return "LIGHT";
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
  await put(key.slice(0, 40), slot.slice(0, 60), answer.slice(0, 20));
  if (answer === "light" || answer === "ease") await put("day", "", answer);
}

async function recentFeedback(userId: string, dateISO: string): Promise<FeedbackIn[]> {
  const rows = (await prisma.workoutFeedback.findMany({
    where: {
      userId,
      date: { gte: toDateColumn(addDays(dateISO, -RULES.hardDays - 4)), lte: toDateColumn(dateISO) },
    },
    select: { date: true, effort: true, hurt: true },
  })) as { date: Date; effort: string | null; hurt: string | null }[];
  return rows.map((r) => ({ date: fromDateColumn(r.date), effort: r.effort, hurt: r.hurt }));
}

/** The day page's card for a person and day (at most one). */
export async function daySuggestionFor(userId: string, dateISO: string): Promise<Suggestion | null> {
  const [answers, feedback, last, intent] = await Promise.all([
    answersOn(userId, dateISO),
    recentFeedback(userId, dateISO),
    prisma.workoutSession.findFirst({
      where: { userId, isRest: false, date: { lt: toDateColumn(dateISO) } },
      orderBy: { date: "desc" },
      select: { date: true },
    }) as Promise<{ date: Date } | null>,
    programIntentFor(userId, dateISO),
  ]);
  const answered = new Set([...answers.keys()].filter((k) => k.startsWith("|")).map((k) => k.slice(1)));
  return daySuggestion({
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
  const [answers, feedback, pool, sets] = await Promise.all([
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
  });
  return { suggestion, recentTop };
}
