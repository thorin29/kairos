import type { GridEvent } from "@/lib/queries/calendar";

/**
 * Delete is only offered where it will actually work: never for subscribed
 * feed events, and only for parents when the event repeats or is a birthday.
 * Showing a button that always fails is worse than showing none.
 *
 * Lives outside the client component so server components can call it too.
 */
export function canDeleteEvent(e: GridEvent, admin: boolean): boolean {
  if (!e.eventId || e.external) return false;
  if (e.recurring || e.kind === "BIRTHDAY") return admin;
  return true;
}
