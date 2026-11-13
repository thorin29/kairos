import "server-only";
// Shared by the web action (actions/calendars.ts, which resolves and checks the
// person) and the app's device-auth API route. Kept out of the "use server"
// module (v0.699): it trusts the userId it's given.
import { prisma } from "@/lib/prisma";

/** Set the current user's own reminder minutes on a subscribed feed event.
 *  Stored per-person (SubscribedReminder), so each person keeps their own
 *  minutes. Empty clears them. Feed events only. */
export async function setSubscribedRemindersCore(
  userId: string,
  eventId: string,
  reminders: number[],
): Promise<void> {
  const ev = await prisma.event.findUnique({
    where: { id: eventId },
    select: { externalCalendarId: true },
  });
  if (!ev || !ev.externalCalendarId) return;
  const mins = [
    ...new Set(reminders.filter((m) => Number.isFinite(m) && m >= 0)),
  ].sort((a, b) => a - b);
  if (mins.length === 0) {
    await prisma.subscribedReminder.deleteMany({ where: { eventId, userId } });
  } else {
    await prisma.subscribedReminder.upsert({
      where: { eventId_userId: { eventId, userId } },
      create: { eventId, userId, minutes: mins },
      update: { minutes: mins },
    });
  }
}
