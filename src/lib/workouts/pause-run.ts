import "server-only";
import { prisma } from "@/lib/prisma";
import { addDays, fromDateColumn, toDateColumn } from "@/lib/dates";
import { PAUSE_WORD, isPauseReason, type PauseReason } from "@/lib/workouts/pause";
export { PAUSE_REASONS, PAUSE_WORD, isPauseReason, pausedDays, type PauseReason } from "@/lib/workouts/pause";

/**
 * Workout pauses (v0.678): a household pause (Admin → Pauses, a vacation)
 * pauses everyone; a person's own pause (sick, injured, other) pauses just
 * them. Paused days get no workout prompt, count as neither done nor missed,
 * don't count against "Is the plan too big?", show as rest on the strip, and
 * don't cool the heat map. Logging still works on a paused day.
 */
export type WorkoutPauseInfo = {
  /** "household" from Admin, else the person's own. */
  kind: "household" | "personal";
  id: string;
  /** "Sick", "Injured", "Paused", or the household pause's name. */
  label: string;
  reason: PauseReason | null;
  from: string;
  to: string;
};


/** Every pause touching a person from a day on (household and their own). */
export async function workoutPausesFor(userId: string, fromISO = "1970-01-01"): Promise<WorkoutPauseInfo[]> {
  const from = toDateColumn(fromISO);
  const [house, own] = (await Promise.all([
    prisma.pause.findMany({ where: { endDate: { gte: from } }, select: { id: true, name: true, startDate: true, endDate: true } }),
    prisma.workoutPause.findMany({
      where: { userId, endDate: { gte: from } },
      select: { id: true, reason: true, startDate: true, endDate: true },
    }),
  ])) as [
    { id: string; name: string; startDate: Date; endDate: Date }[],
    { id: string; reason: string; startDate: Date; endDate: Date }[],
  ];
  return [
    ...house.map((p) => ({ kind: "household" as const, id: p.id, label: p.name, reason: null, from: fromDateColumn(p.startDate), to: fromDateColumn(p.endDate) })),
    ...own.map((p) => {
      const reason = isPauseReason(p.reason) ? p.reason : "OTHER";
      return { kind: "personal" as const, id: p.id, label: PAUSE_WORD[reason], reason, from: fromDateColumn(p.startDate), to: fromDateColumn(p.endDate) };
    }),
  ].sort((a, b) => (a.from < b.from ? -1 : 1));
}

/** The pause a person's day falls in (their own first), or null. */
export async function pauseOn(userId: string, iso: string): Promise<WorkoutPauseInfo | null> {
  const list = (await workoutPausesFor(userId, iso)).filter((p) => p.from <= iso && p.to >= iso);
  return list.find((p) => p.kind === "personal") ?? list[0] ?? null;
}

const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const dayText = (iso: string) => `${DOW[new Date(`${iso}T12:00:00Z`).getUTCDay()]}, ${MONTH[Number(iso.slice(5, 7)) - 1]} ${Number(iso.slice(8, 10))}`;

/** "Workouts paused · Sick through Fri, Nov 14". */
export const pauseText = (p: WorkoutPauseInfo) => `Workouts paused · ${p.label} through ${dayText(p.to)}`;

/** Start a person's pause today through `untilISO`; their own pause already
 *  running or ahead is replaced. */
export async function startWorkoutPause(userId: string, reason: PauseReason, todayISO: string, untilISO: string): Promise<void> {
  const to = untilISO < todayISO ? todayISO : untilISO;
  await prisma.workoutPause.deleteMany({ where: { userId, startDate: { gte: toDateColumn(todayISO) } } });
  await prisma.workoutPause.updateMany({
    where: { userId, startDate: { lt: toDateColumn(todayISO) }, endDate: { gte: toDateColumn(todayISO) } },
    data: { endDate: toDateColumn(addDays(todayISO, -1)) },
  });
  await prisma.workoutPause.create({ data: { userId, reason, startDate: toDateColumn(todayISO), endDate: toDateColumn(to) } });
}

/** End a person's pause now: today is a normal day again. */
export async function endWorkoutPause(userId: string, id: string, todayISO: string): Promise<void> {
  const p = (await prisma.workoutPause.findFirst({ where: { id, userId }, select: { startDate: true } })) as { startDate: Date } | null;
  if (!p) return;
  if (fromDateColumn(p.startDate) >= todayISO) await prisma.workoutPause.delete({ where: { id } });
  else await prisma.workoutPause.update({ where: { id }, data: { endDate: toDateColumn(addDays(todayISO, -1)) } });
}
