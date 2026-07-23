/**
 * Task.dueDate and the chore effective dates are DATE columns: calendar days
 * with no timezone. Every conversion between "the day it is here" and a
 * stored value goes through this file.
 *
 * Two rules make this survivable:
 *
 * 1. The Node process always runs in UTC. The pg driver parses DATE columns
 *    into a JS Date at *local* midnight, so if the process ran in Chicago a
 *    stored 2026-07-23 would come back as 05:00Z and compare as greater than
 *    the 00:00Z value we wrote. Forcing the process to UTC makes reads and
 *    writes agree. HOUSEHOLD_TZ carries the real timezone for display and
 *    for deciding when "today" rolls over.
 *
 * 2. Dates are compared as YYYY-MM-DD strings, never as Date objects.
 *    String comparison can't be thrown off by an hours-level offset.
 */

const HOUSEHOLD_TZ =
  process.env.HOUSEHOLD_TZ || process.env.TZ || "UTC";

/** Calendar day in the household timezone, as YYYY-MM-DD. */
export function todayISO(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: HOUSEHOLD_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** YYYY-MM-DD -> the Date value Prisma stores for that day. */
export function toDateColumn(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

/**
 * A stored DATE value back to YYYY-MM-DD. Formatted in UTC because the
 * process runs in UTC; anything else reintroduces the off-by-one.
 */
export function fromDateColumn(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** 0 = Sunday .. 6 = Saturday, for a YYYY-MM-DD string. */
export function dayOfWeek(iso: string): number {
  return new Date(`${iso}T00:00:00.000Z`).getUTCDay();
}

/** Sunday of the week containing the given day. Weeks run Sunday–Saturday. */
export function startOfWeek(iso: string): string {
  return addDays(iso, -dayOfWeek(iso));
}

export function weekDays(iso: string): string[] {
  const start = startOfWeek(iso);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function formatLong(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${iso}T00:00:00.000Z`));
}

export function formatShort(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "numeric",
    day: "numeric",
  }).format(new Date(`${iso}T00:00:00.000Z`));
}
