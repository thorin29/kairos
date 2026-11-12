import "server-only";
import { prisma } from "@/lib/prisma";
import { addDays, fromDateColumn, toDateColumn } from "@/lib/dates";
import { WORKOUT_TYPE_LABEL, formatHiitMovement, hiitResult, type WorkoutType } from "@/lib/workouts/catalog";
import { resultText } from "@/lib/workouts/wod-run";
import { HIIT_FOR_PLAN, conditioningPlansOf, type ConditioningPlan, type HiitForPlan } from "@/lib/workouts/conditioning-run";
import {
  familyPlanId,
  mergeMembers,
  okWodDate,
  rankBoard,
  waitingText,
  whoText,
  type BoardInput,
  type BoardRow,
  type FamilyWodHow,
} from "@/lib/workouts/family-wod";
export { FAMILY_WOD_DAYS_AHEAD, isFamilyPlanId, type BoardRow, type FamilyWodHow } from "@/lib/workouts/family-wod";

/** A family WOD (v0.679): the workout, who's in, and the board so far. */
export type FamilyWodView = {
  id: string;
  date: string;
  hiitWorkoutId: string;
  name: string;
  type: WorkoutType;
  /** "AMRAP 20 min", "For time". */
  typeLabel: string;
  movements: string[];
  members: { userId: string; name: string; how: FamilyWodHow }[];
  /** "Alex, Sam and Jordan", or "Everyone". */
  who: string;
  /** How the viewer is in it, or null. */
  mine: FamilyWodHow | null;
  board: BoardRow[];
  /** "Sam hasn't logged yet", or null. */
  waiting: string | null;
  /** Members with a result. */
  logged: number;
};

/** On the day: the card (members only, unless their plan already has it). */
export type FamilyWodDay = FamilyWodView & {
  plan: ConditioningPlan | null;
  /** The person's own plan has this workout today; its card is the one. */
  inPlan: boolean;
};

export type FamilyWodSuggestionView = {
  id: string;
  date: string;
  hiitWorkoutId: string;
  name: string;
  byId: string;
  by: string;
  note: string | null;
};

export type FamilyWodOverview = {
  /** Today's, else the next one ahead. */
  next: FamilyWodView | null;
  /** Every one from today on. */
  ahead: FamilyWodView[];
  /** The latest before today, newest first. */
  past: FamilyWodView[];
  /** Waiting: all of them for a parent, the viewer's own otherwise. */
  suggestions: FamilyWodSuggestionView[];
  /** Everyone who can be put in one. */
  people: { userId: string; name: string }[];
};

export type FamilyWodChoice = { hiitWorkoutId: string; name: string; typeLabel: string; minutes: number | null; kind: string | null };

const personName = (u: { name: string; displayName: string | null } | null | undefined) => u?.displayName?.trim() || u?.name || "";

function typeLabel(type: WorkoutType, capSec: number | null): string {
  const base = WORKOUT_TYPE_LABEL[type];
  return capSec && (type === "AMRAP" || type === "EMOM") ? `${base} ${Math.round(capSec / 60)} min` : base;
}

type WodRow = {
  id: string;
  date: Date;
  hiitWorkout: HiitForPlan;
  members: { userId: string; how: string; user: { name: string; displayName: string | null } }[];
};

const WOD_SELECT = {
  id: true,
  date: true,
  hiitWorkout: { select: HIIT_FOR_PLAN },
  members: {
    orderBy: { createdAt: "asc" as const },
    select: { userId: true, how: true, user: { select: { name: true, displayName: true } } },
  },
};

async function people(): Promise<{ userId: string; name: string }[]> {
  const rows = (await prisma.user.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true, displayName: true },
  })) as { id: string; name: string; displayName: string | null }[];
  return rows.map((u) => ({ userId: u.id, name: personName(u) }));
}

/** Rows read into views, boards worked out from the HIIT sessions logged. */
async function views(rows: WodRow[], viewerId: string | null): Promise<FamilyWodView[]> {
  if (rows.length === 0) return [];
  const all = await people();
  const order = new Map(all.map((p, i) => [p.userId, i]));
  const names = [...new Set(rows.flatMap((r) => [r.hiitWorkout.name.slice(0, 60), r.hiitWorkout.name.slice(0, 40)]))];
  const last = rows.reduce((m, r) => (r.date > m ? r.date : m), rows[0].date);
  const sessions = (await prisma.workoutSession.findMany({
    where: { category: "HIIT" as never, isRest: false, name: { in: names }, date: { lte: last } },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: 3000,
    select: {
      userId: true,
      date: true,
      name: true,
      version: true,
      user: { select: { name: true, displayName: true } },
      sets: { orderBy: { setNumber: "asc" }, take: 1, select: { reps: true, seconds: true } },
    },
  })) as {
    userId: string;
    date: Date;
    name: string | null;
    version: string | null;
    user: { name: string; displayName: string | null } | null;
    sets: { reps: number | null; seconds: number | null }[];
  }[];

  return rows.map((r) => {
    const w = r.hiitWorkout;
    const iso = fromDateColumn(r.date);
    const res = hiitResult(w.type);
    const metric = res.metric === "DURATION" ? "DURATION" : "REPS";
    const key = w.name.slice(0, 40);
    const mine = sessions.filter((s) => (s.name ?? "").slice(0, 40) === key);
    const val = (s: (typeof mine)[number]) => (metric === "DURATION" ? s.sets[0]?.seconds ?? null : s.sets[0]?.reps ?? null);
    const onDay = mine.filter((s) => fromDateColumn(s.date) === iso);
    const input: BoardInput[] = onDay.map((s) => ({
      userId: s.userId,
      name: personName(s.user),
      value: val(s),
      version: s.version,
      result: resultText(w.type, s.sets[0]?.reps ?? null, s.sets[0]?.seconds ?? null) ?? "—",
      earlier: mine
        .filter((e) => e.userId === s.userId && fromDateColumn(e.date) < iso && (e.version === "SCALED") === (s.version === "SCALED"))
        .map(val)
        .filter((v): v is number => v != null),
    }));
    const board = rankBoard(input, metric);
    const members = r.members
      .map((m) => ({ userId: m.userId, name: personName(m.user), how: (m.how === "JOINED" ? "JOINED" : "ASSIGNED") as FamilyWodHow }))
      .sort((a, b) => (order.get(a.userId) ?? 99) - (order.get(b.userId) ?? 99));
    const done = new Set(board.map((b) => b.userId));
    return {
      id: r.id,
      date: iso,
      hiitWorkoutId: w.id,
      name: w.name,
      type: w.type,
      typeLabel: typeLabel(w.type, w.capSec),
      movements: w.movements
        .filter((m) => m.poolExercise)
        .map((m) => formatHiitMovement({ name: m.poolExercise!.name, reps: m.reps, distance: m.distance, weight: m.weight })),
      members,
      who: whoText(members.map((m) => m.name), all.length),
      mine: viewerId ? members.find((m) => m.userId === viewerId)?.how ?? null : null,
      board,
      waiting: waitingText(members.filter((m) => !done.has(m.userId)).map((m) => m.name)),
      logged: members.filter((m) => done.has(m.userId)).length,
    };
  });
}

async function rowsWhere(where: Record<string, unknown>, take?: number, desc = false): Promise<WodRow[]> {
  return (await prisma.familyWod.findMany({
    where,
    orderBy: { date: desc ? "desc" : "asc" },
    ...(take ? { take } : {}),
    select: WOD_SELECT,
  })) as unknown as WodRow[];
}

/** The family WOD on a day, as the viewer sees it, or null. */
export async function familyWodOn(dateISO: string, viewerId: string | null): Promise<FamilyWodView | null> {
  const [v] = await views(await rowsWhere({ date: toDateColumn(dateISO) }), viewerId);
  return v ?? null;
}

/** One by id, for its board. */
export async function familyWodById(id: string, viewerId: string | null): Promise<FamilyWodView | null> {
  const [v] = await views(await rowsWhere({ id }), viewerId);
  return v ?? null;
}

/**
 * A person's day: the family WOD with its card when they're in it. When their
 * own plan has the same workout that day, the plan's card is the one.
 */
export async function familyWodDay(
  userId: string,
  dateISO: string,
  planned: readonly { hiitWorkoutId: string }[],
): Promise<FamilyWodDay | null> {
  const rows = await rowsWhere({ date: toDateColumn(dateISO) });
  const [v] = await views(rows, userId);
  if (!v) return null;
  const inPlan = planned.some((p) => p.hiitWorkoutId === v.hiitWorkoutId);
  const plan =
    v.mine && !inPlan ? (await conditioningPlansOf(userId, dateISO, [{ id: familyPlanId(v.id), hiitWorkout: rows[0].hiitWorkout }]))[0] ?? null : null;
  return { ...v, plan, inPlan };
}

/** The Workouts page's Family WOD: what's ahead, the latest boards, suggestions. */
export async function familyWodOverview(viewerId: string | null, todayISO: string, parent: boolean): Promise<FamilyWodOverview> {
  const today = toDateColumn(todayISO);
  const [aheadRows, pastRows, sugg, all] = await Promise.all([
    rowsWhere({ date: { gte: today } }, 30),
    rowsWhere({ date: { lt: today } }, 12, true),
    prisma.familyWodSuggestion.findMany({
      where: { status: "PENDING", date: { gte: today }, ...(parent ? {} : { userId: viewerId ?? "-" }) },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
      take: 30,
      select: {
        id: true,
        date: true,
        hiitWorkoutId: true,
        note: true,
        userId: true,
        hiitWorkout: { select: { name: true } },
        user: { select: { name: true, displayName: true } },
      },
    }) as Promise<
      {
        id: string;
        date: Date;
        hiitWorkoutId: string;
        note: string | null;
        userId: string;
        hiitWorkout: { name: string };
        user: { name: string; displayName: string | null };
      }[]
    >,
    people(),
  ]);
  const [ahead, past] = await Promise.all([views(aheadRows, viewerId), views(pastRows, viewerId)]);
  return {
    next: ahead[0] ?? null,
    ahead,
    past,
    suggestions: sugg.map((s) => ({
      id: s.id,
      date: fromDateColumn(s.date),
      hiitWorkoutId: s.hiitWorkoutId,
      name: s.hiitWorkout.name,
      byId: s.userId,
      by: personName(s.user),
      note: s.note,
    })),
    people: all,
  };
}

/** The shared workouts a family WOD can be. */
export async function familyWodChoices(): Promise<FamilyWodChoice[]> {
  const rows = (await prisma.hiitWorkout.findMany({
    where: { approved: true, ownerId: null },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, type: true, capSec: true, minutes: true, kind: true, heroWod: true },
  })) as { id: string; name: string; type: WorkoutType; capSec: number | null; minutes: number | null; kind: string | null; heroWod: boolean }[];
  return rows.map((w) => ({
    hiitWorkoutId: w.id,
    name: w.name,
    typeLabel: typeLabel(w.type, w.capSec),
    minutes: w.minutes,
    kind: w.kind ?? (w.heroWod ? "HERO" : null),
  }));
}

export type FamilyWodResult = { ok: true; id: string } | { ok: false; error: string };

/**
 * A parent sets a day's family WOD: the workout and the people in it. The
 * day's earlier one is replaced; anyone who joined it stays in. From a
 * suggestion, that suggestion is approved.
 */
export async function setFamilyWod(input: {
  dateISO: string;
  hiitWorkoutId: string;
  userIds: string[];
  todayISO: string;
  byId: string | null;
  suggestionId?: string | null;
}): Promise<FamilyWodResult> {
  if (!okWodDate(input.dateISO, input.todayISO, addDays)) return { ok: false, error: "Pick a day from today on." };
  const w = await prisma.hiitWorkout.findFirst({ where: { id: input.hiitWorkoutId }, select: { id: true } });
  if (!w) return { ok: false, error: "Pick a workout." };
  const active = new Set((await people()).map((p) => p.userId));
  const picked = [...new Set(input.userIds)].filter((id) => active.has(id));
  if (picked.length === 0) return { ok: false, error: "Pick who's in." };
  const date = toDateColumn(input.dateISO);
  const existing = (await prisma.familyWod.findUnique({
    where: { date },
    select: { id: true, members: { select: { userId: true, how: true } } },
  })) as { id: string; members: { userId: string; how: string }[] } | null;
  const members = mergeMembers(
    (existing?.members ?? []).map((m) => ({ userId: m.userId, how: m.how === "JOINED" ? "JOINED" : "ASSIGNED" })),
    picked,
  );
  const id = await prisma.$transaction(async (tx) => {
    const row = existing
      ? await tx.familyWod.update({ where: { id: existing.id }, data: { hiitWorkoutId: w.id }, select: { id: true } })
      : await tx.familyWod.create({ data: { date, hiitWorkoutId: w.id, createdById: input.byId }, select: { id: true } });
    await tx.familyWodMember.deleteMany({ where: { familyWodId: row.id } });
    await tx.familyWodMember.createMany({ data: members.map((m) => ({ familyWodId: row.id, userId: m.userId, how: m.how })) });
    if (input.suggestionId) {
      await tx.familyWodSuggestion.updateMany({
        where: { id: input.suggestionId, status: "PENDING" },
        data: { status: "APPROVED", decidedById: input.byId },
      });
    }
    return row.id;
  });
  return { ok: true, id };
}

/** A parent takes a family WOD off its day. Results logged stay. */
export async function deleteFamilyWod(id: string): Promise<void> {
  await prisma.familyWod.deleteMany({ where: { id } });
}

/** Join a family WOD, or leave one you joined (someone put in stays in). */
export async function joinFamilyWod(id: string, userId: string, join: boolean): Promise<void> {
  if (join) {
    const found = await prisma.familyWod.findFirst({ where: { id }, select: { id: true } });
    if (!found) return;
    await prisma.familyWodMember.upsert({
      where: { familyWodId_userId: { familyWodId: id, userId } },
      create: { familyWodId: id, userId, how: "JOINED" },
      update: {},
    });
  } else {
    await prisma.familyWodMember.deleteMany({ where: { familyWodId: id, userId, how: "JOINED" } });
  }
}

/** Anyone suggests a workout for a day; parents see it to approve. */
export async function suggestFamilyWod(input: {
  userId: string;
  dateISO: string;
  hiitWorkoutId: string;
  note: string | null;
  todayISO: string;
}): Promise<FamilyWodResult> {
  if (!okWodDate(input.dateISO, input.todayISO, addDays)) return { ok: false, error: "Pick a day from today on." };
  const w = await prisma.hiitWorkout.findFirst({
    where: { id: input.hiitWorkoutId, OR: [{ approved: true, ownerId: null }, { ownerId: input.userId }] },
    select: { id: true },
  });
  if (!w) return { ok: false, error: "Pick a workout." };
  const note = input.note?.trim().slice(0, 140) || null;
  const row = await prisma.familyWodSuggestion.create({
    data: { userId: input.userId, date: toDateColumn(input.dateISO), hiitWorkoutId: w.id, note },
    select: { id: true },
  });
  return { ok: true, id: row.id };
}

/** A parent declines a suggestion. */
export async function declineFamilyWodSuggestion(id: string, byId: string | null): Promise<void> {
  await prisma.familyWodSuggestion.updateMany({ where: { id, status: "PENDING" }, data: { status: "DECLINED", decidedById: byId } });
}

/** The person who suggested it takes it back while it waits. */
export async function withdrawFamilyWodSuggestion(id: string, userId: string): Promise<void> {
  await prisma.familyWodSuggestion.deleteMany({ where: { id, userId, status: "PENDING" } });
}
