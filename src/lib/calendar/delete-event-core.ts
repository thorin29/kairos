import "server-only";
import { isOccasion } from "@/lib/calendar/occasions";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { addDays, eventParts, toDateColumn } from "@/lib/dates";
import { buildRule, occurrenceOfRow, parseRule } from "@/lib/calendar/recur";

/**
 * Guard-free core for deleting a calendar event, shared by the web `deleteEvent`
 * action and the app's `/api/v1/calendar/event/delete`. The web passes
 * `callerUserId: null` (any interactive user may delete, matching the shared
 * tablet); the app passes the token's person so a non-admin can only remove
 * their own or family events. Recurring events and birthdays stay admin-only,
 * and subscribed-feed events can't be deleted here (unsubscribe instead).
 */

export type DeleteScope = "all" | "future" | "one";

export async function deleteEventCore(
  id: string,
  scope: DeleteScope,
  sentOccurrenceISO: string | undefined,
  opts: { isAdmin: boolean; callerUserId: string | null },
): Promise<{ error: string | null }> {
  const event = await prisma.event.findUnique({ where: { id } });
  if (!event) return { error: null };
  // The occurrence meant, resolved through the series: deleting from the
  // after-midnight piece of an overnight occurrence names the day after it,
  // and used to tombstone a date the series never had (nothing disappeared).
  const occurrenceISO = sentOccurrenceISO
    ? occurrenceOfRow(event, sentOccurrenceISO)
    : sentOccurrenceISO;

  if (event.externalCalendarId) {
    return { error: "Unsubscribe from the feed to remove its events." };
  }

  // App callers may only touch their own (or family) events unless they're admin.
  if (
    opts.callerUserId &&
    !opts.isAdmin &&
    !event.isFamily &&
    event.userId !== opts.callerUserId
  ) {
    return { error: "You can only remove your own events." };
  }

  if (event.rrule || isOccasion(event.kind)) {
    if (!opts.isAdmin) {
      return { error: "Only a parent can delete a repeating event, a birthday or an anniversary." };
    }
  }

  const validOccurrence =
    !!occurrenceISO && /^\d{4}-\d{2}-\d{2}$/.test(occurrenceISO);
  // The series' first day as the calendar shows it (household day for timed
  // events; the UTC instant's date was a day late for late-evening starts).
  const parentStartISO = eventParts(event.startsAt, event.allDay).iso;

  const done = () => {
    revalidatePath("/calendar");
    revalidatePath("/");
    revalidatePath(`/person/${event.userId}`);
    return { error: null };
  };

  if (!event.rrule || scope === "all" || !validOccurrence) {
    if (event.rrule) {
      // Whole series: gather every split-off piece (from "this and future"
      // edits) that shares this logical series, plus their overrides, so none
      // are left behind on a stale date/time.
      const sid = event.seriesId ?? event.id;
      const pieces = await prisma.event.findMany({
        where: { OR: [{ id: sid }, { seriesId: sid }] },
        select: { id: true },
      });
      const ids = pieces.length ? pieces.map((p) => p.id) : [id];
      await prisma.event.deleteMany({ where: { recurrenceId: { in: ids } } });
      await prisma.event.deleteMany({ where: { id: { in: ids } } });
      return done();
    }
    await prisma.event.delete({ where: { id } });
    return done();
  }

  if (scope === "future") {
    const untilISO = addDays(occurrenceISO!, -1);
    if (untilISO < parentStartISO) {
      await prisma.event.deleteMany({ where: { recurrenceId: id } });
      await prisma.event.delete({ where: { id } });
      return done();
    }
    const r = parseRule(event.rrule);
    if (!r) {
      await prisma.event.deleteMany({ where: { recurrenceId: id } });
      await prisma.event.delete({ where: { id } });
      return done();
    }
    const newRule = buildRule(r.freq, r.interval, untilISO, null, r.byday);
    await prisma.event.deleteMany({
      where: {
        recurrenceId: id,
        recurrenceDate: { gte: toDateColumn(occurrenceISO!) },
      },
    });
    await prisma.event.update({ where: { id }, data: { rrule: newRule } });
    return done();
  }

  // scope === "one": tombstone just this date.
  const occDate = toDateColumn(occurrenceISO!);
  await prisma.event.deleteMany({
    where: { recurrenceId: id, recurrenceDate: occDate },
  });
  const at = new Date(`${occurrenceISO!}T00:00:00.000Z`);
  await prisma.event.create({
    data: {
      userId: event.userId,
      isFamily: event.isFamily,
      kind: event.kind,
      title: event.title,
      startsAt: at,
      endsAt: at,
      allDay: event.allDay,
      cancelled: true,
      recurrenceId: id,
      recurrenceDate: occDate,
    },
  });
  return done();
}
