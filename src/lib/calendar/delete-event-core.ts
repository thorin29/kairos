import "server-only";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { addDays, toDateColumn } from "@/lib/dates";
import { buildRule, parseRule } from "@/lib/calendar/recur";

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
  occurrenceISO: string | undefined,
  opts: { isAdmin: boolean; callerUserId: string | null },
): Promise<{ error: string | null }> {
  const event = await prisma.event.findUnique({ where: { id } });
  if (!event) return { error: null };

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

  if (event.rrule || event.kind === "BIRTHDAY") {
    if (!opts.isAdmin) {
      return { error: "Only a parent can delete a repeating event or a birthday." };
    }
  }

  const validOccurrence =
    !!occurrenceISO && /^\d{4}-\d{2}-\d{2}$/.test(occurrenceISO);
  const parentStartISO = event.startsAt.toISOString().slice(0, 10);

  const done = () => {
    revalidatePath("/calendar");
    revalidatePath("/");
    revalidatePath(`/person/${event.userId}`);
    return { error: null };
  };

  if (!event.rrule || scope === "all" || !validOccurrence) {
    if (event.rrule) {
      await prisma.event.deleteMany({ where: { recurrenceId: id } });
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
