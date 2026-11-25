import "server-only";
import { resnapshotAt } from "@/lib/places/visits";
import { prisma } from "@/lib/prisma";
import { nearestTime } from "@/lib/places/day-edits";
import { trackedIds } from "@/lib/places/tracks";
import type { DayPoint } from "@/lib/places/day";

/**
 * Corrections to a day (v0.769). Parents only — a child can't hide a stop
 * from their own (or anyone's) history; everyone still sees the result.
 */

export async function canEditHistory(userId: string | null): Promise<boolean> {
  if (!userId) return false;
  const u = (await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, kind: true, isActive: true },
  })) as { role: string; kind: string; isActive: boolean } | null;
  return Boolean(u?.isActive && (u.role === "ADMIN" || u.kind === "PARENT"));
}

const when = (iso: string): Date | null => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
};

/** "We didn't stop there": hide the recorded stop that starts at `startISO`. */
export async function removeStop(personId: string, startISO: string, byId: string | null): Promise<{ error: string | null }> {
  const at = when(startISO);
  if (!at || (await trackedIds([personId])).length === 0) return { error: "That stop isn't there." };
  await prisma.placesStopEdit.create({ data: { userId: personId, kind: "remove", at, createdById: byId } });
  await resnapshotAt(personId, at);
  return { error: null };
}

/** Undo a correction: put a removed stop back, or take an added one away. */
export async function undoStopEdit(editId: string): Promise<{ error: string | null }> {
  const e = (await prisma.placesStopEdit.findUnique({ where: { id: editId }, select: { userId: true, at: true } })) as {
    userId: string;
    at: Date;
  } | null;
  await prisma.placesStopEdit.deleteMany({ where: { id: editId } });
  if (e) await resnapshotAt(e.userId, e.at);
  return { error: null };
}

/** "We stopped here": a stop on the trip between `fromISO` and `toISOs`, at
 *  the time the trip passed nearest the tapped spot. */
export async function addStop(input: {
  personId: string;
  fromISO: string;
  toISO: string;
  lat: number;
  lng: number;
  name: string | null;
  address: string | null;
  byId: string | null;
}): Promise<{ error: string | null }> {
  const from = when(input.fromISO);
  const to = when(input.toISO);
  const ok = (v: number, max: number) => Number.isFinite(v) && Math.abs(v) <= max;
  if (!from || !to || to < from || !ok(input.lat, 90) || !ok(input.lng, 180)) return { error: "Pick a spot on the map." };
  if ((await trackedIds([input.personId])).length === 0) return { error: "That person isn't tracked." };
  const points = (await prisma.locationPoint.findMany({
    where: { userId: input.personId, at: { gte: from, lte: to } },
    orderBy: { at: "asc" },
    take: 2_000,
    select: { at: true, lat: true, lng: true, accuracyM: true, speed: true },
  })) as DayPoint[];
  const at = nearestTime(points, input) ?? new Date((from.getTime() + to.getTime()) / 2);
  await prisma.placesStopEdit.create({
    data: {
      userId: input.personId,
      kind: "add",
      at,
      lat: input.lat,
      lng: input.lng,
      name: input.name?.trim().slice(0, 80) || null,
      address: input.address?.trim().slice(0, 200) || null,
      createdById: input.byId,
    },
  });
  await resnapshotAt(input.personId, at);
  return { error: null };
}
