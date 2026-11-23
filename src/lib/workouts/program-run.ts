import "server-only";
import { planDow } from "@/lib/workouts/day-swap-run";
import { prisma } from "@/lib/prisma";
import { addDays, dayOfWeek, fromDateColumn, startOfWeek, toDateColumn, todayISO } from "@/lib/dates";
import { generateWorkoutTasks } from "@/lib/workouts/generate";
import { MUSCLE_GROUP_LABEL, type MuscleGroup } from "@/lib/workouts/catalog";
import { loadWeightUnits } from "@/lib/queries/workouts";
import { getSetting, setSetting } from "@/lib/settings";
import { savePlan } from "@/lib/workouts/plan-share-run";
import { LIBRARY, guessPattern, nameKey } from "@/lib/workouts/library";
import { applyLibrary, loadEquipment } from "@/lib/workouts/library-run";
import { routineFor, routinesFor } from "@/lib/workouts/warmup-run";
import { cleanVersion, setupDiffers, type ProgramVersion } from "@/lib/workouts/program-version";
import { extraSlotFor } from "@/lib/workouts/day-extras-run";
import { setCoreDay } from "@/lib/workouts/core-run";
import { rotationLibrary } from "@/lib/workouts/core-library";
import { cleanOtherKind, otherKindOf, setupRow, splitOther } from "@/lib/workouts/other-days";
import { libraryRoutinesOf } from "@/lib/workouts/warmup-library";
import {
  GARAGE_FEET,
  PROGRAMS,
  cleanPlanScheme,
  stepFor,
  blocksDone,
  programByKey,
  programWeek,
  raisedMaxes,
  schemeKey,
  trainingMaxFrom,
  weekIntent,
  weekLabel,
  HARDER,
  feltEasy,
  ladderCheck,
  ladderStepAfter,
  lastHeavyWeek,
  waveCheck,
  type Program,
  type ProgramRole,
} from "@/lib/workouts/programs";

type ProgramRow = {
  id: string;
  programKey: string;
  startedOn: Date;
  blockStartedOn: Date;
  days: string;
  trainingMaxes: unknown;
  previousPlan: unknown;
  cycle?: number;
  lastRaises?: unknown;
};

export type ActiveProgram = {
  id: string;
  program: Program;
  startedOn: string;
  blockStartedOn: string;
  days: number[];
  trainingMaxes: Record<string, number>;
  /** v0.748: the cycle (1 at the start) and what each main lift went up by
   *  when it began. */
  cycle: number;
  lastRaises: Record<string, number>;
};

/** The person's running programs (v0.749: two can run at once), the first
 *  started first: it's the plan's own program (other days, warm-up, cardio). */
export async function loadActivePrograms(userId: string): Promise<ActiveProgram[]> {
  const rows = (await prisma.personProgram.findMany({
    where: { userId, status: "ACTIVE" },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      programKey: true,
      startedOn: true,
      blockStartedOn: true,
      days: true,
      trainingMaxes: true,
      previousPlan: true,
      cycle: true,
      lastRaises: true,
    },
  })) as ProgramRow[];
  return rows.map(toActive).filter((p): p is ActiveProgram => !!p);
}

/** The person's first running program, if any. */
export async function loadActiveProgram(userId: string): Promise<ActiveProgram | null> {
  const row = (await prisma.personProgram.findFirst({
    where: { userId, status: "ACTIVE" },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      programKey: true,
      startedOn: true,
      blockStartedOn: true,
      days: true,
      trainingMaxes: true,
      previousPlan: true,
      cycle: true,
      lastRaises: true,
    },
  })) as ProgramRow | null;
  return row ? toActive(row) : null;
}

function numbersOf(v: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (v && typeof v === "object") for (const [k, n] of Object.entries(v as Record<string, unknown>)) if (typeof n === "number" && n > 0) out[k] = n;
  return out;
}

function toActive(row: ProgramRow): ActiveProgram | null {
  const program = programByKey(row.programKey);
  if (!program) return null;
  const tm: Record<string, number> = {};
  if (row.trainingMaxes && typeof row.trainingMaxes === "object") {
    for (const [k, v] of Object.entries(row.trainingMaxes as Record<string, unknown>)) {
      if (typeof v === "number" && v > 0) tm[k] = v;
    }
  }
  return {
    id: row.id,
    program,
    startedOn: fromDateColumn(row.startedOn),
    blockStartedOn: fromDateColumn(row.blockStartedOn),
    days: row.days.split(",").map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6),
    trainingMaxes: tm,
    cycle: typeof row.cycle === "number" && row.cycle > 0 ? row.cycle : 1,
    lastRaises: numbersOf(row.lastRaises),
  };
}

/** The program running on a day: the active one from its start, else an
 *  earlier one that was running then (changed or ended since) (v0.627). */
async function loadProgramOn(userId: string, dateISO: string): Promise<ActiveProgram | null> {
  const rows = (await prisma.personProgram.findMany({
    where: { userId, startedOn: { lte: toDateColumn(dateISO) } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      programKey: true,
      startedOn: true,
      blockStartedOn: true,
      days: true,
      trainingMaxes: true,
      previousPlan: true,
      status: true,
      endedOn: true,
      cycle: true,
      lastRaises: true,
    },
  })) as (ProgramRow & { status: string; endedOn: Date | null })[];
  const row = rows.find((r) =>
    r.status === "ACTIVE" ? true : r.endedOn != null && dateISO < fromDateColumn(r.endedOn),
  );
  return row ? toActive(row) : null;
}

/** What the day page and the Workouts page say about a person's program. */
export type ProgramInfo = {
  /** The PersonProgram row (v0.749): which program, when two run at once. */
  id: string;
  key: string;
  name: string;
  week: number;
  weeks: number;
  /** "Week 2 of 4", "Week 4 of 4 · light". */
  label: string;
  intent: "LIGHT" | "TEST" | null;
  /** A block finished and nobody chose what's next yet. */
  blockDone: boolean;
  /** Main lifts and their training maxes, for the program card; `step` is
   *  the end-of-cycle raise it starts at (10 lb lower body, 5 upper). */
  maxes: { poolExerciseId: string; name: string; weight: number; step: number }[];
  /** v0.748: the cycle (1 at the start), and what each main lift went up by
   *  when it began (the success marks; empty on cycle 1). */
  cycle: number;
  lastRaises: Record<string, number>;
  /** With `blockDone`: each main lift's suggestion for the next cycle. */
  check: { poolExerciseId: string; suggest: number; reason: string }[];
  /** With `blockDone`, when the cycle felt easy: a harder program to try. */
  harder: { key: string; name: string; blurb: string; days: string[]; weeks: number } | null;
};

/**
 * The program as the day page shows it (v0.663): only on a weekday the
 * program put work on. A day with only its own entries (a Core day beside
 * 5/3/1) is titled by what's planned, not by the program.
 */
export async function dayProgramInfo(userId: string, dateISO: string): Promise<ProgramInfo | null> {
  const p = await programInfoFor(userId, dateISO);
  return p && (await dayHasProgramWork(userId, dateISO)) ? p : null;
}

/** The program put work on this weekday (an entry with a program lift). */
export async function dayHasProgramWork(userId: string, dateISO: string): Promise<boolean> {
  const n = (await prisma.plannedExercise.count({
    where: { programRole: { not: null }, plannedWorkout: { userId, dayOfWeek: await planDow(userId, dateISO), isRest: false } },
  })) as number;
  return n > 0;
}

export async function programInfoFor(userId: string, dateISO: string): Promise<ProgramInfo | null> {
  // The program running that day: a day before it started isn't part of it
  // (v0.625), but one an earlier program covered is (v0.627).
  const p = await loadProgramOn(userId, dateISO);
  if (!p || dateISO < p.startedOn) return null;
  return infoOf(userId, p, dateISO);
}

/** The programs running beside the first (v0.749), each with its setup. */
export async function alsoPrograms(userId: string): Promise<(ProgramInfo & { setup: CurrentSetup | null })[]> {
  const today = todayISO();
  const rest = (await loadActivePrograms(userId)).slice(1);
  return Promise.all(rest.map(async (p) => ({ ...(await infoOf(userId, p, today)), setup: await currentSetup(userId, p) })));
}

/** Every running program (v0.749), the first started first. */
export async function programInfosFor(userId: string, dateISO: string): Promise<ProgramInfo[]> {
  const all = (await loadActivePrograms(userId)).filter((p) => p.startedOn <= dateISO);
  return Promise.all(all.map((p) => infoOf(userId, p, dateISO)));
}

async function infoOf(userId: string, p: ActiveProgram, dateISO: string): Promise<ProgramInfo> {
  const week = programWeek(p.program, p.blockStartedOn, dateISO);
  const ids = Object.keys(p.trainingMaxes);
  const names = ids.length
    ? ((await prisma.poolExercise.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } })) as {
        id: string;
        name: string;
      }[])
    : [];
  const steps = ids.length ? await raiseSteps(userId, p.program) : {};
  const blockDone = blocksDone(p.program, p.blockStartedOn, dateISO) > 0;
  return {
    id: p.id,
    key: p.program.key,
    name: p.program.name,
    week,
    weeks: p.program.weeks,
    label: weekLabel(p.program, week),
    intent: weekIntent(p.program, week),
    blockDone,
    maxes: ids.map((id) => ({
      poolExerciseId: id,
      name: names.find((n) => n.id === id)?.name ?? "",
      weight: p.trainingMaxes[id],
      step: steps[id] ?? 5,
    })),
    cycle: p.cycle,
    lastRaises: p.lastRaises,
    ...(blockDone ? await cycleCheck(userId, p, steps) : { check: [], harder: null }),
  };
}

/** Each planned program lift's raise step: 10 lb lower body, 5 upper; half in kg. */
/**
 * What's next at the end of a cycle (v0.748): each main lift's suggestion
 * from the cycle just finished, and a harder program when it felt easy.
 * 5/3/1-style lifts go by the heaviest set (the + set) of the last heavy
 * week; Odd squad's by whether every ladder got done; anything else by its
 * usual step.
 */
async function cycleCheck(
  userId: string,
  p: ActiveProgram,
  steps: Record<string, number>,
): Promise<Pick<ProgramInfo, "check" | "harder">> {
  const ids = Object.keys(p.trainingMaxes);
  const start = p.blockStartedOn;
  const end = addDays(start, 7 * p.program.weeks);
  const [roles, sets, feel] = (await Promise.all([
    prisma.plannedExercise.findMany({
      where: { plannedWorkout: { userId }, programRole: { not: null }, poolExerciseId: { in: ids } },
      select: { poolExerciseId: true, programRole: true },
    }),
    prisma.sessionSet.findMany({
      where: { poolExerciseId: { in: ids }, session: { userId, isRest: false, date: { gte: toDateColumn(start), lt: toDateColumn(end) } } },
      select: { poolExerciseId: true, reps: true, weight: true, setNumber: true, session: { select: { date: true } } },
    }),
    prisma.workoutFeedback.findMany({
      where: { userId, date: { gte: toDateColumn(start), lt: toDateColumn(end) } },
      select: { effort: true },
    }),
  ])) as [
    { poolExerciseId: string; programRole: string | null }[],
    { poolExerciseId: string | null; reps: number | null; weight: number | null; setNumber: number; session: { date: Date } }[],
    { effort: string | null }[],
  ];
  const allRoles = p.program.days.flatMap((d) => d.roles);
  const heavy = lastHeavyWeek(p.program);
  const check = ids.map((id) => {
    const step = steps[id] ?? 5;
    const role = allRoles.find((r) => r.key === roles.find((x) => x.poolExerciseId === id)?.programRole);
    const mine = sets.filter((x) => x.poolExerciseId === id);
    if (role?.scheme.kind === "LADDER") {
      const byWeek = new Map<number, number>();
      for (const x of mine) {
        const w = programWeek(p.program, start, fromDateColumn(x.session.date));
        byWeek.set(w, (byWeek.get(w) ?? 0) + (x.reps ?? 0));
      }
      return { poolExerciseId: id, ...ladderCheck(step, ladderStepAfter(byWeek, p.program.weeks + 1, role.scheme.cap)) };
    }
    if (role?.scheme.kind === "WAVE") {
      const week = mine.filter((x) => programWeek(p.program, start, fromDateColumn(x.session.date)) === heavy);
      const lastDay = week.reduce<string | null>((d, x) => {
        const iso = fromDateColumn(x.session.date);
        return !d || iso > d ? iso : d;
      }, null);
      const day = week.filter((x) => fromDateColumn(x.session.date) === lastDay);
      // The + set is the day's heaviest (the last of them if several).
      const top = day.reduce<(typeof day)[number] | null>(
        (b, x) => (!b || (x.weight ?? 0) > (b.weight ?? 0) || ((x.weight ?? 0) === (b.weight ?? 0) && x.setNumber > b.setNumber) ? x : b),
        null,
      );
      return { poolExerciseId: id, ...waveCheck(top ? (top.reps ?? 0) : null, step) };
    }
    return { poolExerciseId: id, suggest: step, reason: "" };
  });
  const harderKey = feltEasy(feel.map((f) => f.effort)) ? HARDER[p.program.key] : undefined;
  const h = harderKey ? programByKey(harderKey) : null;
  return {
    check,
    harder: h ? { key: h.key, name: h.name, blurb: h.blurb, days: h.days.map((d) => d.name), weeks: h.weeks } : null,
  };
}

async function raiseSteps(userId: string, program: Program): Promise<Record<string, number>> {
  const units = await loadWeightUnits();
  const rows = (await prisma.plannedExercise.findMany({
    where: { plannedWorkout: { userId }, programRole: { not: null } },
    select: { poolExerciseId: true, programRole: true, plannedWorkout: { select: { muscleGroup: true } } },
  })) as { poolExerciseId: string; programRole: string | null; plannedWorkout: { muscleGroup: string | null } }[];
  const out: Record<string, number> = {};
  for (const r of rows) {
    const role = program.days.flatMap((d) => d.roles).find((x) => x.key === r.programRole);
    const mg = r.plannedWorkout.muscleGroup as MuscleGroup | null;
    const unit = (mg && units[mg]) || "lb";
    const step = stepFor(role?.lower, unit);
    out[r.poolExerciseId] = Math.max(out[r.poolExerciseId] ?? 0, step);
  }
  return out;
}

/** LIGHT / TEST for a day in an active program's light or test week; null otherwise. */
export async function programIntentFor(userId: string, dateISO: string): Promise<"LIGHT" | "TEST" | null> {
  const p = await loadActiveProgram(userId);
  if (!p || dateISO < p.startedOn) return null;
  return weekIntent(p.program, programWeek(p.program, p.blockStartedOn, dateISO));
}

// --- the setup screen -------------------------------------------------------------

export type ProgramChoice = {
  key: string;
  name: string;
  blurb: string;
  weeks: number;
  defaultDays: number[];
  /** Set up with the block builder (Odd squad, v0.732). */
  builder?: boolean;
  days: {
    name: string;
    row: boolean;
    roles: {
      key: string;
      label: string;
      muscleGroup: MuscleGroup;
      main: boolean;
      optional: boolean;
      scheme: string;
      /** The builder's block ("A", "B", "C"). */
      block?: string;
      /** A finisher's sets by choice (option id → scheme), when they differ. */
      schemes?: Record<string, string>;
      /** The pool movement it starts with (null: nothing fits; pick one or leave it out). */
      defaultId: string | null;
      /** Movements that fit (by group, or named by the slot), with the
       *  person's heaviest logged weight on each. A companion slot also offers
       *  library movements the household has the equipment for but not yet in
       *  its pool, as "lib:<key>" with `add` (added when the program starts). */
      options: { id: string; name: string; best: number | null; timed?: boolean; add?: boolean; about?: string | null }[];
    }[];
  }[];
};

/** Every program, with each slot's default and choices from the pool, and —
 *  for a person — the heaviest weight they've ever logged on each choice (the
 *  starting training max is 90% of it, v0.619). */
export async function loadProgramChoices(userId?: string | null): Promise<ProgramChoice[]> {
  const pool = (await prisma.poolExercise.findMany({
    where: { isActive: true, ownerId: null },
    orderBy: { name: "asc" },
    select: { id: true, name: true, muscleGroup: true, category: true, metric: true, pattern: true, about: true },
  })) as {
    id: string;
    name: string;
    muscleGroup: string | null;
    category: string;
    metric: string | null;
    pattern: string | null;
    about: string | null;
  }[];
  // A movement's pattern: its own tag, else the library movement of that name.
  const libByName = new Map(LIBRARY.map((e) => [nameKey(e.name), e]));
  // A movement's pattern: its own tag, else the library movement of that
  // name, else a guess from the name ("Sandbag lunge" is a squat) (v0.625).
  const patternOf = (m: { name: string; pattern: string | null }) =>
    m.pattern ?? libByName.get(nameKey(m.name))?.pattern ?? guessPattern(m.name);
  const groupOfMove = (m: { name: string; muscleGroup: string | null }) =>
    m.muscleGroup ?? libByName.get(nameKey(m.name))?.muscleGroup ?? null;
  const have = new Set((await loadEquipment()).filter((e) => e.have).map((e) => e.key));
  const inPool = new Set(pool.map((m) => nameKey(m.name)));
  const bests = new Map<string, number>();
  if (userId) {
    const rows = (await prisma.sessionSet.findMany({
      where: { poolExerciseId: { not: null }, weight: { not: null }, session: { userId, isRest: false } },
      select: { poolExerciseId: true, weight: true },
    })) as { poolExerciseId: string | null; weight: number | null }[];
    for (const r of rows) {
      if (!r.poolExerciseId || !r.weight) continue;
      if (r.weight > (bests.get(r.poolExerciseId) ?? 0)) bests.set(r.poolExerciseId, r.weight);
    }
  }
  const norm = (s: string) => s.trim().toLowerCase().replace(/s$/, "");
  return PROGRAMS.map((p) => ({
    key: p.key,
    name: p.name,
    blurb: p.blurb,
    weeks: p.weeks,
    defaultDays: p.defaultDays,
    ...(p.builder ? { builder: true } : {}),
    days: p.days.map((d) => ({
      name: d.name,
      row: !!d.row,
      roles: d.roles.map((r) => {
        const names = new Set(r.match.map(norm));
        let fits: typeof pool;
        let adds: { id: string; name: string; best: null; timed?: boolean; add: true; about: string }[] = [];
        if (r.offer) {
          // Odd squad (v0.732): only the movements the slot offers, in its
          // order; library ones the household has the equipment for.
          const order = r.offer.map((x) => nameKey(x.name));
          fits = pool
            .filter((m) => order.includes(nameKey(m.name)))
            .sort((a, b) => order.indexOf(nameKey(a.name)) - order.indexOf(nameKey(b.name)));
          const libs = r.offer
            .map((x) => libByName.get(nameKey(x.name)))
            .filter((e): e is (typeof LIBRARY)[number] => !!e && !inPool.has(nameKey(e.name)) && e.equipment.every((k) => have.has(k)));
          adds = libs.map((e) => ({
            id: `lib:${e.key}`,
            name: e.name,
            best: null,
            ...(e.metric === "DURATION" ? { timed: true } : {}),
            add: true as const,
            about: e.about,
          }));
        } else if (r.patterns && !r.main) {
          // A companion slot (v0.624): movements of its kind, never one of the
          // program's main lifts, plus what the library could add.
          const mains = new Set(p.days.flatMap((x) => x.roles.filter((y) => y.main).flatMap((y) => y.match)).map((n) => nameKey(n)));
          const fitsKind = (pattern: string | null, group: string | null) =>
            !!pattern && r.patterns!.includes(pattern as never) && (!r.groups || (!!group && r.groups.includes(group as never)));
          // A weights movement with no type at all still fits by its muscle group.
          const inGroups = (group: string | null) => !!group && (r.groups ?? [r.muscleGroup]).includes(group as never);
          fits = pool.filter((m) => {
            if (mains.has(nameKey(m.name))) return false;
            if (names.has(norm(m.name))) return true;
            const pattern = patternOf(m);
            return pattern ? fitsKind(pattern, groupOfMove(m)) : m.category === "WEIGHTS" && inGroups(groupOfMove(m));
          });
          adds = LIBRARY.filter(
            (e) =>
              e.category === "WEIGHTS" &&
              !inPool.has(nameKey(e.name)) &&
              !mains.has(nameKey(e.name)) &&
              fitsKind(e.pattern, e.muscleGroup) &&
              e.equipment.every((k) => have.has(k)),
          ).map((e) => ({
            id: `lib:${e.key}`,
            name: e.name,
            best: null,
            ...(e.metric === "DURATION" ? { timed: true } : {}),
            add: true as const,
            about: e.about,
          }));
        } else {
          // Movements filed under the slot's group, and any movement the slot
          // names wherever it's filed (pull-ups kept under HIIT).
          fits = pool.filter(
            (m) => (m.category === "WEIGHTS" && m.muscleGroup === r.muscleGroup) || names.has(norm(m.name)),
          );
        }
        const def = defaultFor(r, fits) ?? (r.patterns && !r.main ? (fits[0] ?? null) : null);
        const libDef = !def && (!r.main || r.offer) ? (r.match.map((n) => adds.find((a) => norm(a.name) === norm(n))).find(Boolean) ?? null) : null;
        const offered = r.offer
          ? Object.fromEntries(
              [...fits.map((m) => [m.id, m.name] as const), ...adds.map((a) => [a.id, a.name] as const)].flatMap(([id, name]) => {
                const x = r.offer!.find((y) => nameKey(y.name) === nameKey(name));
                return x?.scheme ? [[id, schemeKey(x.scheme)]] : [];
              }),
            )
          : null;
        return {
          key: r.key,
          label: r.label,
          muscleGroup: r.muscleGroup,
          main: !!r.main,
          optional: !!r.optional,
          scheme: schemeKey(r.scheme),
          ...(r.block ? { block: r.block } : {}),
          ...(offered && Object.keys(offered).length ? { schemes: offered } : {}),
          defaultId: def?.id ?? libDef?.id ?? (r.offer ? (fits[0]?.id ?? adds[0]?.id ?? null) : null),
          // A timed movement (a plank) logs by time: the setup shows Time, not sets.
          options: [
            ...fits.map((m) => ({
              id: m.id,
              name: m.name,
              best: bests.get(m.id) ?? null,
              ...(m.metric === "DURATION" ? { timed: true } : {}),
              // The how-to for the ⓘ (v0.626): its own, else the library's.
              about: m.about ?? libByName.get(nameKey(m.name))?.about ?? null,
            })),
            ...adds,
          ],
        };
      }),
    })),
  }));
}

function defaultFor(role: ProgramRole, pool: readonly { id: string; name: string; muscleGroup: string | null }[]) {
  const norm = (s: string) => s.trim().toLowerCase().replace(/s$/, "");
  for (const m of role.match) {
    const hit = pool.find((p) => norm(p.name) === norm(m));
    if (hit) return hit;
  }
  return null;
}

/** What the person's plan has now, for the setup's Extras step (v0.620):
 *  whether there's a warm-up, and the weekdays with cardio or conditioning
 *  (kept as they are when the program starts). */
export type CurrentExtras = {
  warmup: boolean;
  /** The plan's warm-up routine, if it has one (v0.622). */
  warmupRoutine: string | null;
  cardioDays: number[];
  conditioningDays: number[];
  /** The Core day's weekday (v0.732), for the builder; null with none. */
  coreDay?: number | null;
};

const CARDIO_CATS = new Set(["CARDIO", "ROWING", "RUNNING", "RUCKING"]);
const isConditioning = (w: { category: string | null; hiitWorkoutId: string | null }) => w.category === "HIIT" || !!w.hiitWorkoutId;

export async function currentExtras(userId: string): Promise<CurrentExtras> {
  const rows = (await prisma.plannedWorkout.findMany({
    where: { userId, isRest: false },
    select: { dayOfWeek: true, category: true, hiitWorkoutId: true, warmup: true, muscleGroup: true, core: true },
  })) as {
    dayOfWeek: number;
    category: string | null;
    hiitWorkoutId: string | null;
    warmup: string | null;
    muscleGroup: string | null;
    core: unknown;
  }[];
  const days = (f: (w: (typeof rows)[number]) => boolean) => [...new Set(rows.filter(f).map((w) => w.dayOfWeek))].sort();
  return {
    warmup: rows.some((w) => w.category === "WARMUP"),
    warmupRoutine: rows.find((w) => w.category === "WARMUP" && w.warmup)?.warmup ?? null,
    cardioDays: days((w) => !!w.category && CARDIO_CATS.has(w.category)),
    conditioningDays: days(isConditioning),
    coreDay: rows.find((w) => w.core != null && w.muscleGroup === "CORE")?.dayOfWeek ?? null,
  };
}

/** The running program as its setup would show it (v0.626): its days, the
 *  movement in each slot (slots left out are `removed`), companion sets, and
 *  the other lifts on its days as added ones. For "Make changes" at the end of
 *  a cycle, so the setup opens on the plan as it is now. */
export type CurrentSetup = {
  key: string;
  days: number[];
  picks: Record<string, string | null>;
  removed: string[];
  schemes: Record<string, string>;
  added: { day: number; poolExerciseId: string; scheme: string | null }[];
  maxes: Record<string, number>;
};

export async function currentSetup(userId: string, loaded?: ActiveProgram | null): Promise<CurrentSetup | null> {
  const p = loaded === undefined ? await loadActiveProgram(userId) : loaded;
  if (!p || p.days.length !== p.program.days.length) return null;
  const rows = (
    (await prisma.plannedWorkout.findMany({
      where: { userId, isRest: false },
      orderBy: [{ dayOfWeek: "asc" }, { sortOrder: "asc" }],
      select: {
        dayOfWeek: true,
        category: true,
        programId: true,
        exercises: { orderBy: { sortOrder: "asc" }, select: { poolExerciseId: true, scheme: true, programRole: true } },
      },
    })) as {
      dayOfWeek: number;
      category: string | null;
      programId: string | null;
      exercises: { poolExerciseId: string; scheme: string | null; programRole: string | null }[];
    }[]
  ).filter((w) => !w.programId || w.programId === p.id); // another program's entries aren't this one's (v0.749)
  const picks: Record<string, string | null> = {};
  const schemes: Record<string, string> = {};
  const added: CurrentSetup["added"] = [];
  const indexFor = (dow: number, role?: string) =>
    p.days.findIndex((d, i) => d === dow && (!role || p.program.days[i].roles.some((r) => r.key === role)));
  for (const w of rows) {
    for (const e of w.exercises) {
      if (e.programRole) {
        const i = indexFor(w.dayOfWeek, e.programRole);
        if (i < 0) continue;
        const k = `${i}:${e.programRole}`;
        if (picks[k]) continue;
        picks[k] = e.poolExerciseId;
        const role = p.program.days[i].roles.find((r) => r.key === e.programRole);
        if (role && !role.main && e.scheme && e.scheme !== schemeKey(role.scheme)) schemes[k] = e.scheme;
      } else if (w.category === "WEIGHTS" || w.category == null) {
        const i = indexFor(w.dayOfWeek);
        if (i >= 0) added.push({ day: i, poolExerciseId: e.poolExerciseId, scheme: e.scheme });
      }
    }
  }
  const removed: string[] = [];
  p.program.days.forEach((d, i) =>
    d.roles.forEach((r) => {
      const k = `${i}:${r.key}`;
      if (!picks[k]) {
        picks[k] = null;
        removed.push(k);
      }
    }),
  );
  return { key: p.program.key, days: p.days, picks, removed, schemes, added, maxes: p.trainingMaxes };
}

// --- your version (v0.666) -------------------------------------------------------

/** Keep the running program's setup as the person's version of it, when it's
 *  changed from the default (a newer one replaces the older). Before the
 *  program ends: it reads the plan as it is. Never throws. */
async function snapshotVersion(userId: string): Promise<void> {
  try {
    const p = await loadActiveProgram(userId);
    // A builder program starts over when picked again (v0.732): no version.
    if (!p || p.program.builder) return;
    const setup = await currentSetup(userId, p);
    if (!setup) return;
    const choice = (await loadProgramChoices(userId)).find((c) => c.key === p.program.key);
    if (!choice || !setupDiffers(setup, choice)) return;
    const extras = await currentExtras(userId);
    const data = { setup: { setup, extras } as never, savedOn: toDateColumn(todayISO()) };
    await prisma.programVersion.upsert({
      where: { userId_programKey: { userId, programKey: p.program.key } },
      create: { userId, programKey: p.program.key, ...data },
      update: data,
    });
  } catch {
    // Best effort: ending a program never fails over this.
  }
}

/** The person's own versions, by program, made fit to start from today. */
export async function versionsFor(userId: string, choices?: ProgramChoice[]): Promise<Record<string, ProgramVersion>> {
  const rows = (await prisma.programVersion.findMany({
    where: { userId },
    select: { programKey: true, setup: true, savedOn: true },
  })) as { programKey: string; setup: unknown; savedOn: Date }[];
  if (rows.length === 0) return {};
  const list = choices ?? (await loadProgramChoices(userId));
  const pool = (await prisma.poolExercise.findMany({ where: { isActive: true }, select: { id: true } })) as { id: string }[];
  const poolIds = new Set(pool.map((m) => m.id));
  const out: Record<string, ProgramVersion> = {};
  for (const r of rows) {
    const choice = list.find((c) => c.key === r.programKey);
    const saved = r.setup as { setup?: CurrentSetup; extras?: CurrentExtras } | null;
    if (!choice || !saved?.setup || !saved.extras) continue;
    const v = cleanVersion({ savedOn: fromDateColumn(r.savedOn), setup: saved.setup, extras: saved.extras }, choice, poolIds);
    if (v) out[r.programKey] = v;
  }
  return out;
}

/** Forget the person's version of a program. */
export async function forgetVersion(userId: string, programKey: string): Promise<void> {
  await prisma.programVersion.deleteMany({ where: { userId, programKey } });
}

// --- start, end, next block -------------------------------------------------------

type PlanSnapshot = {
  rotationActive: boolean;
  workouts: {
    dayOfWeek: number;
    name: string;
    category: string | null;
    muscleGroup: string | null;
    isRest: boolean;
    hiitWorkoutId: string | null;
    sortOrder: number;
    warmup?: string | null;
    /** A Core, Arms or Isometric rotation (v0.732); those rows stay in place. */
    core?: unknown;
    exercises: {
      poolExerciseId: string;
      tracked: boolean;
      metric: string | null;
      sortOrder: number;
      scheme: string | null;
      programRole: string | null;
    }[];
  }[];
};

async function snapshotPlan(userId: string): Promise<PlanSnapshot> {
  const [rows, rotation] = (await Promise.all([
    prisma.plannedWorkout.findMany({
      where: { userId },
      orderBy: [{ dayOfWeek: "asc" }, { sortOrder: "asc" }],
      select: {
        dayOfWeek: true,
        name: true,
        category: true,
        muscleGroup: true,
        isRest: true,
        hiitWorkoutId: true,
        sortOrder: true,
        warmup: true,
        core: true,
        exercises: {
          orderBy: { sortOrder: "asc" },
          select: { poolExerciseId: true, tracked: true, metric: true, sortOrder: true, scheme: true, programRole: true },
        },
      },
    }),
    prisma.workoutRotation.findUnique({ where: { userId }, select: { isActive: true } }),
  ])) as [PlanSnapshot["workouts"], { isActive: boolean } | null];
  return { rotationActive: !!rotation?.isActive, workouts: rows };
}


/**
 * Core, Arms and Isometric days (v0.732): they stay where they are when a
 * program starts or ends, rotation and monthly test included, rather than
 * being cleared with the rest of the plan. Returns their ids, and a test for
 * a saved plan's row that stood for one of them (older saves didn't keep the
 * rotation, so a row on the same day and group is taken as that day).
 */
async function keptRotations(userId: string): Promise<{ ids: string[]; covers: (w: PlanSnapshot["workouts"][number]) => boolean }> {
  const rows = (await prisma.plannedWorkout.findMany({
    where: { userId },
    select: { id: true, dayOfWeek: true, muscleGroup: true, category: true, core: true },
  })) as { id: string; dayOfWeek: number; muscleGroup: string | null; category: string | null; core: unknown }[];
  const kept = rows.filter((r) => r.core != null);
  return {
    ids: kept.map((r) => r.id),
    covers: (w) =>
      w.core != null ||
      kept.some((r) => r.dayOfWeek === w.dayOfWeek && r.muscleGroup === w.muscleGroup && r.category === w.category),
  };
}

async function writePlan(userId: string, snap: PlanSnapshot["workouts"]): Promise<void> {
  for (const w of snap) {
    await prisma.plannedWorkout.create({
      data: {
        userId,
        dayOfWeek: w.dayOfWeek,
        name: w.name,
        category: w.category as never,
        muscleGroup: w.muscleGroup as never,
        isRest: w.isRest,
        hiitWorkoutId: w.hiitWorkoutId,
        sortOrder: w.sortOrder,
        warmup: w.warmup ?? null,
        exercises: {
          create: w.exercises.map((e) => ({
            poolExerciseId: e.poolExerciseId,
            tracked: e.tracked,
            metric: e.metric as never,
            sortOrder: e.sortOrder,
            scheme: e.scheme,
            programRole: e.programRole,
          })),
        },
      },
    });
  }
}

export type StartProgramInput = {
  key: string;
  /** Weekday for each program day, in day order. */
  days: number[];
  /** Chosen movement per slot, keyed "<day index>:<role key>"; null leaves it out. */
  picks: Record<string, string | null>;
  /** A recent top weight per main-lift movement; its training max is 90%. */
  tops: Record<string, number>;
  /** Training maxes as set on the setup (v0.620); win over `tops`. */
  maxes?: Record<string, number>;
  /** A companion lift's sets in place of the program's, "<day>:<slot>" → scheme. */
  schemes?: Record<string, string>;
  /** Companion lifts added on a program day (by index). */
  added?: { day: number; poolExerciseId: string; scheme: string | null }[];
  /** Extras (v0.620). Unset: none, as before. A day the old plan had cardio
   *  or conditioning on keeps what it had; a new day gets "any cardio" or
   *  conditioning picked on the day. */
  warmup?: boolean;
  /** The warm-up's routine (v0.622): "lib:<key>", a routine id, or "" for a
   *  plain check. Unset keeps the old plan's warm-up as it was. */
  warmupRoutine?: string | null;
  cardioDays?: number[];
  conditioningDays?: number[];
  /** The builder's Core day (v0.732): the Core day moves to this weekday,
   *  rotation and test as they are, or one is made there. */
  coreDay?: number | null;
  /** The days the program doesn't use (v0.748), by weekday: "rest", "skip",
   *  "core", "arms", "iso", "mobility", "stretching", "cardio",
   *  "conditioning", "strength:<GROUP>" or "custom" (as it is). A day whose
   *  choice matches what it holds now keeps it as it is (rotation and all);
   *  a changed day gets the new kind fresh. Unset: as before (older apps). */
  other?: Record<string, string>;
  /** Another program alongside the running one (v0.749): only its own days,
   *  lifts and maxes; the plan's other days, warm-up, cardio and
   *  conditioning stay with the first program. */
  add?: boolean;
  /** Which running program this changes or replaces (v0.749); the first one
   *  when unset. */
  programId?: string;
  /** The next cycle of the running program, with changes (v0.626): the program
   *  carries on (same start, the next block, these maxes) and plan entries the
   *  setup doesn't cover — a workout on another day, stretching, a sport — stay. */
  next?: boolean;
};

/**
 * Start a program: it writes the person's weekly plan (an ordinary plan they
 * can edit) and keeps the old plan to go back to. A rotation is switched off,
 * not deleted. Any program already running ends first.
 */
export async function startProgram(userId: string, input: StartProgramInput): Promise<"ok" | "bad_request"> {
  const program = programByKey(input.key);
  if (!program) return "bad_request";
  if (input.days.length !== program.days.length) return "bad_request";
  // Two program days may share a weekday (v0.620).
  const okDay = (d: number) => Number.isInteger(d) && d >= 0 && d <= 6;
  if (!input.days.every(okDay)) return "bad_request";
  const added = (input.added ?? []).filter(
    (a) => Number.isInteger(a.day) && a.day >= 0 && a.day < program.days.length && typeof a.poolExerciseId === "string" && a.poolExerciseId,
  );
  // Library movements chosen in the setup ("lib:<key>") join the household's
  // pool first, then stand in for their ids (v0.624).
  const libKeys = [
    ...new Set(
      [...Object.values(input.picks), ...added.map((a) => a.poolExerciseId)]
        .filter((v): v is string => !!v && v.startsWith("lib:"))
        .map((v) => v.slice(4)),
    ),
  ];
  if (libKeys.length) {
    await applyLibrary(libKeys);
    const rows = (await prisma.poolExercise.findMany({
      where: { libraryKey: { in: libKeys }, ownerId: null },
      select: { id: true, libraryKey: true },
    })) as { id: string; libraryKey: string | null }[];
    const byKey = new Map(rows.map((r) => [`lib:${r.libraryKey}`, r.id]));
    for (const k of Object.keys(input.picks)) {
      const v = input.picks[k];
      if (v && v.startsWith("lib:")) input.picks[k] = byKey.get(v) ?? null;
    }
    for (const a of added) if (a.poolExerciseId.startsWith("lib:")) a.poolExerciseId = byKey.get(a.poolExerciseId) ?? "";
  }
  const pickIds = [
    ...new Set([...Object.values(input.picks).filter((v): v is string => !!v), ...added.map((a) => a.poolExerciseId).filter(Boolean)]),
  ];
  const pool = pickIds.length
    ? ((await prisma.poolExercise.findMany({
        where: { id: { in: pickIds } },
        select: { id: true, name: true, metric: true, muscleGroup: true, category: true },
      })) as { id: string; name: string; metric: string | null; muscleGroup: string | null; category: string }[])
    : [];
  const known = new Set(pool.map((p) => p.id));
  // An added lift files under its own group (a movement outside Weights under Full body).
  const groupOf = new Map(pool.map((p) => [p.id, p.category === "WEIGHTS" && p.muscleGroup ? p.muscleGroup : "FULL_BODY"]));
  // A timed movement (a plank) keeps logging by time, with no set structure.
  const timed = new Set(pool.filter((p) => p.metric === "DURATION").map((p) => p.id));
  // A bodyweight movement (push-ups, pull-ups kept under HIIT) logs reps, not a
  // weight (v0.629); a weighted version is its own movement.
  const repsOnly = new Set(
    pool.filter((p) => p.metric === "REPS" || (p.category !== "WEIGHTS" && p.metric !== "DURATION")).map((p) => p.id),
  );

  const prev = await snapshotPlan(userId);
  // The running program again (the next cycle with changes, or set up again
  // from Change program): it carries on — same start, same weeks — rather
  // than starting over at week 1 (v0.627).
  // Two programs can run at once (v0.749): this one carries on when it's
  // running already (same key), or replaces the one named (else the first),
  // or runs alongside (`add`).
  const actives = await loadActivePrograms(userId);
  const first = actives[0] ?? null;
  const running =
    actives.find((a) => a.program.key === program.key && (!input.programId || a.id === input.programId)) ?? null;
  const next = !!running;
  const replacing = !next && !input.add ? ((input.programId ? actives.find((a) => a.id === input.programId) : first) ?? null) : null;
  const ownId = running?.id ?? replacing?.id ?? null;
  // Alongside another: only this program's own days change.
  const alongside = !!first && (input.add ? !next : ownId !== first.id);
  const otherPrograms = actives.filter((a) => a.id !== ownId).map((a) => a.id);
  // The plan being replaced goes to My plans (unless it's empty or already there).
  if (!alongside) {
    await savePlan(userId, `${shortDate(todayISO())} · before ${next ? "changes" : program.name}`, { auto: true }).catch(
      () => null,
    );
  }
  const prevActive = replacing ? { id: replacing.id, previousPlan: null as unknown } : null;
  if (prevActive) {
    const row = (await prisma.personProgram.findUnique({ where: { id: prevActive.id }, select: { previousPlan: true } })) as {
      previousPlan: unknown;
    } | null;
    prevActive.previousPlan = row?.previousPlan ?? null;
  }
  const today = todayISO();
  if (prevActive) {
    if (replacing && replacing.id === first?.id) await snapshotVersion(userId);
    await prisma.personProgram.update({
      where: { id: prevActive.id },
      data: { status: "ENDED", endedOn: toDateColumn(today) },
    });
  }
  if (alongside) {
    // The plan-wide steps belong to the first program.
    input.warmup = false;
    input.cardioDays = [];
    input.conditioningDays = [];
    input.other = undefined;
    input.coreDay = null;
  }

  const rotations = await keptRotations(userId);
  // The other days (v0.748): a day that stays the same keeps what it holds;
  // a changed one is made fresh below. A new program's rotations go unless a
  // day keeps them.
  const otherIn = cleanOther(input.other, input.days);
  let keepIds = rotations.ids;
  const changedOther: [number, string][] = [];
  if (otherIn) {
    const all = (await prisma.plannedWorkout.findMany({
      where: { userId },
      select: { id: true, dayOfWeek: true, category: true, muscleGroup: true, isRest: true, hiitWorkoutId: true, core: true },
    })) as { id: string; dayOfWeek: number; category: string | null; muscleGroup: string | null; isRest: boolean; hiitWorkoutId: string | null; core: unknown }[];
    const onProgram = new Set(input.days);
    keepIds = [];
    for (let d = 0; d < 7; d++) {
      const rows = all.filter((r) => r.dayOfWeek === d);
      if (onProgram.has(d)) {
        // The same program again: its days keep their rotations.
        if (next) keepIds.push(...rows.filter((r) => r.core != null).map((r) => r.id));
        continue;
      }
      const want = otherIn.get(d) ?? "skip";
      if (want === "custom" || want === otherKindOf(rows)) keepIds.push(...rows.filter((r) => !setupRow(r)).map((r) => r.id));
      else changedOther.push([d, want]);
    }
  }
  if (alongside) {
    // Only this program's own entries go (none when it's new).
    if (ownId) await prisma.plannedWorkout.deleteMany({ where: { userId, programId: ownId } });
  } else {
    // Another running program's entries always stay.
    const theirs = otherPrograms.length
      ? ((await prisma.plannedWorkout.findMany({ where: { userId, programId: { in: otherPrograms } }, select: { id: true } })) as {
          id: string;
        }[])
      : [];
    await prisma.plannedWorkout.deleteMany({ where: { userId, id: { notIn: [...keepIds, ...theirs.map((t) => t.id)] } } });
  }
  if (prev.rotationActive && !alongside) {
    await prisma.workoutRotation.updateMany({ where: { userId }, data: { isActive: false } });
  }
  if (typeof input.coreDay === "number" && okDay(input.coreDay)) await placeCoreDay(userId, input.coreDay);

  const units = await loadWeightUnits();
  const maxes: Record<string, number> = {};
  const mainIds = new Set<string>();
  const order = new Map<number, number>();
  const nextOrder = (dow: number) => {
    const n = order.get(dow) ?? 0;
    order.set(dow, n + 1);
    return n;
  };
  // This program's own entries, tagged with it below (v0.749).
  const ownRows: string[] = [];
  // Warm-up on each workout day (v0.748: the other days with work too).
  const warmOther = otherIn
    ? [...otherIn.entries()].filter(([, k]) => k === "core" || k === "arms" || k === "iso" || k === "custom" || k.startsWith("strength:")).map(([d]) => d)
    : [];
  const programDays = [...new Set([...input.days, ...warmOther])].sort();

  // Warm-up first on each program day: the old plan's own, else an empty one.
  if (input.warmup) {
    const own = prev.workouts.find((w) => w.category === "WARMUP");
    const routine =
      input.warmupRoutine === undefined
        ? undefined
        : input.warmupRoutine && (await routineFor(userId, input.warmupRoutine))
          ? input.warmupRoutine
          : null;
    for (const dow of programDays) {
      if (own) {
        await writePlan(userId, [
          { ...own, dayOfWeek: dow, sortOrder: nextOrder(dow), ...(routine !== undefined ? { warmup: routine } : {}) },
        ]);
      } else {
        await prisma.plannedWorkout.create({
          data: { userId, dayOfWeek: dow, name: "Warm-up", category: "WARMUP", sortOrder: nextOrder(dow), warmup: routine ?? null },
        });
      }
    }
  }

  // Cardio: a day the old plan had cardio on keeps it; a program's rowing day
  // gets "Rowing · <program>", so the Cardio card says it's the program's.
  const rowDays = new Set(program.days.flatMap((d, i) => (d.row ? [input.days[i]] : [])));
  const otherOf = (k: string) => (otherIn ? [...otherIn.entries()].filter(([, v]) => v === k).map(([d]) => d) : []);
  const cardioDays = [...new Set([...(input.cardioDays ?? []).filter(okDay), ...otherOf("cardio")])].sort();
  for (const dow of cardioDays) {
    if (rowDays.has(dow)) {
      await prisma.plannedWorkout.create({
        data: { userId, dayOfWeek: dow, name: `Rowing · ${program.name}`, category: "ROWING", sortOrder: nextOrder(dow) },
      });
      continue;
    }
    const had = prev.workouts.filter((w) => w.dayOfWeek === dow && !w.isRest && w.category && CARDIO_CATS.has(w.category));
    if (had.length) await writePlan(userId, had.map((w) => ({ ...w, sortOrder: nextOrder(dow) })));
    else await prisma.plannedWorkout.create({ data: { userId, dayOfWeek: dow, name: "Cardio", category: "CARDIO", sortOrder: nextOrder(dow) } });
  }
  // Older clients send no extras: the program's rowing as before.
  if (input.cardioDays == null && !alongside) {
    for (const dow of rowDays) {
      await prisma.plannedWorkout.create({
        data: { userId, dayOfWeek: dow, name: `Rowing · ${program.name}`, category: "ROWING", sortOrder: nextOrder(dow) },
      });
    }
  }

  for (let i = 0; i < program.days.length; i++) {
    const day = program.days[i];
    const dow = input.days[i];
    type Pick = { poolExerciseId: string; scheme: string | null; programRole: string | null; group: MuscleGroup };
    const picks: Pick[] = [];
    for (const r of day.roles) {
      const id = input.picks[`${i}:${r.key}`];
      if (!id || !known.has(id) || picks.some((e) => e.poolExerciseId === id)) continue;
      const own = !r.main ? input.schemes?.[`${i}:${r.key}`] : undefined;
      // A slot that offers its own list (Odd squad): the choice's own sets
      // (a carry, a hold, clubs), else the slot's.
      const name = pool.find((p) => p.id === id)?.name ?? "";
      const offered = r.offer?.find((x) => nameKey(x.name) === nameKey(name))?.scheme;
      const scheme = own !== undefined ? cleanPlanScheme(own, today) : schemeKey(offered ?? r.scheme);
      // Filed under the movement's own group when it has one (a good morning
      // under Legs), else the slot's (pull-ups kept under HIIT go to Back).
      const ownGroup = groupOf.get(id);
      const group = (ownGroup && ownGroup !== "FULL_BODY" ? ownGroup : r.muscleGroup) as MuscleGroup;
      picks.push({ poolExerciseId: id, scheme: r.main ? schemeKey(r.scheme) : scheme?.startsWith("wave") ? null : scheme, programRole: r.key, group });
      const top = input.tops[id];
      const tm = input.maxes?.[id];
      const unit = units[r.muscleGroup] ?? "lb";
      if (r.main) mainIds.add(id);
      if (r.main && typeof tm === "number" && tm > 0) maxes[id] = tm;
      else if (r.main && typeof top === "number" && top > 0 && maxes[id] == null) maxes[id] = trainingMaxFrom(top, unit);
    }
    for (const a of added.filter((x) => x.day === i)) {
      if (!known.has(a.poolExerciseId) || picks.some((e) => e.poolExerciseId === a.poolExerciseId)) continue;
      const scheme = cleanPlanScheme(a.scheme ?? "", today);
      picks.push({
        poolExerciseId: a.poolExerciseId,
        scheme: scheme?.startsWith("wave") ? null : scheme,
        programRole: null,
        group: (groupOf.get(a.poolExerciseId) ?? "FULL_BODY") as MuscleGroup,
      });
    }
    // One planned workout per muscle group, in the order the day lists them.
    const groups: MuscleGroup[] = [];
    for (const p of picks) if (!groups.includes(p.group)) groups.push(p.group);
    for (const g of groups) {
      const exercises = picks.filter((p) => p.group === g);
      const made = await prisma.plannedWorkout.create({
        data: {
          userId,
          dayOfWeek: dow,
          name: MUSCLE_GROUP_LABEL[g] ?? "Strength",
          category: "WEIGHTS",
          muscleGroup: g,
          sortOrder: nextOrder(dow),
          exercises: {
            create: exercises.map((e, k) => ({
              poolExerciseId: e.poolExerciseId,
              tracked: true,
              metric: timed.has(e.poolExerciseId) ? "DURATION" : repsOnly.has(e.poolExerciseId) ? "REPS" : "WEIGHT",
              sortOrder: k,
              // A timed movement logs by time; a program's timed hold keeps its sets.
              scheme: timed.has(e.poolExerciseId) && !e.scheme?.startsWith("hold:") ? null : e.scheme,
              programRole: e.programRole,
            })),
          },
        },
      });
      ownRows.push(made.id);
    }
  }

  // Conditioning last: a day that had some keeps it; a new day picks on the day.
  for (const dow of [...new Set([...(input.conditioningDays ?? []).filter(okDay), ...otherOf("conditioning")])].sort()) {
    const had = prev.workouts.filter((w) => w.dayOfWeek === dow && !w.isRest && isConditioning(w));
    if (had.length) await writePlan(userId, had.map((w) => ({ ...w, sortOrder: nextOrder(dow) })));
    else await prisma.plannedWorkout.create({ data: { userId, dayOfWeek: dow, name: "Conditioning", category: "HIIT", sortOrder: nextOrder(dow) } });
  }

  // The other days that changed (v0.748), made fresh.
  for (const [dow, kind] of changedOther) await makeOtherDay(userId, dow, kind, nextOrder(dow));

  // The next cycle with changes: what the setup doesn't cover comes back as it
  // was (a workout on another day, a stretch, a sport, a rest day), then the
  // program carries on into its next block with the maxes as set. With other
  // days (v0.748) those stayed in place instead.
  if (next && running) {
    const programDays = new Set(input.days);
    const kept = prev.workouts.filter((w) => {
      // Core days never left (v0.732).
      if (rotations.covers(w)) return false;
      // The setup set these: a warm-up on each program day, cardio and conditioning days.
      if (w.category === "WARMUP" && programDays.has(w.dayOfWeek)) return false;
      if ((w.category && CARDIO_CATS.has(w.category)) || isConditioning(w)) return false;
      if (w.exercises.some((e) => e.programRole)) return false;
      // Weights on a program day came back through the setup as added lifts.
      if (programDays.has(w.dayOfWeek) && (w.category === "WEIGHTS" || w.category == null) && !w.isRest) return false;
      if (w.isRest && programDays.has(w.dayOfWeek)) return false;
      return true;
    });
    if (!otherIn && !alongside && otherPrograms.length === 0) {
      await writePlan(userId, kept.map((w) => ({ ...w, sortOrder: nextOrder(w.dayOfWeek) })));
    }
    // The next cycle moves on a block; set up again mid-cycle keeps the week.
    const done = input.next ? blocksDone(running.program, running.blockStartedOn, today) : 0;
    const blockStart = done >= 1 ? addDays(running.blockStartedOn, 7 * running.program.weeks * done) : running.blockStartedOn;
    // A new cycle (v0.748): its number and what each lift went up by.
    const newMaxes: Record<string, number> = {
      ...Object.fromEntries(Object.entries(running.trainingMaxes).filter(([id]) => mainIds.has(id))),
      ...maxes,
    };
    const cycleData =
      done >= 1
        ? {
            cycle: running.cycle + 1,
            lastRaises: Object.fromEntries(
              Object.entries(newMaxes)
                .map(([id, w]) => [id, Math.round((w - (running.trainingMaxes[id] ?? w)) * 100) / 100] as const)
                .filter(([, by]) => by > 0),
            ),
          }
        : {};
    await prisma.personProgram.update({
      where: { id: running.id },
      data: {
        ...cycleData,
        days: input.days.join(","),
        // A main lift left blank keeps the training max it had.
        trainingMaxes: {
          ...Object.fromEntries(Object.entries(running.trainingMaxes).filter(([id]) => mainIds.has(id))),
          ...maxes,
        },
        blockStartedOn: toDateColumn(blockStart),
      },
    });
    await prisma.plannedWorkout.updateMany({ where: { id: { in: ownRows } }, data: { programId: running.id } });
    await generateWorkoutTasks();
    return "ok";
  }

  // The block starts on the Sunday of this week, so weeks turn over with the
  // calendar week.
  const start = startOfWeek(today);
  const madeProgram = await prisma.personProgram.create({
    data: {
      userId,
      programKey: program.key,
      status: "ACTIVE",
      startedOn: toDateColumn(today),
      blockStartedOn: toDateColumn(start),
      days: input.days.join(","),
      trainingMaxes: maxes,
      // Starting over from one program to another keeps the plan from before
      // the first, so "go back" means the person's own plan.
      previousPlan: (prevActive?.previousPlan as object | null) ?? (prev as unknown as object),
    },
    select: { id: true },
  });
  await prisma.plannedWorkout.updateMany({ where: { id: { in: ownRows } }, data: { programId: madeProgram.id } });
  await generateWorkoutTasks();
  return "ok";
}

/** Put the Core day on `dow` (v0.732): the one there is moves, rotation and
 *  monthly test as they are; with none, one is made with the first core workout. */
/** What each weekday holds now, as an Other days choice (v0.748), Sunday
 *  first: the setup starts from these for the same program, and from the
 *  rest days alone for a new one. */
export async function currentOtherDays(userId: string): Promise<string[]> {
  const all = (await prisma.plannedWorkout.findMany({
    where: { userId },
    select: { dayOfWeek: true, category: true, muscleGroup: true, isRest: true, hiitWorkoutId: true, core: true },
  })) as { dayOfWeek: number; category: string | null; muscleGroup: string | null; isRest: boolean; hiitWorkoutId: string | null; core: unknown }[];
  return Array.from({ length: 7 }, (_, d) => otherKindOf(all.filter((r) => r.dayOfWeek === d)));
}

/** The setup's other-day choices, by weekday, for days the program doesn't
 *  use; null when the setup sent none (an older app). */
function cleanOther(raw: unknown, programDays: readonly number[]): Map<number, string> | null {
  if (!raw || typeof raw !== "object") return null;
  const out = new Map<number, string>();
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const d = Number(k);
    const kind = cleanOtherKind(v);
    if (Number.isInteger(d) && d >= 0 && d <= 6 && !programDays.includes(d) && kind) out.set(d, kind);
  }
  return out;
}

/** A fresh other day (v0.748): Rest, a Core / Arms / Isometric rotation from
 *  the library, a Mobility or Stretching routine, or a muscle group's day.
 *  Cardio and conditioning come from their own steps. */
async function makeOtherDay(userId: string, dow: number, raw: string, sortOrder: number): Promise<void> {
  // What the kind's window picked (v0.753), else the library's first.
  const { kind, ids, test } = splitOther(raw);
  if (kind === "rest") {
    await prisma.plannedWorkout.create({ data: { userId, dayOfWeek: dow, name: "Rest", isRest: true, sortOrder } });
  } else if (kind === "core" || kind === "arms" || kind === "iso") {
    const picked = ids.length ? await setCoreDay(userId, { day: dow, rotation: ids, test: test ?? kind !== "arms", kind }) : null;
    if (!picked?.ok) await setCoreDay(userId, { day: dow, rotation: [rotationLibrary(kind)[0].id], test: test ?? kind !== "arms", kind });
  } else if (kind === "mobility" || kind === "stretching") {
    const mine = ids[0] && (await routinesFor(userId, kind)).some((r) => r.id === ids[0]) ? ids[0] : null;
    const routine = mine ?? libraryRoutinesOf(kind)[0]?.id ?? null;
    await prisma.plannedWorkout.create({
      data: {
        userId,
        dayOfWeek: dow,
        name: kind === "mobility" ? "Mobility" : "Stretching",
        category: (kind === "mobility" ? "MOBILITY" : "STRETCHING") as never,
        warmup: routine,
        sortOrder,
      },
    });
  } else if (kind.startsWith("strength:")) {
    const group = kind.slice(9) as MuscleGroup;
    const pool = ids.length
      ? ((await prisma.poolExercise.findMany({ where: { id: { in: ids } }, select: { id: true, metric: true } })) as {
          id: string;
          metric: string | null;
        }[])
      : [];
    const moves = ids.map((id) => pool.find((p) => p.id === id)).filter((p): p is (typeof pool)[number] => !!p);
    await prisma.plannedWorkout.create({
      data: {
        userId,
        dayOfWeek: dow,
        name: MUSCLE_GROUP_LABEL[group] ?? "Strength",
        category: "WEIGHTS",
        muscleGroup: group as never,
        sortOrder,
        ...(moves.length
          ? {
              exercises: {
                create: moves.map((m, k) => ({
                  poolExerciseId: m.id,
                  tracked: true,
                  metric: (m.metric ?? "WEIGHT") as never,
                  sortOrder: k,
                })),
              },
            }
          : {}),
      },
    });
  }
}

async function placeCoreDay(userId: string, dow: number): Promise<void> {
  const rows = (await prisma.plannedWorkout.findMany({
    where: { userId, category: "WEIGHTS" as never, muscleGroup: "CORE" as never },
    select: { id: true, dayOfWeek: true, core: true },
  })) as { id: string; dayOfWeek: number; core: unknown }[];
  const core = rows.find((r) => r.core != null);
  if (core) {
    if (core.dayOfWeek !== dow) await prisma.plannedWorkout.update({ where: { id: core.id }, data: { dayOfWeek: dow } });
    return;
  }
  await setCoreDay(userId, { day: dow, rotation: [rotationLibrary("core")[0].id], test: true });
}

/** The garage's length in feet, for a shuttle carry's lengths (v0.732). */
const GARAGE_KEY = "workouts.garageFeet";
export async function loadGarageFeet(): Promise<number> {
  const n = Number(await getSetting(GARAGE_KEY));
  return Number.isFinite(n) && n >= 5 && n <= 200 ? n : GARAGE_FEET;
}
export async function saveGarageFeet(feet: unknown): Promise<number> {
  const n = Math.round(Number(feet));
  const v = Number.isFinite(n) && n >= 5 && n <= 200 ? n : GARAGE_FEET;
  await setSetting(GARAGE_KEY, String(v));
  return v;
}

/** End the program. `restore` puts back the plan it replaced; otherwise the
 *  program's plan stays as the person's own. */
export async function endProgram(userId: string, restore: boolean, programId?: string): Promise<void> {
  const actives = await loadActivePrograms(userId);
  // With two running (v0.749), ending one takes only its own days.
  if (actives.length > 1) {
    const one = actives.find((a) => a.id === programId) ?? actives[actives.length - 1];
    await prisma.personProgram.update({ where: { id: one.id }, data: { status: "ENDED", endedOn: toDateColumn(todayISO()) } });
    await prisma.plannedWorkout.deleteMany({ where: { userId, programId: one.id } });
    await generateWorkoutTasks();
    return;
  }
  const row = (await prisma.personProgram.findFirst({
    where: { userId, status: "ACTIVE" },
    select: { id: true, previousPlan: true },
  })) as { id: string; previousPlan: unknown } | null;
  if (!row) return;
  // Kept, its entries become the plan's own.
  await prisma.plannedWorkout.updateMany({ where: { userId, programId: row.id }, data: { programId: null } });
  await snapshotVersion(userId);
  await prisma.personProgram.update({
    where: { id: row.id },
    data: { status: "ENDED", endedOn: toDateColumn(todayISO()) },
  });
  const snap = row.previousPlan as PlanSnapshot | null;
  if (restore && snap && Array.isArray(snap.workouts)) {
    // Core days stay as they are now (v0.732).
    const rotations = await keptRotations(userId);
    await prisma.plannedWorkout.deleteMany({ where: { userId, id: { notIn: rotations.ids } } });
    await writePlan(userId, snap.workouts.filter((w) => !rotations.covers(w)));
    if (snap.rotationActive) {
      await prisma.workoutRotation.updateMany({ where: { userId }, data: { isActive: true } });
    }
  }
  await generateWorkoutTasks();
}

/** End of a block: start the next one, raising the training maxes a step or
 *  repeating them. `raises` (v0.620) sets each lift's raise (0 holds it). */
export async function nextBlock(userId: string, raise: boolean, raises?: Record<string, number>, programId?: string): Promise<void> {
  const p = programId ? ((await loadActivePrograms(userId)).find((a) => a.id === programId) ?? null) : await loadActiveProgram(userId);
  if (!p) return;
  const today = todayISO();
  const done = blocksDone(p.program, p.blockStartedOn, today);
  if (done < 1) return;
  const start = addDays(p.blockStartedOn, 7 * p.program.weeks * done);
  let maxes = p.trainingMaxes;
  if (raises) {
    maxes = Object.fromEntries(
      Object.entries(maxes).map(([id, w]) => {
        const by = raises[id];
        return [id, typeof by === "number" && Number.isFinite(by) && by > 0 && by <= 100 ? w + by : w];
      }),
    );
  } else if (raise) {
    const lower = new Set<string>();
    const kg = new Set<string>();
    const units = await loadWeightUnits();
    const rows = (await prisma.plannedExercise.findMany({
      where: { plannedWorkout: { userId }, programRole: { not: null } },
      select: { poolExerciseId: true, programRole: true, plannedWorkout: { select: { muscleGroup: true } } },
    })) as { poolExerciseId: string; programRole: string | null; plannedWorkout: { muscleGroup: string | null } }[];
    for (const r of rows) {
      const role = p.program.days.flatMap((d) => d.roles).find((x) => x.key === r.programRole);
      if (role?.lower) lower.add(r.poolExerciseId);
      const mg = r.plannedWorkout.muscleGroup as MuscleGroup | null;
      if (mg && units[mg] === "kg") kg.add(r.poolExerciseId);
    }
    // Each lift in its own unit: a kg group steps half as far.
    const lb = Object.fromEntries(Object.entries(maxes).filter(([id]) => !kg.has(id)));
    const metric = Object.fromEntries(Object.entries(maxes).filter(([id]) => kg.has(id)));
    maxes = { ...raisedMaxes(lb, lower, "lb"), ...raisedMaxes(metric, lower, "kg") };
  }
  // The next cycle (v0.748): its number, and what each lift went up by.
  const lastRaises = Object.fromEntries(
    Object.entries(maxes)
      .map(([id, w]) => [id, Math.round((w - (p.trainingMaxes[id] ?? w)) * 100) / 100] as const)
      .filter(([, by]) => by > 0),
  );
  await prisma.personProgram.update({
    where: { id: p.id },
    data: { blockStartedOn: toDateColumn(start), trainingMaxes: maxes, cycle: p.cycle + 1, lastRaises },
  });
}

/** Set (or clear, with 0) one lift's training max. */
export async function setTrainingMax(userId: string, poolExerciseId: string, weight: number): Promise<void> {
  const p = await loadActiveProgram(userId);
  if (!p || !poolExerciseId) return;
  const maxes = { ...p.trainingMaxes };
  if (weight > 0) maxes[poolExerciseId] = weight;
  else delete maxes[poolExerciseId];
  await prisma.personProgram.update({ where: { id: p.id }, data: { trainingMaxes: maxes } });
}

/** The planned entry a slot comes from on a day (its scheme and program slot). */
export async function plannedSlotFor(
  userId: string,
  dateISO: string,
  slot: string,
): Promise<{ scheme: string | null; programRole: string | null; muscleGroup: string | null; programId?: string | null } | null> {
  const rows = (await prisma.plannedExercise.findMany({
    where: { poolExerciseId: slot, plannedWorkout: { userId, dayOfWeek: await planDow(userId, dateISO) } },
    select: { scheme: true, programRole: true, plannedWorkout: { select: { muscleGroup: true, programId: true } } },
  })) as { scheme: string | null; programRole: string | null; plannedWorkout: { muscleGroup: string | null; programId: string | null } }[];
  const r = rows.find((x) => x.scheme) ?? rows[0];
  if (r) return { scheme: r.scheme, programRole: r.programRole, muscleGroup: r.plannedWorkout.muscleGroup, programId: r.plannedWorkout.programId };
  // An isometric workout added to the day (v0.667) brings its own sets.
  const extra = await extraSlotFor(userId, dateISO, slot);
  return extra ? { scheme: extra, programRole: null, muscleGroup: null } : null;
}

/** "Nov 3" for a saved plan's name. */
function shortDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

// --- the invite -------------------------------------------------------------------

const inviteKey = (userId: string) => `workouts.invite.${userId}`;

/**
 * "Start a workout program?" for someone with no plan, no program and nothing
 * logged in 30 days. "Not now" asks again in 30 days; "Don't ask again" stops it.
 */
export async function inviteFor(userId: string, today = todayISO()): Promise<boolean> {
  const snooze = await getSetting(inviteKey(userId));
  if (snooze === "never") return false;
  if (snooze && /^\d{4}-\d{2}-\d{2}$/.test(snooze) && snooze > today) return false;
  const [program, plans, rotation, recent] = (await Promise.all([
    prisma.personProgram.count({ where: { userId, status: "ACTIVE" } }),
    prisma.plannedWorkout.count({ where: { userId, isRest: false } }),
    prisma.workoutRotation.count({ where: { userId, isActive: true } }),
    prisma.workoutSession.count({
      where: { userId, isRest: false, date: { gte: toDateColumn(addDays(today, -30)) } },
    }),
  ])) as [number, number, number, number];
  return program === 0 && plans === 0 && rotation === 0 && recent === 0;
}

export async function answerInvite(userId: string, answer: "later" | "never"): Promise<void> {
  await setSetting(inviteKey(userId), answer === "never" ? "never" : addDays(todayISO(), 30));
}
