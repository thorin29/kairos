import type { NextRequest } from "next/server";
import { apiOk } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { prisma } from "@/lib/prisma";
import { householdTz, todayISO, addDays, toDateColumn, fromDateColumn } from "@/lib/dates";
import { occurrencesIn } from "@/lib/calendar/recur";
import { TaskStatus } from "@/generated/prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WINDOW_DAYS = 30;

/**
 * Events in the next ~30 days that carry reminders, for the person this device
 * is enrolled to (their own events, events they're on, and family events).
 * Recurring events are expanded to their occurrences in the window. Times are
 * absolute epoch millis; the app schedules each reminder = start - minutes.
 * Only events with reminders are returned, so the payload stays small.
 */
export async function GET(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  const uid = authed.device.person.id;

  const now = Date.now();
  const windowEnd = new Date(now + WINDOW_DAYS * 86_400_000);
  const tz = householdTz();
  const fromISO = todayISO();
  const toISO = addDays(fromISO, WINDOW_DAYS);

  // Scope: owned, family, or a participant. Only events that actually have
  // reminders. Subscribed (external) events are included too — a reminder set
  // on one is honoured like any other.
  const scope = {
    cancelled: false,
    NOT: { reminders: { isEmpty: true } },
    OR: [
      { userId: uid },
      { isFamily: true },
      { participants: { some: { userId: uid } } },
    ],
  };

  const [singles, series] = await Promise.all([
    prisma.event.findMany({
      where: {
        ...scope,
        rrule: null,
        startsAt: { gte: new Date(now), lte: windowEnd },
      },
      select: { id: true, title: true, location: true, locationOverride: true, startsAt: true, reminders: true, reminderUserIds: true },
    }),
    prisma.event.findMany({
      where: { ...scope, rrule: { not: null }, startsAt: { lte: windowEnd } },
      select: { id: true, title: true, location: true, locationOverride: true, startsAt: true, rrule: true, reminders: true, reminderUserIds: true },
    }),
  ]);

  type Row = { id: string; title: string; location: string | null; locationOverride: string | null; startsAt: Date; reminders: number[]; reminderUserIds: string[] };

  const out: { id: string; title: string; location: string | null; startMs: number; reminders: number[] }[] = [];

  for (const e of singles as Row[]) {
    if (!e.reminderUserIds.includes(uid)) continue; // only this person's reminders
    out.push({ id: e.id, title: e.title, location: e.locationOverride ?? e.location, startMs: e.startsAt.getTime(), reminders: e.reminders });
  }

  // Dates cancelled by a single-occurrence override, so the series skips them.
  const seriesIds = series.map((s) => s.id);
  const cancelledDates = new Set<string>();
  if (seriesIds.length > 0) {
    const overrides = await prisma.event.findMany({
      where: { recurrenceId: { in: seriesIds }, cancelled: true },
      select: { recurrenceId: true, recurrenceDate: true },
    });
    for (const o of overrides) {
      if (o.recurrenceId && o.recurrenceDate) {
        cancelledDates.add(`${o.recurrenceId}|${o.recurrenceDate.toISOString().slice(0, 10)}`);
      }
    }
  }

  for (const s of series as (Row & { rrule: string | null })[]) {
    if (!s.rrule) continue;
    if (!s.reminderUserIds.includes(uid)) continue; // only this person's reminders
    const occs = occurrencesIn(s.startsAt, s.rrule, fromISO, toISO, tz);
    for (const occ of occs) {
      const ms = occ.getTime();
      if (ms < now || ms > windowEnd.getTime()) continue;
      const dayKey = occ.toISOString().slice(0, 10);
      if (cancelledDates.has(`${s.id}|${dayKey}`)) continue;
      out.push({ id: `${s.id}:${ms}`, title: s.title, location: s.locationOverride ?? s.location, startMs: ms, reminders: s.reminders });
    }
  }

  // Tasks this person has an alert time on, due within the window. The app
  // schedules each at (dueISO at `minute`) in device-local time.
  const taskRows = await prisma.task.findMany({
    where: {
      userId: uid,
      status: TaskStatus.PENDING,
      notifyMinutes: { not: null },
      dueDate: { gte: toDateColumn(fromISO), lte: toDateColumn(toISO) },
    },
    select: { id: true, title: true, dueDate: true, notifyMinutes: true },
  });
  const tasks = taskRows.map((t) => ({
    id: t.id,
    title: t.title,
    dueISO: fromDateColumn(t.dueDate),
    minute: t.notifyMinutes ?? 0,
  }));

  return apiOk({ events: out, tasks });
}
