/**
 * Task.dueDate is a DATE column: a calendar day with no timezone. Prisma
 * represents those as a Date at UTC midnight, so every conversion between
 * "the day it is here" and a stored value goes through this file.
 *
 * Getting this wrong is how chores show up a day early. TZ is read from the
 * environment so the household's day boundary is the one that counts, not
 * the server's.
 */

const TZ = process.env.TZ || "UTC";

/** Calendar day in the household timezone, as YYYY-MM-DD. */
export function todayISO(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** YYYY-MM-DD -> the Date value Prisma stores for that day. */
export function toDateColumn(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

/** A stored DATE value back to YYYY-MM-DD. */
export function fromDateColumn(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Sunday of the week containing the given day. Weeks run Sunday–Saturday. */
export function startOfWeek(iso: string): string {
  const d = new Date(`${iso}T00:00:00.000Z`);
  return addDays(iso, -d.getUTCDay());
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
