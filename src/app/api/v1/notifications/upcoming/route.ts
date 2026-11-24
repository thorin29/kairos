import type { NextRequest } from "next/server";
import { apiOk } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { prisma } from "@/lib/prisma";
import { householdTz, todayISO, addDays, toDateColumn, fromDateColumn, localParts, eventTz } from "@/lib/dates";
import { occurrencesIn } from "@/lib/calendar/recur";
import { replacedOccurrences } from "@/lib/calendar/overrides";
import { TaskStatus } from "@/generated/prisma/client";
import { loadPrefs } from "@/lib/notify-prefs";

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
  // v0.774: an event's reminders go to everyone on it; each person may set
  // their own (or mute them) on any event, and those always count. The
  // event's own reminders pass only through the person's switches: their own
  // events, family events, others' events they're on. Until their phone has
  // saved choices, the phone's own switches decide, as before.
  const { prefs, saved } = await loadPrefs(uid);
  const wants = (e: { userId: string | null; isFamily: boolean }) =>
    !saved || (e.userId === uid ? prefs.calendar.mine : e.isFamily ? prefs.calendar.family : prefs.calendar.others);

  const now = Date.now();
  const windowEnd = new Date(now + WINDOW_DAYS * 86_400_000);
  const tz = householdTz();
  const fromISO = todayISO();
  const toISO = addDays(fromISO, WINDOW_DAYS);

  // Scope: events with reminders this person is on, and any event they set
  // their own reminders on (feed events included).
  const scope = {
    cancelled: false,
    OR: [
      {
        NOT: { reminders: { isEmpty: true } },
        OR: [{ userId: uid }, { isFamily: true }, { participants: { some: { userId: uid } } }],
      },
      { subscribedReminders: { some: { userId: uid } } },
    ],
  };

  const [singles, series] = await Promise.all([
    prisma.event.findMany({
      where: {
        ...scope,
        rrule: null,
        startsAt: { gte: new Date(now), lte: windowEnd },
      },
      select: { id: true, userId: true, isFamily: true, title: true, location: true, locationOverride: true, startsAt: true, reminders: true, participants: { select: { userId: true } }, subscribedReminders: { where: { userId: uid }, select: { minutes: true } } },
    }),
    prisma.event.findMany({
      where: { ...scope, rrule: { not: null }, startsAt: { lte: windowEnd } },
      select: { id: true, userId: true, isFamily: true, title: true, location: true, locationOverride: true, startsAt: true, endsAt: true, allDay: true, rrule: true, reminders: true, participants: { select: { userId: true } }, subscribedReminders: { where: { userId: uid }, select: { minutes: true } } },
    }),
  ]);

  type Row = {
    id: string;
    userId: string | null;
    isFamily: boolean;
    title: string;
    location: string | null;
    locationOverride: string | null;
    startsAt: Date;
    reminders: number[];
    participants: { userId: string }[];
    subscribedReminders: { minutes: number[] }[];
  };
  /** This person's minutes on an event: their own if set, else the event's
   *  when they're on it and their switches let it through. */
  const minutesFor = (e: Row): number[] => {
    const own = e.subscribedReminders[0];
    if (own) return own.minutes ?? [];
    const on = e.isFamily || e.userId === uid || e.participants.some((p) => p.userId === uid);
    return on && wants(e) ? e.reminders : [];
  };

  const out: { id: string; title: string; location: string | null; startMs: number; reminders: number[] }[] = [];

  for (const e of singles as Row[]) {
    const mins = minutesFor(e);
    if (mins.length === 0) continue;
    out.push({ id: e.id, title: e.title, location: e.locationOverride ?? e.location, startMs: e.startsAt.getTime(), reminders: mins });
  }

  // Occurrences a single-occurrence edit moved, changed or cancelled: the
  // series skips them and the edited copy reminds on its own (v0.785).
  const replaced = await replacedOccurrences(series);

  for (const s of series as (Row & { rrule: string | null; endsAt: Date; allDay: boolean })[]) {
    if (!s.rrule) continue;
    const mins = minutesFor(s);
    if (mins.length === 0) continue;
    const occs = occurrencesIn(s.startsAt, s.rrule, fromISO, toISO, tz);
    for (const occ of occs) {
      const ms = occ.getTime();
      if (ms < now || ms > windowEnd.getTime()) continue;
      if (replaced.get(s.id)?.has(localParts(occ, eventTz(s.allDay)).iso)) continue;
      out.push({ id: `${s.id}:${ms}`, title: s.title, location: s.locationOverride ?? s.location, startMs: ms, reminders: mins });
    }
  }

  // Tasks this person has an alert time on, due within the window. The app
  // schedules each at (dueISO at `minute`) in device-local time.
  const taskRows = saved && !prefs.tasks ? [] : await prisma.task.findMany({
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
