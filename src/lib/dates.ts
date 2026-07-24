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

export function householdTz(): string {
  return HOUSEHOLD_TZ;
}

/**
 * Offset between a named timezone and UTC at a given instant, in ms.
 * Formatting the instant in that zone and reading it back as if it were UTC
 * gives the offset, DST included.
 */
function tzOffsetMs(at: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);

  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? "0");

  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour") % 24,
    get("minute"),
    get("second"),
  );

  return asUtc - at.getTime();
}

/**
 * A wall-clock time in a named zone to the real instant it refers to.
 * Applied twice because the offset itself depends on the instant, which is
 * what makes DST boundaries work.
 */
export function zonedToUtc(
  y: number,
  mo: number,
  d: number,
  h: number,
  mi: number,
  s: number,
  tz: string,
): Date {
  const guess = Date.UTC(y, mo - 1, d, h, mi, s);
  const first = tzOffsetMs(new Date(guess), tz);
  const second = tzOffsetMs(new Date(guess - first), tz);
  return new Date(guess - second);
}

/** Where an instant falls on the household's calendar grid. */
export function localParts(at: Date): {
  iso: string;
  minutes: number;
  label: string;
} {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: HOUSEHOLD_TZ,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(at);

  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? "00";

  const hour = Number(get("hour")) % 24;
  const minute = Number(get("minute"));

  return {
    iso: `${get("year")}-${get("month")}-${get("day")}`,
    minutes: hour * 60 + minute,
    label: new Intl.DateTimeFormat("en-US", {
      timeZone: HOUSEHOLD_TZ,
      hour: "numeric",
      minute: "2-digit",
    }).format(at),
  };
}

export function startOfMonth(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

export function addMonths(iso: string, n: number): string {
  const d = new Date(`${startOfMonth(iso)}T00:00:00.000Z`);
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * The 42 cells a month view needs: whole weeks from the Sunday on or before
 * the 1st. Trailing days from the neighbouring months are included so the
 * grid is always a clean six rows and doesn't reflow between months.
 */
export function monthGridDays(iso: string): string[] {
  const first = startOfMonth(iso);
  const start = startOfWeek(first);
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

export function isSameMonth(iso: string, monthIso: string): boolean {
  return iso.slice(0, 7) === monthIso.slice(0, 7);
}

export function formatMonth(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
  }).format(new Date(`${iso}T00:00:00.000Z`));
}

export function formatWeekday(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "short",
  }).format(new Date(`${iso}T00:00:00.000Z`));
}

/** Same day-of-month n months on, clamped when the month is shorter. */
export function shiftMonths(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 + n, 1));
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  const day = Math.min(d, lastDay);
  return `${target.getUTCFullYear()}-${String(target.getUTCMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Same date n years on. Feb 29 lands on Feb 28 in common years. */
export function shiftYears(iso: string, n: number): string {
  return shiftMonths(iso, n * 12);
}
