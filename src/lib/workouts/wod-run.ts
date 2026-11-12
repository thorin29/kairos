import "server-only";
import { planDow } from "@/lib/workouts/day-swap-run";
import { prisma } from "@/lib/prisma";
import { getSetting, setSetting } from "@/lib/settings";
import { addDays, dayOfWeek, fromDateColumn, toDateColumn } from "@/lib/dates";
import { formatHiitMovement, hiitResult, type WorkoutType } from "@/lib/workouts/catalog";
import { nameKey, type EquipmentItem } from "@/lib/workouts/library";
import { loadEquipment } from "@/lib/workouts/library-run";
import { settleWorkoutTask } from "@/lib/workouts/mark";
import { clockText } from "@/lib/workouts/timer";
import type { BuiltWorkout } from "@/lib/workouts/finisher";
import {
  WOD_LIBRARY,
  benchmarkForMonth,
  defaultVersion,
  hasScaled,
  planWodMerge,
  versionMoves,
  wodEquipment,
  type WodMove,
} from "@/lib/workouts/wod-library";

export type Version = "RX" | "SCALED";
export const cleanVersion = (v: unknown): Version | null => (v === "RX" || v === "SCALED" ? v : null);

/** "8 rounds", "7:42", "12 min", "180 reps" — and " · Scaled" when it was. */
export function resultText(type: WorkoutType, reps: number | null, seconds: number | null, version?: string | null): string | null {
  const r = hiitResult(type);
  let t: string | null;
  if (r.metric === "DURATION") t = seconds ? clockText(seconds) : null;
  else if (reps == null) t = null;
  else if (type === "AMRAP") t = `${reps} ${reps === 1 ? "round" : "rounds"}`;
  else if (type === "EMOM") t = `${reps} min`;
  else t = `${reps} reps`;
  return t && version === "SCALED" ? `${t} · Scaled` : t;
}

export type MoveLine = { name: string; reps: number | null; distance: number | null; weight: number | null; line: string };
const lines = (moves: readonly WodMove[]): MoveLine[] => moves.map((m) => ({ ...m, line: formatHiitMovement(m) }));

/** Scaled stored on a workout: [{ reps, weight, distance }] per movement. */
export function readScaled(raw: unknown, count: number): Partial<WodMove>[] | null {
  if (!Array.isArray(raw)) return null;
  const n = (v: unknown) => (v == null ? null : Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : null);
  return Array.from({ length: count }, (_, i) => {
    const s = raw[i];
    if (!s || typeof s !== "object") return {};
    const o = s as Record<string, unknown>;
    const out: Partial<WodMove> = {};
    if ("reps" in o) out.reps = n(o.reps);
    if ("weight" in o) out.weight = n(o.weight);
    if ("distance" in o) out.distance = n(o.distance);
    return out;
  });
}

/** The person's starting version: Scaled for younger people. */
export async function versionFor(userId: string, dateISO: string): Promise<Version> {
  const u = (await prisma.user.findUnique({ where: { id: userId }, select: { birthday: true } })) as {
    birthday: Date | null;
  } | null;
  return defaultVersion(u?.birthday ? fromDateColumn(u.birthday) : null, dateISO);
}

// --- logging -----------------------------------------------------------------

/**
 * Write one conditioning result: a HIIT session under the workout's name with
 * the result as its one set. `replace` drops that workout's earlier result on
 * the same day first (one per workout per day). Settles the day's task.
 */
export async function writeConditioning(input: {
  userId: string;
  dateISO: string;
  name: string;
  type: WorkoutType;
  movementLines: string[];
  value: number;
  notes?: string | null;
  replace?: boolean;
  version?: Version | null;
  completedOnISO?: string | null;
}): Promise<void> {
  const { metric } = hiitResult(input.type);
  const notes =
    [input.movementLines.join(", "), input.notes?.trim() || ""].filter(Boolean).join(" — ").slice(0, 300) || null;
  const date = toDateColumn(input.dateISO);
  if (input.replace) {
    await prisma.workoutSession.deleteMany({
      where: {
        userId: input.userId,
        date,
        isRest: false,
        category: "HIIT" as never,
        name: { in: [input.name.slice(0, 60), input.name.slice(0, 40)] },
      },
    });
  }
  const completedOn =
    input.completedOnISO && /^\d{4}-\d{2}-\d{2}$/.test(input.completedOnISO) && input.completedOnISO !== input.dateISO
      ? toDateColumn(input.completedOnISO)
      : null;
  const session = (await prisma.workoutSession.create({
    data: {
      userId: input.userId,
      date,
      name: input.name.slice(0, 60),
      category: "HIIT" as never,
      workoutType: input.type as never,
      finished: true,
      isRest: false,
      notes,
      version: input.version ?? null,
      ...(completedOn ? { completedOn } : {}),
    },
    select: { id: true },
  })) as { id: string };
  const v = Math.round(input.value);
  await prisma.sessionSet.create({
    data: {
      sessionId: session.id,
      poolExerciseId: null,
      setNumber: 1,
      unit: null,
      finished: true,
      ...(metric === "DURATION" ? { seconds: v } : { reps: v }),
    },
  });
  await settleWorkoutTask(input.userId, input.dateISO, { fallbackComplete: true });
}

type WorkoutRow = {
  id: string;
  name: string;
  type: WorkoutType;
  capSec: number | null;
  ownerId: string | null;
  approved: boolean;
  heroWod: boolean;
  about: string | null;
  kind: string | null;
  minutes: number | null;
  scaled: unknown;
  libraryKey: string | null;
  movements: { reps: number | null; distance: number | null; weight: number | null; poolExercise: { name: string } | null }[];
};

const WORKOUT_SELECT = {
  id: true,
  name: true,
  type: true,
  capSec: true,
  ownerId: true,
  approved: true,
  heroWod: true,
  about: true,
  kind: true,
  minutes: true,
  scaled: true,
  libraryKey: true,
  movements: {
    orderBy: { position: "asc" },
    select: { reps: true, distance: true, weight: true, poolExercise: { select: { name: true } } },
  },
} as const;

const movesOf = (w: WorkoutRow): WodMove[] =>
  w.movements
    .filter((m) => m.poolExercise)
    .map((m) => ({ name: m.poolExercise!.name, reps: m.reps, distance: m.distance, weight: m.weight }));

/** Log a result for a named workout, in a version. */
export async function logNamedConditioning(input: {
  userId: string;
  dateISO: string;
  hiitWorkoutId: string;
  value: number;
  notes?: string | null;
  replace?: boolean;
  version?: Version | null;
  completedOnISO?: string | null;
}): Promise<boolean> {
  if (!Number.isFinite(input.value) || input.value <= 0) return false;
  const w = (await prisma.hiitWorkout.findUnique({ where: { id: input.hiitWorkoutId }, select: WORKOUT_SELECT })) as
    | WorkoutRow
    | null;
  if (!w || (!w.approved && w.ownerId !== input.userId && w.ownerId !== null)) return false;
  const moves = movesOf(w);
  const scaled = readScaled(w.scaled, moves.length);
  const version = input.version === "SCALED" && hasScaled(moves, scaled) ? "SCALED" : input.version ? "RX" : null;
  await writeConditioning({
    userId: input.userId,
    dateISO: input.dateISO,
    name: w.name,
    type: w.type,
    movementLines: versionMoves(moves, scaled, version ?? "RX").map((m) => formatHiitMovement(m)),
    value: input.value,
    notes: input.notes,
    replace: input.replace,
    version,
    completedOnISO: input.completedOnISO,
  });
  return true;
}

/** Log a result for a workout built on the spot. */
export async function logBuiltConditioning(input: {
  userId: string;
  dateISO: string;
  built: BuiltWorkout;
  value: number;
  version: Version | null;
  replace?: boolean;
  completedOnISO?: string | null;
}): Promise<boolean> {
  if (!Number.isFinite(input.value) || input.value <= 0) return false;
  const version = input.version === "SCALED" && hasScaled(input.built.moves, input.built.scaled) ? "SCALED" : input.version ? "RX" : null;
  await writeConditioning({
    userId: input.userId,
    dateISO: input.dateISO,
    name: input.built.name,
    type: input.built.type,
    movementLines: versionMoves(input.built.moves, input.built.scaled, version ?? "RX").map((m) => formatHiitMovement(m)),
    value: input.value,
    replace: input.replace,
    version,
    completedOnISO: input.completedOnISO,
  });
  return true;
}

// --- pool movements by name ---------------------------------------------------

/** Pool movement ids for these names: shared ones first, then the person's
 *  own; any missing are added to the shared pool under HIIT. */
async function poolIdsFor(names: readonly string[], userId: string | null): Promise<Map<string, string>> {
  const pool = (await prisma.poolExercise.findMany({
    where: { OR: [{ ownerId: null }, ...(userId ? [{ ownerId: userId }] : [])] },
    select: { id: true, name: true, ownerId: true, category: true },
  })) as { id: string; name: string; ownerId: string | null; category: string }[];
  const byKey = new Map<string, string>();
  // HIIT first, then shared over own, so a name in several categories lands on
  // the conditioning one.
  const ranked = [...pool].sort(
    (a, b) => Number(a.category !== "HIIT") - Number(b.category !== "HIIT") || Number(a.ownerId != null) - Number(b.ownerId != null),
  );
  for (const p of ranked) if (!byKey.has(nameKey(p.name))) byKey.set(nameKey(p.name), p.id);
  const out = new Map<string, string>();
  let base: number | null = null;
  for (const name of names) {
    const k = nameKey(name);
    let id = byKey.get(k);
    if (!id) {
      base ??= (await prisma.poolExercise.count({ where: { category: "HIIT" as never } })) as number;
      const made = (await prisma.poolExercise
        .create({ data: { category: "HIIT" as never, name: name.slice(0, 60), sortOrder: base++ }, select: { id: true } })
        .catch(() => null)) as { id: string } | null;
      if (!made) continue;
      id = made.id;
      byKey.set(k, id);
    }
    out.set(k, id);
  }
  return out;
}

// --- the workouts library (Admin) --------------------------------------------

export type WodLibraryStatus = {
  total: number;
  add: { key: string; name: string; kind: string; type: WorkoutType; minutes: number }[];
};

async function existingForMerge() {
  return (await prisma.hiitWorkout.findMany({ select: { name: true, libraryKey: true, ownerId: true } })) as {
    name: string;
    libraryKey: string | null;
    ownerId: string | null;
  }[];
}

export async function wodLibraryStatus(): Promise<WodLibraryStatus> {
  const add = planWodMerge(await existingForMerge());
  return {
    total: WOD_LIBRARY.length,
    add: add.map((w) => ({ key: w.key, name: w.name, kind: w.kind, type: w.type, minutes: w.minutes })),
  };
}

/** Add library workouts (all new, or the picked keys) as shared, approved
 *  workouts. Running it again adds nothing. */
export async function applyWodLibrary(keys?: readonly string[] | null): Promise<{ added: number }> {
  const pick = keys ? new Set(keys) : null;
  const add = planWodMerge(await existingForMerge()).filter((w) => !pick || pick.has(w.key));
  if (add.length === 0) return { added: 0 };
  const ids = await poolIdsFor([...new Set(add.flatMap((w) => w.moves.map((m) => m.name)))], null);
  let order = (await prisma.hiitWorkout.count({ where: { ownerId: null } })) as number;
  let added = 0;
  for (const w of add) {
    const moves = w.moves.filter((m) => ids.has(nameKey(m.name)));
    const ok = await prisma.hiitWorkout
      .create({
        data: {
          name: w.name,
          type: w.type as never,
          ownerId: null,
          approved: true,
          capSec: w.capSec,
          heroWod: w.kind === "HERO",
          libraryKey: w.key,
          about: w.about,
          kind: w.kind,
          minutes: w.minutes,
          scaled: w.moves.map((m, i) => (moves.includes(m) ? w.scaled[i] ?? {} : null)).filter((x) => x !== null) as never,
          sortOrder: order++,
          movements: {
            create: moves.map((m, i) => ({
              poolExerciseId: ids.get(nameKey(m.name))!,
              reps: m.reps,
              distance: m.distance,
              weight: m.weight,
              position: i,
            })),
          },
        },
      })
      .then(() => true)
      .catch(() => false);
    if (ok) added++;
  }
  return { added };
}

/** Keep a built workout as the person's own (shareable like any other). */
export async function saveBuiltWorkout(userId: string, built: BuiltWorkout): Promise<string | null> {
  const ids = await poolIdsFor(built.moves.map((m) => m.name), userId);
  const moves = built.moves.map((m, i) => ({ m, s: built.scaled[i] ?? {} })).filter((x) => ids.has(nameKey(x.m.name)));
  if (moves.length === 0) return null;
  const count = (await prisma.hiitWorkout.count({ where: { ownerId: userId } })) as number;
  const made = (await prisma.hiitWorkout.create({
    data: {
      name: built.name.slice(0, 60),
      type: built.type as never,
      ownerId: userId,
      approved: false,
      capSec: built.capSec,
      about: built.about || null,
      kind: "BUILT",
      minutes: built.minutes,
      scaled: moves.map((x) => x.s) as never,
      sortOrder: count,
      movements: {
        create: moves.map((x, i) => ({
          poolExerciseId: ids.get(nameKey(x.m.name))!,
          reps: x.m.reps,
          distance: x.m.distance,
          weight: x.m.weight,
          position: i,
        })),
      },
    },
    select: { id: true },
  })) as { id: string };
  return made.id;
}

// --- Pick one ----------------------------------------------------------------

export type WodChoice = {
  hiitWorkoutId: string;
  name: string;
  type: WorkoutType;
  capSec: number | null;
  /** About how long it takes. */
  minutes: number | null;
  /** DAILY / BENCHMARK / HERO from the library, BUILT, or null. */
  kind: string | null;
  mine: boolean;
  about: string | null;
  equipment: string[];
  movements: MoveLine[];
  /** The Scaled version's movements, when it differs. */
  scaled: MoveLine[] | null;
  resultLabel: string;
  resultMetric: "REPS" | "DURATION";
  last: string | null;
  lastDate: string | null;
  best: { name: string; result: string } | null;
};

/** About how long a workout takes when it doesn't say. */
function estimateMinutes(type: WorkoutType, capSec: number | null, count: number): number | null {
  if (type === "TABATA") return count * 4;
  if (type === "TIMED_STATIONS" && capSec) return Math.round((capSec * count) / 60);
  if (capSec && (type === "AMRAP" || type === "EMOM")) return Math.round(capSec / 60);
  return null;
}

/**
 * What can be picked on the day: every approved workout and the person's own,
 * with how long, what it needs, their last result and the household best.
 * Not done lately first; heroes last.
 */
export async function conditioningChoices(
  userId: string,
  dateISO: string,
): Promise<{ choices: WodChoice[]; version: Version; equipment: EquipmentItem[] }> {
  const [rows, version, equipment] = await Promise.all([
    prisma.hiitWorkout.findMany({
      where: { OR: [{ approved: true }, { ownerId: userId }] },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: WORKOUT_SELECT,
    }) as Promise<WorkoutRow[]>,
    versionFor(userId, dateISO),
    loadEquipment(),
  ]);
  const visible = rows.filter((w) => w.ownerId == null || w.ownerId === userId);
  const names = [...new Set(visible.flatMap((w) => [w.name.slice(0, 60), w.name.slice(0, 40)]))];
  const sessions = (names.length
    ? await prisma.workoutSession.findMany({
        where: { category: "HIIT" as never, isRest: false, name: { in: names }, date: { lte: toDateColumn(dateISO) } },
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        take: 2000,
        select: {
          userId: true,
          date: true,
          name: true,
          version: true,
          user: { select: { name: true, displayName: true } },
          sets: { orderBy: { setNumber: "asc" }, take: 1, select: { reps: true, seconds: true } },
        },
      })
    : []) as {
    userId: string;
    date: Date;
    name: string | null;
    version: string | null;
    user: { name: string; displayName: string | null } | null;
    sets: { reps: number | null; seconds: number | null }[];
  }[];
  const byName = new Map<string, typeof sessions>();
  for (const s of sessions) {
    const k = (s.name ?? "").slice(0, 40);
    byName.set(k, [...(byName.get(k) ?? []), s]);
  }

  const choices = visible.map((w): WodChoice => {
    const moves = movesOf(w);
    const scaled = readScaled(w.scaled, moves.length);
    const r = hiitResult(w.type);
    const dur = r.metric === "DURATION";
    const mine = byName.get(w.name.slice(0, 40)) ?? [];
    const val = (s: (typeof mine)[number]) => (dur ? s.sets[0]?.seconds ?? null : s.sets[0]?.reps ?? null);
    const text = (s: (typeof mine)[number]) => resultText(w.type, s.sets[0]?.reps ?? null, s.sets[0]?.seconds ?? null, s.version);
    const last = mine.find((s) => s.userId === userId && val(s) != null);
    let best: (typeof mine)[number] | undefined;
    for (const s of mine) {
      if (s.version === "SCALED") continue;
      const v = val(s);
      if (v == null || v <= 0) continue;
      const b = best ? val(best) : null;
      if (b == null || (dur ? v < b : v > b)) best = s;
    }
    return {
      hiitWorkoutId: w.id,
      name: w.name,
      type: w.type,
      capSec: w.capSec,
      minutes: w.minutes ?? estimateMinutes(w.type, w.capSec, moves.length),
      kind: w.kind ?? (w.heroWod ? "HERO" : null),
      mine: w.ownerId === userId,
      about: w.about,
      equipment: wodEquipment({ moves }),
      movements: lines(moves),
      scaled: hasScaled(moves, scaled) ? lines(versionMoves(moves, scaled, "SCALED")) : null,
      resultLabel: r.label,
      resultMetric: dur ? "DURATION" : "REPS",
      last: last ? text(last) : null,
      lastDate: last ? fromDateColumn(last.date) : null,
      best: best
        ? { name: best.userId === userId ? "you" : best.user?.displayName?.trim() || best.user?.name || "", result: text(best) ?? "" }
        : null,
    };
  });
  const rank = (c: WodChoice) => (c.kind === "HERO" ? 2 : 0) + (c.lastDate ? 1 : 0);
  choices.sort((a, b) => rank(a) - rank(b) || (a.lastDate ?? "").localeCompare(b.lastDate ?? ""));
  return { choices, version, equipment: equipment.filter((e) => e.have) };
}

// --- "Pick on the day" plans -------------------------------------------------

export type PickPlan = {
  plannedWorkoutId: string;
  name: string;
  /** Conditioning logged on the day, any workout. */
  done: { name: string; result: string | null }[];
  effort: string | null;
  hurt: string | null;
  skipped: boolean;
};

/** The day's Conditioning plans with no workout chosen ahead (v0.617): done
 *  by any conditioning result that day. */
export async function pickPlansFor(userId: string, dateISO: string): Promise<PickPlan[]> {
  const plans = (await prisma.plannedWorkout.findMany({
    where: {
      userId,
      dayOfWeek: await planDow(userId, dateISO),
      isRest: false,
      hiitWorkoutId: null,
      category: "HIIT" as never,
      createdAt: { lt: toDateColumn(addDays(dateISO, 1)) },
    },
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true, _count: { select: { exercises: true } } },
  })) as { id: string; name: string; _count: { exercises: number } }[];
  const list = plans.filter((p) => p._count.exercises === 0);
  if (list.length === 0) return [];
  const [done, feedback, skips] = (await Promise.all([
    conditioningOnDay(userId, dateISO),
    prisma.workoutFeedback.findMany({
      where: { userId, date: toDateColumn(dateISO), slot: { in: list.map((p) => `hiit:${p.id}`) } },
      select: { slot: true, effort: true, hurt: true },
    }),
    prisma.workoutMovementSkip.findMany({
      where: { userId, date: toDateColumn(dateISO), slot: { in: list.map((p) => `plan:${p.id}`) } },
      select: { slot: true },
    }),
  ])) as [
    { name: string; result: string | null }[],
    { slot: string; effort: string | null; hurt: string | null }[],
    { slot: string }[],
  ];
  const skipped = new Set(skips.map((k) => k.slot));
  const fb = new Map(feedback.map((f) => [f.slot, f]));
  return list.map((p) => ({
    plannedWorkoutId: p.id,
    name: p.name,
    done,
    effort: fb.get(`hiit:${p.id}`)?.effort ?? null,
    hurt: fb.get(`hiit:${p.id}`)?.hurt ?? null,
    skipped: skipped.has(`plan:${p.id}`),
  }));
}

/** Every conditioning result logged on a day. */
export async function conditioningOnDay(userId: string, dateISO: string): Promise<{ name: string; result: string | null }[]> {
  const rows = (await prisma.workoutSession.findMany({
    where: { userId, date: toDateColumn(dateISO), isRest: false, category: "HIIT" as never },
    orderBy: { createdAt: "asc" },
    select: {
      name: true,
      workoutType: true,
      version: true,
      sets: { orderBy: { setNumber: "asc" }, take: 1, select: { reps: true, seconds: true } },
    },
  })) as {
    name: string | null;
    workoutType: WorkoutType | null;
    version: string | null;
    sets: { reps: number | null; seconds: number | null }[];
  }[];
  return rows.map((r) => ({
    name: r.name ?? "Conditioning",
    result: r.workoutType ? resultText(r.workoutType, r.sets[0]?.reps ?? null, r.sets[0]?.seconds ?? null, r.version) : null,
  }));
}

// --- the monthly benchmark ---------------------------------------------------

const benchKey = (userId: string) => `workouts.benchmark.${userId}`;
const benchSkipKey = (userId: string) => `workouts.benchmark.skip.${userId}`;

export type BenchmarkState = {
  /** OFFER: ask whether to do one each month. SUGGEST: this month's is due. */
  state: "OFFER" | "SUGGEST";
  /** This month's benchmark (SUGGEST), or the one that would come first. */
  workout: { hiitWorkoutId: string; name: string; about: string | null; minutes: number | null } | null;
} | null;

/**
 * The monthly benchmark (v0.617): offered once a person has a month of
 * conditioning behind them; when on, the first week of each month suggests
 * that month's until it's logged or set aside.
 */
export async function benchmarkFor(userId: string, dateISO: string): Promise<BenchmarkState> {
  const [setting, skip, benches] = await Promise.all([
    getSetting(benchKey(userId)),
    getSetting(benchSkipKey(userId)),
    prisma.hiitWorkout.findMany({
      where: { kind: "BENCHMARK", approved: true, ownerId: null },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, about: true, minutes: true, capSec: true, type: true, libraryKey: true },
    }) as Promise<{ id: string; name: string; about: string | null; minutes: number | null; libraryKey: string | null }[]>,
  ]);
  if (benches.length === 0 || setting === "never") return null;
  const month = dateISO.slice(0, 7);
  const i = benchmarkForMonth(dateISO, benches);
  const b = benches[i];
  const workout = { hiitWorkoutId: b.id, name: b.name, about: b.about, minutes: b.minutes };

  if (setting === "on") {
    if (Number(dateISO.slice(8, 10)) > 7 || skip === month) return null;
    const logged = (await prisma.workoutSession.count({
      where: {
        userId,
        isRest: false,
        category: "HIIT" as never,
        name: { in: [b.name.slice(0, 60), b.name.slice(0, 40)] },
        date: { gte: toDateColumn(`${month}-01`), lte: toDateColumn(dateISO) },
      },
    })) as number;
    return logged > 0 ? null : { state: "SUGGEST", workout };
  }
  // Not answered, or "later" until a date.
  if (setting && setting.startsWith("later:") && dateISO < setting.slice(6)) return null;
  const first = (await prisma.workoutSession.findFirst({
    where: { userId, isRest: false, category: "HIIT" as never },
    orderBy: { date: "asc" },
    select: { date: true },
  })) as { date: Date } | null;
  if (!first || fromDateColumn(first.date) > addDays(dateISO, -30)) return null;
  return { state: "OFFER", workout };
}

/** Answer the offer (yes / later / never) or set this month's aside. */
export async function answerBenchmark(userId: string, dateISO: string, answer: string): Promise<void> {
  if (answer === "yes") await setSetting(benchKey(userId), "on");
  else if (answer === "never" || answer === "off") await setSetting(benchKey(userId), "never");
  else if (answer === "later") await setSetting(benchKey(userId), `later:${addDays(dateISO, 30)}`);
  else if (answer === "skip") await setSetting(benchSkipKey(userId), dateISO.slice(0, 7));
}
