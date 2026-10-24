import "server-only";
import { prisma } from "@/lib/prisma";
import { eventParts, eventTz, fromDateColumn, toDateColumn } from "@/lib/dates";
import { occurrenceOfRow } from "@/lib/calendar/recur";
import { occurrenceSpanMs } from "@/lib/calendar/repeat-span";

/**
 * Self-repair for calendar rows saved by older code, so nobody has to find and
 * delete them by hand. Runs once per server process, before the calendar's
 * first read (`loadRange`); idempotent, and a no-op once the rows are clean.
 *
 * 1. A repeating event whose stored span is longer than one occurrence may be
 *    (saved before v0.590's rule) is cut back to it — `occurrenceSpanMs`: one
 *    day for all-day, start → the end's clock time for timed. These drew every
 *    occurrence across several days, reading as a row of duplicates.
 *
 * 2. A single-occurrence edit (or deletion) saved against the day AFTER its
 *    occurrence — opened from the after-midnight piece of an overnight
 *    occurrence — is moved to the occurrence it meant (`occurrenceDayFor`), so
 *    the original stops showing beside it. An edited copy that landed on that
 *    later day moves back with it. Left alone if the right day already has an
 *    edit of its own (nothing is overwritten or deleted).
 */
let ran: Promise<void> | null = null;

export function repairEventRows(): Promise<void> {
  ran ??= run().catch((e) => {
    // Never block the calendar on a repair; try again on the next process.
    console.error("[calendar] event repair failed", e);
  });
  return ran;
}

type SeriesRow = {
  id: string;
  startsAt: Date;
  endsAt: Date;
  allDay: boolean;
  rrule: string | null;
};
type OverrideRow = {
  id: string;
  recurrenceId: string | null;
  recurrenceDate: Date | null;
  startsAt: Date;
  endsAt: Date;
  allDay: boolean;
  cancelled: boolean;
};

async function run(): Promise<void> {
  const DAY = 86_400_000;
  const series = (await prisma.event.findMany({
    where: { rrule: { not: null }, externalCalendarId: null },
    select: { id: true, startsAt: true, endsAt: true, allDay: true, rrule: true },
  })) as SeriesRow[];

  const byId = new Map<string, SeriesRow>();
  for (const s of series) {
    const span = s.endsAt.getTime() - s.startsAt.getTime();
    const want = occurrenceSpanMs(s.startsAt, s.endsAt, s.allDay, eventTz(s.allDay));
    if (span > DAY || span <= 0) {
      const endsAt = new Date(s.startsAt.getTime() + want);
      await prisma.event.update({ where: { id: s.id }, data: { endsAt } });
      s.endsAt = endsAt;
    }
    byId.set(s.id, s);
  }

  const overrides = (await prisma.event.findMany({
    where: { recurrenceId: { not: null }, recurrenceDate: { not: null } },
    select: {
      id: true,
      recurrenceId: true,
      recurrenceDate: true,
      startsAt: true,
      endsAt: true,
      allDay: true,
      cancelled: true,
    },
  })) as OverrideRow[];

  const taken = new Set(
    overrides.map((o) => `${o.recurrenceId}|${fromDateColumn(o.recurrenceDate!)}`),
  );
  for (const o of overrides) {
    const parent = byId.get(o.recurrenceId!);
    if (!parent?.rrule) continue;
    const raw = fromDateColumn(o.recurrenceDate!);
    const meant = occurrenceOfRow(parent, raw);
    if (meant === raw) continue;
    if (taken.has(`${o.recurrenceId}|${meant}`)) continue;
    // An edited copy saved with the clicked (later) day as its own date moves
    // back by the same number of days; a deliberate move elsewhere stays put.
    const shiftDays = eventParts(o.startsAt, o.allDay).iso === raw && !o.cancelled
      ? Math.round((toDateColumn(meant).getTime() - toDateColumn(raw).getTime()) / DAY)
      : 0;
    await prisma.event.update({
      where: { id: o.id },
      data: {
        recurrenceDate: toDateColumn(meant),
        ...(shiftDays !== 0
          ? {
              startsAt: new Date(o.startsAt.getTime() + shiftDays * DAY),
              endsAt: new Date(o.endsAt.getTime() + shiftDays * DAY),
            }
          : {}),
      },
    });
    taken.delete(`${o.recurrenceId}|${raw}`);
    taken.add(`${o.recurrenceId}|${meant}`);
  }
}
