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
  planFit,
  pushPullBalance,
  type BalanceInput,
  type SportInput,
  type TooBigInput,
  type FeedbackIn,
  type SessionIn,
  type Suggestion,
} from "@/lib/workouts/suggest";
import { programIntentFor } from "@/lib/workouts/program-run";
import { soreSpotsFor } from "@/lib/workouts/sore-run";
import { SORE_LABEL } from "@/lib/workouts/sore";
import { loadsArea } from "@/lib/workouts/adjust";
import { getSetting, setSetting } from "@/lib/settings";
import { sportDaysBetween } from "@/lib/sport/day";
import { tournamentDays } from "@/lib/sport/label";
import { guessPattern } from "@/lib/workouts/library";
import { OPTIONAL_CATEGORIES } from "@/lib/workouts/blocks";

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
  // Hockey (v0.676): lighter legs, or legs swapped out, for a game.
  if (answer === "legs:light" || answer === "legs:swap") {
    const { applyAdjust } = await import("@/lib/workouts/adjust-run");
    await put(key.slice(0, 40), slot.slice(0, 60), "legs");
    await applyAdjust(
      userId,
      dateISO,
      answer === "legs:light" ? { mode: "legs" } : { mode: "hurt", area: "LEGS", why: "game", replace: true },
    );
    return;
  }
  // A tournament: lighter from today through the next three days.
  if (answer === "lightweek") {
    for (let i = 0; i < 4; i++) {
      const d = toDateColumn(addDays(dateISO, i));
      const has = await prisma.workoutSuggestionAnswer.findUnique({
        where: { userId_date_key_slot: { userId, date: d, key: "day", slot: "" } },
        select: { answer: true },
      });
      if (!has) await prisma.workoutSuggestionAnswer.create({ data: { userId, date: d, key: "day", slot: "", answer: "light" } });
      await prisma.workoutSuggestionAnswer.upsert({
        where: { userId_date_key_slot: { userId, date: d, key: "tournament", slot: "" } },
        create: { userId, date: d, key: "tournament", slot: "", answer: "lightweek" },
        update: { answer: "lightweek" },
      });
    }
    return;
  }
  // Plan too big: asked again in three weeks, whichever way it was answered.
  if (key === "toobig") await setSetting(tooBigKey(userId), addDays(dateISO, 7 * RULES.tooBigWeeks));
  // Balance (v0.676): a pull added to today only.
  if (answer.startsWith("add:")) {
    await put(key.slice(0, 40), slot.slice(0, 60), "add");
    await put("add", answer.slice(4, 64), "yes");
    return;
  }
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

const tooBigKey = (userId: string) => `workouts.toobig.${userId}`;

/** Movements added to a day from a suggestion (v0.676), by pool id. */
export async function dayAddedIds(userId: string, dateISO: string): Promise<string[]> {
  const rows = (await prisma.workoutSuggestionAnswer.findMany({
    where: { userId, date: toDateColumn(dateISO), key: "add" },
    select: { slot: true },
  })) as { slot: string }[];
  return rows.map((r) => r.slot).filter(Boolean);
}

type WeightPlan = { muscleGroup: string | null; core: unknown; exercises: { poolExercise: { name: string; pattern: string | null } }[] };

async function todaysLifts(userId: string, dateISO: string): Promise<WeightPlan[]> {
  return (await prisma.plannedWorkout.findMany({
    where: { userId, dayOfWeek: dayOfWeek(dateISO), isRest: false, category: "WEIGHTS" as never, createdAt: { lt: toDateColumn(addDays(dateISO, 1)) } },
    select: {
      muscleGroup: true,
      core: true,
      exercises: { orderBy: { sortOrder: "asc" }, select: { poolExercise: { select: { name: true, pattern: true } } } },
    },
  })) as WeightPlan[];
}

/** Games today, tomorrow and a tournament around today (v0.676). */
async function sportAround(userId: string, dateISO: string): Promise<SportInput | null> {
  const list = await sportDaysBetween(userId, addDays(dateISO, -3), addDays(dateISO, 3));
  if (list.length === 0) return null;
  const on = (d: string) => list.find((x) => x.date === d && x.kind === "GAME") ?? list.find((x) => x.date === d) ?? null;
  const games = list.filter((x) => x.kind === "GAME").map((x) => x.date);
  const tour = new Set(tournamentDays(games));
  // In one, or one starts within three days: count its games around today.
  const ahead = [...tour].some((d) => d >= dateISO && d <= addDays(dateISO, 3));
  const near = games.filter((d) => tour.has(d) && d >= addDays(dateISO, -3) && d <= addDays(dateISO, 3));
  const t = on(dateISO);
  const m = on(addDays(dateISO, 1));
  return {
    today: t ? { kind: t.kind, label: t.label } : null,
    tomorrow: m ? { kind: m.kind, label: m.label } : null,
    tournamentGames: ahead ? near.length : 0,
  };
}

/** Planned days against done days over the last three weeks (v0.676). */
async function planFitFor(userId: string, dateISO: string): Promise<TooBigInput | null> {
  const snooze = await getSetting(tooBigKey(userId));
  if (snooze && snooze > dateISO) return null;
  const from = addDays(dateISO, -7 * RULES.tooBigWeeks);
  const [plans, sessions] = (await Promise.all([
    prisma.plannedWorkout.findMany({
      where: { userId, isRest: false },
      select: { dayOfWeek: true, category: true, createdAt: true },
    }),
    prisma.workoutSession.findMany({
      where: { userId, date: { gte: toDateColumn(from), lt: toDateColumn(dateISO) } },
      select: { date: true },
    }),
  ])) as [{ dayOfWeek: number; category: string | null; createdAt: Date }[], { date: Date }[]];
  const done = new Set(sessions.map((s) => fromDateColumn(s.date)));
  const out: { date: string; planned: boolean; done: boolean }[] = [];
  for (let d = from; d < dateISO; d = addDays(d, 1)) {
    const end = Date.parse(`${addDays(d, 1)}T00:00:00Z`);
    const planned = plans.some(
      (p) => p.dayOfWeek === dayOfWeek(d) && p.createdAt.getTime() < end && !(p.category && OPTIONAL_CATEGORIES.includes(p.category)),
    );
    out.push({ date: d, planned, done: done.has(d) });
  }
  return planFit(out);
}

/** Pressing against pulling, and a pull to add today (v0.676). */
async function balanceFor(userId: string, dateISO: string, plans: WeightPlan[]): Promise<BalanceInput | null> {
  if (plans.length === 0) return null;
  const pat = (name: string, p: string | null) => p ?? guessPattern(name);
  if (plans.some((p) => p.exercises.some((e) => pat(e.poolExercise.name, e.poolExercise.pattern) === "PULL"))) return null;
  if ((await dayAddedIds(userId, dateISO)).length > 0) return null;
  const rows = (await prisma.sessionSet.findMany({
    where: {
      finished: true,
      poolExerciseId: { not: null },
      session: { userId, isRest: false, date: { gte: toDateColumn(addDays(dateISO, -56)), lt: toDateColumn(dateISO) } },
    },
    select: { poolExerciseId: true, poolExercise: { select: { name: true, pattern: true } }, session: { select: { date: true } } },
  })) as { poolExerciseId: string; poolExercise: { name: string; pattern: string | null } | null; session: { date: Date } }[];
  const sets = rows
    .filter((r) => r.poolExercise)
    .map((r) => ({ id: r.poolExerciseId, name: r.poolExercise!.name, date: fromDateColumn(r.session.date), pattern: pat(r.poolExercise!.name, r.poolExercise!.pattern) }));
  const b = pushPullBalance(sets, dateISO);
  if (!b) return null;
  // The pull done most in eight weeks, else a row from the movement list.
  const pulls = new Map<string, { name: string; n: number }>();
  for (const s of sets) if (s.pattern === "PULL") pulls.set(s.id, { name: s.name, n: (pulls.get(s.id)?.n ?? 0) + 1 });
  let pick = [...pulls].sort((a, b2) => b2[1].n - a[1].n)[0];
  if (!pick) {
    const pool = (await prisma.poolExercise.findMany({
      where: { isActive: true },
      select: { id: true, name: true, pattern: true },
    })) as { id: string; name: string; pattern: string | null }[];
    const cands = pool.filter((p) => pat(p.name, p.pattern) === "PULL").sort((a, b2) => Number(/row/i.test(b2.name)) - Number(/row/i.test(a.name)));
    if (cands[0]) pick = [cands[0].id, { name: cands[0].name, n: 0 }];
  }
  if (!pick) return null;
  return { ...b, pick: { id: pick[0], name: pick[1].name } };
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
  const lifts = await todaysLifts(userId, dateISO);
  const [answers, feedback, last, intent, changed, sore, sport, tooBig, balance] = await Promise.all([
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
    sportAround(userId, dateISO),
    planFitFor(userId, dateISO),
    balanceFor(userId, dateISO, lifts),
  ]);
  const legMoves = [
    ...new Set(
      lifts.flatMap((p) =>
        p.exercises.map((e) => e.poolExercise.name).filter((n) => loadsArea("LEGS", n, p.core != null ? null : p.muscleGroup)),
      ),
    ),
  ];
  const answered = new Set([...answers.keys()].filter((k) => k.startsWith("|")).map((k) => k.slice(1)));
  return daySuggestion({
    sore,
    sport,
    legMoves,
    lifting: lifts.some((p) => p.exercises.length > 0),
    tooBig,
    balance,
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
