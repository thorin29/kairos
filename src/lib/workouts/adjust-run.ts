import "server-only";
import { prisma } from "@/lib/prisma";
import { toDateColumn } from "@/lib/dates";
import { dayPlanWhere, movementTarget } from "@/lib/queries/workout-log";
import { dayAdjust, setAdjust } from "@/lib/workouts/suggest-run";
import { roundLoad } from "@/lib/workouts/programs";
import { groupsFor } from "@/lib/workouts/involvement";
import type { MuscleGroup } from "@/lib/workouts/catalog";
import { OPTIONAL_CATEGORIES } from "@/lib/workouts/blocks";
import {
  ADJUST_FACTOR,
  adjustKeep,
  adjustLabel,
  cleanAdjust,
  loadsArea,
  perSetFrom,
  pickStandIns,
  planShort,
  type HurtSwap,
  type Adjust,
  type AdjustMode,
  type EntryIn,
  type LiftIn,
  type ShortPlan,
  type TimePick,
} from "@/lib/workouts/adjust";

/**
 * Adjust today (v0.658), with the database: the day's plan read once, the
 * person's own time per set, previews, and what an adjustment drops.
 */

type PlanRow = {
  id: string;
  name: string;
  category: string | null;
  muscleGroup: string | null;
  core: unknown;
  hiitWorkoutId: string | null;
  hiitWorkout: { name: string; minutes: number | null; capSec: number | null; movements: { poolExercise: { name: string } }[] } | null;
  exercises: { poolExerciseId: string; poolExercise: { name: string } }[];
};

async function dayPlan(userId: string, dateISO: string): Promise<PlanRow[]> {
  return (await prisma.plannedWorkout.findMany({
    where: dayPlanWhere(userId, dateISO),
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      name: true,
      category: true,
      muscleGroup: true,
      core: true,
      hiitWorkoutId: true,
      hiitWorkout: {
        select: { name: true, minutes: true, capSec: true, movements: { select: { poolExercise: { select: { name: true } } } } },
      },
      exercises: { orderBy: { sortOrder: "asc" }, select: { poolExerciseId: true, poolExercise: { select: { name: true } } } },
    },
  })) as unknown as PlanRow[];
}

const toEntry = (p: PlanRow): EntryIn => ({
  category: p.category,
  core: p.core != null,
  muscleGroup: p.muscleGroup,
  name: p.name,
  parts: (p.hiitWorkout?.movements ?? []).map((m) => m.poolExercise.name),
  exercises: p.exercises.map((e) => ({ poolExerciseId: e.poolExerciseId, name: e.poolExercise.name })),
});

const CARDIO = ["CARDIO", "RUNNING", "ROWING", "RUCKING"];

/** What today's adjustment drops: whole plan entries and single movements. */
export type AdjustDropped = { plans: string[]; movements: string[] };

export async function adjustDroppedFor(userId: string, dateISO: string, adj?: Adjust | null): Promise<AdjustDropped | null> {
  const a = adj === undefined ? await dayAdjust(userId, dateISO) : adj;
  if (!a) return null;
  const plans = await dayPlan(userId, dateISO);
  const keep = adjustKeep(a, plans.map(toEntry));
  const out: AdjustDropped = { plans: [], movements: [] };
  plans.forEach((p, i) => {
    if (!keep[i].stays) out.plans.push(p.id);
    for (const e of p.exercises) if (!keep[i].keep.includes(e.poolExerciseId)) out.movements.push(e.poolExerciseId);
  });
  return out;
}

/** Today's adjustment for the day page: which, and its header. */
export type AdjustView = { mode: AdjustMode; label: string; dropped: AdjustDropped };

export async function adjustView(userId: string, dateISO: string): Promise<AdjustView | null> {
  const a = await dayAdjust(userId, dateISO);
  if (!a) return null;
  return { mode: a.mode, label: adjustLabel(a), dropped: (await adjustDroppedFor(userId, dateISO, a)) ?? { plans: [], movements: [] } };
}

/** Gaps between the person's logged weight sets, last 90 days (seconds). */
async function setGaps(userId: string, dateISO: string): Promise<number[]> {
  const since = new Date(Date.parse(`${dateISO}T00:00:00Z`) - 90 * 86_400_000);
  const rows = (await prisma.sessionSet.findMany({
    where: {
      poolExerciseId: { not: null },
      weight: { gt: 0 },
      session: { userId, isRest: false, category: "WEIGHTS" as never, date: { gte: toDateColumn(since.toISOString().slice(0, 10)) } },
    },
    orderBy: { createdAt: "asc" },
    select: { sessionId: true, createdAt: true },
    take: 2000,
  })) as { sessionId: string; createdAt: Date }[];
  const gaps: number[] = [];
  for (let i = 1; i < rows.length; i++) {
    if (rows[i].sessionId !== rows[i - 1].sessionId) continue;
    gaps.push((rows[i].createdAt.getTime() - rows[i - 1].createdAt.getTime()) / 1000);
  }
  return gaps;
}

/** Today's strength movements with their set counts, for Short on time. */
async function liftsFor(userId: string, dateISO: string, plans: PlanRow[]): Promise<LiftIn[]> {
  const out: LiftIn[] = [];
  for (const p of plans) {
    if (p.category !== "WEIGHTS") continue;
    for (const [i, e] of p.exercises.entries()) {
      const t = await movementTarget(userId, dateISO, e.poolExerciseId, e.poolExerciseId, [], []);
      const sets = t?.sets ?? [];
      const warmSets = sets.filter((s) => s.warmup).length;
      const suppSets = sets.filter((s) => s.supplemental).length;
      const workSets = sets.length ? sets.length - warmSets - suppSets : 3;
      if (out.some((l) => l.id === e.poolExerciseId)) continue;
      out.push({ id: e.poolExerciseId, name: e.poolExercise.name, main: i === 0 && p.core == null, warmSets, workSets, suppSets });
    }
  }
  return out;
}

export type ShortAnswer = ShortPlan & { available: Record<TimePick, boolean> };

/** Short on time: the choices' estimates and the preview for this time. */
export async function shortPlanFor(
  userId: string,
  dateISO: string,
  input: { minutes: number; picks: TimePick[]; cardioMin: number },
): Promise<ShortAnswer> {
  const plans = await dayPlan(userId, dateISO);
  const [lifts, gaps] = await Promise.all([liftsFor(userId, dateISO, plans), setGaps(userId, dateISO)]);
  const hiit = plans.find((p) => p.category === "HIIT");
  const conditioning = hiit
    ? {
        name: hiit.hiitWorkout?.name ?? hiit.name,
        minutes: hiit.hiitWorkout?.minutes ?? (hiit.hiitWorkout?.capSec ? Math.ceil(hiit.hiitWorkout.capSec / 60) : 10),
      }
    : null;
  const available: Record<TimePick, boolean> = {
    weights: lifts.length > 0,
    cardio: plans.some((p) => CARDIO.includes(p.category ?? "")),
    conditioning: !!conditioning,
  };
  const picks = input.picks.filter((p) => available[p]);
  const plan = planShort({ ...input, picks, lifts, conditioning, ...perSetFrom(gaps) });
  return { ...plan, available };
}

/** A preview line: a movement or entry, what it'll be, or that it's dropped. */
/** `standIn` (v0.675): a replacement for the movement on the line before. */
export type AdjustLine = { label: string; detail: string | null; dropped: boolean; standIn?: boolean };
export type AdjustPreview = {
  title: string;
  tag: string;
  note: string | null;
  lines: AdjustLine[];
  /** Hurt: nothing left to lift. */
  empty: boolean;
  /** Hurt: stand-ins could be offered for what comes out (v0.675). */
  canReplace?: boolean;
};

/** The person's lifts of the last eight weeks, how often, for stand-ins. */
async function recentLifts(userId: string, dateISO: string) {
  const since = new Date(Date.parse(`${dateISO}T00:00:00Z`) - 56 * 86_400_000).toISOString().slice(0, 10);
  const rows = (await prisma.sessionSet.findMany({
    where: {
      finished: true,
      poolExerciseId: { not: null },
      OR: [{ reps: { gt: 0 } }, { seconds: { gt: 0 } }],
      session: { userId, isRest: false, date: { gte: toDateColumn(since), lt: toDateColumn(dateISO) } },
    },
    select: {
      poolExerciseId: true,
      poolExercise: { select: { name: true, muscleGroup: true } },
      session: { select: { date: true, category: true } },
    },
  })) as {
    poolExerciseId: string;
    poolExercise: { name: string; muscleGroup: string | null } | null;
    session: { date: Date; category: string | null };
  }[];
  const by = new Map<string, { name: string; group: string | null; days: Set<number> }>();
  for (const r of rows) {
    if (!r.poolExercise || (r.session.category && (OPTIONAL_CATEGORIES.includes(r.session.category) || r.session.category === "HIIT"))) continue;
    const c = by.get(r.poolExerciseId) ?? {
      name: r.poolExercise.name,
      group: groupsFor(r.poolExercise.name, r.poolExercise.muscleGroup as MuscleGroup | null).primary ?? null,
      days: new Set<number>(),
    };
    c.days.add(r.session.date.getTime());
    by.set(r.poolExerciseId, c);
  }
  return [...by].map(([id, c]) => ({ id, name: c.name, group: c.group, times: c.days.size }));
}

/** Stand-ins for what a hurt area takes out of today's lifting (v0.675). */
async function standInsFor(userId: string, dateISO: string, a: Extract<Adjust, { mode: "hurt" }>, plans: PlanRow[]): Promise<HurtSwap[]> {
  const out: { id: string; group: string | null }[] = [];
  for (const p of plans) {
    if (p.category !== "WEIGHTS") continue;
    for (const e of p.exercises) {
      if (!loadsArea(a.area, e.poolExercise.name, p.core != null ? null : p.muscleGroup)) continue;
      out.push({ id: e.poolExerciseId, group: groupsFor(e.poolExercise.name, null).primary ?? (p.core != null ? "CORE" : p.muscleGroup) });
    }
  }
  if (out.length === 0) return [];
  const planIds = plans.flatMap((p) => p.exercises.map((e) => e.poolExerciseId));
  return pickStandIns(a.area, out, await recentLifts(userId, dateISO), planIds);
}

/** Last time's sets for each movement: "3 × 5 · 155 lb" at a share. */
async function lastLines(userId: string, dateISO: string, ids: string[], factor: number): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const rows = (await prisma.sessionSet.findMany({
    where: { poolExerciseId: { in: ids }, weight: { gt: 0 }, session: { userId, isRest: false, date: { lt: toDateColumn(dateISO) } } },
    select: { poolExerciseId: true, weight: true, reps: true, unit: true, session: { select: { date: true } } },
  })) as { poolExerciseId: string; weight: number; reps: number | null; unit: string | null; session: { date: Date } }[];
  const last = new Map<string, typeof rows>();
  for (const r of rows) {
    const cur = last.get(r.poolExerciseId);
    const t = r.session.date.getTime();
    if (!cur || t > cur[0].session.date.getTime()) last.set(r.poolExerciseId, [r]);
    else if (t === cur[0].session.date.getTime()) cur.push(r);
  }
  const out = new Map<string, string>();
  for (const [id, sets] of last) {
    const top = sets.reduce((a, b) => (b.weight > a.weight ? b : a));
    const unit = top.unit ?? "lb";
    out.set(id, `${sets.length} × ${top.reps ?? "?"} · ${roundLoad(top.weight * factor, unit)} ${unit}`);
  }
  return out;
}

/** The preview for Low energy, Sick and Hurt. */
export async function adjustPreview(userId: string, dateISO: string, a: Adjust): Promise<AdjustPreview> {
  const plans = await dayPlan(userId, dateISO);
  // Hurt: what could stand in, and whether this preview shows them.
  const offered = a.mode === "hurt" ? await standInsFor(userId, dateISO, a, plans) : [];
  const swaps = a.mode === "hurt" && a.replace !== false ? offered : [];
  const keep = adjustKeep(a.mode === "hurt" ? { ...a, swaps: [] } : a, plans.map(toEntry));
  const factor = a.mode === "low" ? ADJUST_FACTOR.low : a.mode === "sick" ? ADJUST_FACTOR.sick : 1;
  const ids = [...plans.flatMap((p) => p.exercises.map((e) => e.poolExerciseId)), ...swaps.map((s) => s.to)];
  const lines = await lastLines(userId, dateISO, ids, factor);
  const out: AdjustLine[] = [];
  let lifts = 0;
  let kept = 0;
  plans.forEach((p, i) => {
    if (p.category === "WARMUP") return;
    if (p.category === "WEIGHTS") {
      for (const e of p.exercises) {
        const on = keep[i].keep.includes(e.poolExerciseId);
        lifts += 1;
        if (on) kept += 1;
        out.push({ label: e.poolExercise.name, detail: on ? (lines.get(e.poolExerciseId) ?? null) : null, dropped: !on });
        const s = on ? null : swaps.find((x) => x.from === e.poolExerciseId);
        if (s) {
          kept += 1;
          out.push({ label: s.name, detail: [lines.get(s.to), `in place of ${e.poolExercise.name}`].filter(Boolean).join(" \u00b7 "), dropped: false, standIn: true });
        }
      }
      return;
    }
    const label = p.hiitWorkout?.name ?? p.name;
    out.push({ label, detail: null, dropped: !keep[i].stays });
  });
  const title =
    a.mode === "low"
      ? "Same workout, lighter"
      : a.mode === "sick"
        ? a.how === "easy"
          ? "Easy day"
          : "Lighter version"
        : adjustLabel(a);
  const note =
    a.mode === "low"
      ? "About 65% of the usual weights"
      : a.mode === "sick"
        ? a.how === "easy"
          ? "Warm-up and easy cardio, no lifting"
          : "About 50%, main lifts only"
        : "Normal weights";
  return {
    title,
    tag: a.mode === "hurt" ? "" : "LIGHT",
    note,
    lines: out,
    empty: a.mode === "hurt" && lifts > 0 && kept === 0,
    canReplace: offered.length > 0,
  };
}

/** Make today adjusted. Short on time is worked out here from the picks. */
export async function applyAdjust(userId: string, dateISO: string, raw: unknown): Promise<boolean> {
  const a = cleanAdjust(raw);
  if (!a) return false;
  if (a.mode === "time") {
    const plan = await shortPlanFor(userId, dateISO, a);
    if (!plan.fits) return false;
    await setAdjust(userId, dateISO, { ...a, picks: a.picks.filter((p) => plan.available[p]), keep: plan.keep, supp: plan.supp, total: plan.total });
    return true;
  }
  if (a.mode === "hurt") {
    const swaps = a.replace !== false ? await standInsFor(userId, dateISO, a, await dayPlan(userId, dateISO)) : [];
    await setAdjust(userId, dateISO, { mode: "hurt", area: a.area, replace: a.replace !== false, ...(swaps.length ? { swaps } : {}) });
    return true;
  }
  await setAdjust(userId, dateISO, a);
  return true;
}
