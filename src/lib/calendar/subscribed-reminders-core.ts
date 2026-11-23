import "server-only";
import { setMyReminders } from "@/lib/calendar/my-reminders";

/** Set this person's own reminders on an event (v0.774: any event, not only
 *  feed events). Empty mutes them; `reset` goes back to the event's own. */
export async function setSubscribedRemindersCore(
  userId: string,
  eventId: string,
  reminders: number[],
  reset = false,
): Promise<void> {
  await setMyReminders(userId, eventId, reset ? null : reminders);
}
