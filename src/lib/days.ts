/**
 * Weekday constants, deliberately in their own module with no imports.
 *
 * Client components need these, and anything a client component imports is
 * pulled into the browser bundle along with everything *it* imports. Keeping
 * them next to a Prisma query would drag the pg driver — and Node's net and
 * tls modules — into the client build, which fails to compile.
 *
 * Weeks run Sunday to Saturday, matching Date.getUTCDay().
 */

export const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export const DAY_SHORT = [
  "Sun",
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
] as const;
