import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * Calendar reminders (v0.774): an event's reminders are a suggestion that
 * goes to everyone on it — its owner, the people it's shared with, and
 * everyone for a family event. Each person can change or mute their own
 * (a `SubscribedReminder` row: their minutes, empty = muted), on any event.
 * Feed (subscribed) events carry no suggestion, so only personal rows count.
 */

export type EventForReminders = {
  id: string;
  userId: string | null;
  isFamily: boolean;
  reminders: number[];
  participantIds: string[];
};

/** Whether this person is on the event (gets its suggested reminders). */
export function isOnEvent(e: EventForReminders, uid: string): boolean {
  return e.isFamily || e.userId === uid || e.participantIds.includes(uid);
}

/** This person's reminders on each event: their own if set, else the
 *  event's suggestion when they're on it. `mine` = they set their own. */
export async function remindersFor(
  uid: string,
  events: EventForReminders[],
): Promise<Map<string, { minutes: number[]; mine: boolean }>> {
  const ids = events.map((e) => e.id);
  const rows = ids.length
    ? ((await prisma.subscribedReminder.findMany({
        where: { userId: uid, eventId: { in: ids } },
        select: { eventId: true, minutes: true },
      })) as { eventId: string; minutes: number[] }[])
    : [];
  const own = new Map(rows.map((r) => [r.eventId, r.minutes ?? []]));
  const out = new Map<string, { minutes: number[]; mine: boolean }>();
  for (const e of events) {
    const m = own.get(e.id);
    if (m) out.set(e.id, { minutes: [...m].sort((a, b) => a - b), mine: true });
    else out.set(e.id, { minutes: isOnEvent(e, uid) ? [...e.reminders].sort((a, b) => a - b) : [], mine: false });
  }
  return out;
}

/** Load what `remindersFor` needs for these event ids. */
export async function eventsForReminders(ids: string[]): Promise<EventForReminders[]> {
  if (ids.length === 0) return [];
  const rows = (await prisma.event.findMany({
    where: { id: { in: [...new Set(ids)] } },
    select: { id: true, userId: true, isFamily: true, reminders: true, participants: { select: { userId: true } } },
  })) as { id: string; userId: string | null; isFamily: boolean; reminders: number[]; participants: { userId: string }[] }[];
  return rows.map((r) => ({ ...r, participantIds: r.participants.map((p) => p.userId) }));
}

/** Set my reminders on an event: minutes (empty = mute), or null to go back
 *  to the event's own. */
export async function setMyReminders(uid: string, eventId: string, minutes: number[] | null): Promise<void> {
  const ev = (await prisma.event.findUnique({ where: { id: eventId }, select: { externalCalendarId: true } })) as {
    externalCalendarId: string | null;
  } | null;
  if (!ev) return;
  const mins = minutes == null ? null : [...new Set(minutes.filter((m) => Number.isFinite(m) && m >= 0 && m <= 40_320))].sort((a, b) => a - b);
  // On a feed event there is no suggestion: "none" and "the event's" are the same.
  if (mins == null || (ev.externalCalendarId && mins.length === 0)) {
    await prisma.subscribedReminder.deleteMany({ where: { eventId, userId: uid } });
    return;
  }
  await prisma.subscribedReminder.upsert({
    where: { eventId_userId: { eventId, userId: uid } },
    create: { eventId, userId: uid, minutes: mins },
    update: { minutes: mins },
  });
}
