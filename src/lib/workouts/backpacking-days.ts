/**
 * Which days a person is on a backpacking trip (v0.778), from calendar events
 * of the Backpacking type they're on: one event running from a start day to
 * an end day, or a repeating one, its days back to back. Pure, for the tests.
 */
import { addDays, eventTz, localParts } from "@/lib/dates";
import { occurrencesIn } from "@/lib/calendar/recur";
import { occurrenceSpanMs } from "@/lib/calendar/repeat-span";

export type TripEvent = {
  userId: string | null;
  participants: string[];
  startsAt: Date;
  endsAt: Date;
  allDay: boolean;
  rrule: string | null;
};

const DAY = 86_400_000;

/** The days one event covers from `fromISO` to `toISO` (an all-day end is exclusive). */
export function eventDays(e: TripEvent, fromISO: string, toISO: string): string[] {
  const tz = eventTz(e.allDay);
  const span = e.rrule ? occurrenceSpanMs(e.startsAt, e.endsAt, e.allDay, tz) : e.endsAt.getTime() - e.startsAt.getTime();
  const starts = e.rrule ? occurrencesIn(e.startsAt, e.rrule, addDays(fromISO, -31), toISO, tz) : [e.startsAt];
  const out = new Set<string>();
  for (const s of starts) {
    const first = localParts(s, tz).iso;
    // The last moment it covers: an all-day end is the start of the next day.
    const lastAt = new Date(s.getTime() + Math.max(span, 1) - (e.allDay ? 1 : 0));
    const last = localParts(lastAt, tz).iso;
    for (let d = first, n = 0; d <= last && n < 60; d = addDays(d, 1), n++) {
      if (d >= fromISO && d <= toISO) out.add(d);
    }
  }
  return [...out].sort();
}

/** Every trip day for a person (the event's owner or one of its people). */
export function tripDays(events: TripEvent[], userId: string, fromISO: string, toISO: string): string[] {
  const out = new Set<string>();
  for (const e of events) {
    if (e.userId !== userId && !e.participants.includes(userId)) continue;
    for (const d of eventDays(e, fromISO, toISO)) out.add(d);
  }
  return [...out].sort();
}

/** "Day 2 of 4": where a day sits in its run of back-to-back trip days. */
export function dayOfTrip(days: string[], iso: string): { day: number; of: number } | null {
  if (!days.includes(iso)) return null;
  let first = iso;
  while (days.includes(addDays(first, -1))) first = addDays(first, -1);
  let last = iso;
  while (days.includes(addDays(last, 1))) last = addDays(last, 1);
  return { day: Math.round((Date.parse(iso) - Date.parse(first)) / DAY) + 1, of: Math.round((Date.parse(last) - Date.parse(first)) / DAY) + 1 };
}
