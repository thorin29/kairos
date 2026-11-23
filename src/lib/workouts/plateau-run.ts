/**
 * The plateau card (v0.752): the data behind it and its answers. Rules in
 * plateau.ts.
 */
import { prisma } from "@/lib/prisma";
import { addDays, fromDateColumn, toDateColumn } from "@/lib/dates";
import { getSetting, setSetting } from "@/lib/settings";
import { loadActivePrograms } from "@/lib/workouts/program-run";
import { programByKey } from "@/lib/workouts/programs";
import { MAIN_GROUPS, PLATEAU, plateauGroups, plateauText, type PlateauGroup, type PlateauSet } from "@/lib/workouts/plateau";

export type Plateau = {
  title: string;
  why: string;
  groups: PlateauGroup[];
  /** Your own plan: a program to try, with its preview. Null when a program
   *  that runs on is the plan (the card offers New plan instead). */
  program: { key: string; name: string; blurb: string; days: string[]; weeks: number } | null;
};

/** The program suggested to your own plan. */
const TRY = "wendler-531";

const snoozeKey = (userId: string) => `workouts.plateau.${userId}`;

export async function plateauFor(userId: string, today: string): Promise<Plateau | null> {
  const snooze = await getSetting(snoozeKey(userId));
  if (snooze && today < snooze) return null;
  const programs = await loadActivePrograms(userId);
  // A program with training maxes checks each lift at the end of its cycle.
  if (programs.some((p) => Object.keys(p.trainingMaxes).length > 0)) return null;
  // A program started inside the window hasn't had its 4 weeks.
  const from = addDays(today, -7 * PLATEAU.weeks);
  if (programs.some((p) => p.startedOn > from)) return null;

  const rows = (await prisma.sessionSet.findMany({
    where: {
      weight: { gt: 0 },
      reps: { gt: 0 },
      poolExercise: { muscleGroup: { in: [...MAIN_GROUPS] as never } },
      session: { userId, isRest: false, date: { gte: toDateColumn(addDays(today, -7 * 16)), lte: toDateColumn(today) } },
    },
    select: {
      weight: true,
      reps: true,
      poolExerciseId: true,
      poolExercise: { select: { name: true, muscleGroup: true } },
      session: { select: { date: true } },
    },
  })) as {
    weight: number | null;
    reps: number | null;
    poolExerciseId: string | null;
    poolExercise: { name: string; muscleGroup: string | null } | null;
    session: { date: Date };
  }[];
  const sets: PlateauSet[] = rows
    .filter((r) => r.poolExerciseId && r.poolExercise?.muscleGroup)
    .map((r) => ({
      poolExerciseId: r.poolExerciseId as string,
      name: r.poolExercise!.name,
      group: r.poolExercise!.muscleGroup as string,
      date: fromDateColumn(r.session.date),
      weight: r.weight,
      reps: r.reps,
    }));
  const groups = plateauGroups(sets, today);
  if (groups.length === 0) return null;
  const p = programs.length === 0 ? programByKey(TRY) : null;
  return {
    ...plateauText(groups),
    groups,
    program: p ? { key: p.key, name: p.name, blurb: p.blurb, days: p.days.map((d) => d.name), weeks: p.weeks } : null,
  };
}

/**
 * Answer the card: "light" makes the next 7 days light (60%, days already
 * adjusted are left alone); "keep" and "swap" just hide it. Every answer
 * asks again 4 weeks later (after the light week, for "light"). Starting a
 * program hides it on its own: a program 4 weeks old or less isn't checked.
 */
export async function answerPlateau(userId: string, today: string, answer: string): Promise<void> {
  if (answer === "light") {
    for (let i = 0; i < PLATEAU.lightDays; i++) {
      const date = toDateColumn(addDays(today, i));
      const has = await prisma.workoutSuggestionAnswer.findUnique({
        where: { userId_date_key_slot: { userId, date, key: "day", slot: "" } },
        select: { answer: true },
      });
      if (!has) await prisma.workoutSuggestionAnswer.create({ data: { userId, date, key: "day", slot: "", answer: "deload" } });
    }
  }
  const after = answer === "light" ? PLATEAU.lightDays : 0;
  await setSetting(snoozeKey(userId), addDays(today, after + 7 * PLATEAU.snoozeWeeks));
}
