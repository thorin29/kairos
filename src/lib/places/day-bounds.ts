/**
 * The instant a household day starts, in a given IANA timezone. Location
 * points are instants; a "day" of them runs from local midnight to the next
 * local midnight, which is 23 or 25 hours long across a DST change.
 */

function partsAt(ms: number, tz: string): number {
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const p: Record<string, number> = {};
  for (const x of f.formatToParts(new Date(ms))) {
    if (x.type !== "literal") p[x.type] = Number(x.value);
  }
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
}

/** Local midnight of `iso` (YYYY-MM-DD) in `tz`, as a Date. */
export function dayStart(iso: string, tz: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d);
  let t = guess - (partsAt(guess, tz) - guess);
  // Second pass settles a guess that landed on the other side of a DST change.
  t = guess - (partsAt(t, tz) - t);
  return new Date(t);
}

/** Local midnight after `iso` in `tz`. */
export function dayEnd(iso: string, tz: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
  return dayStart(next, tz);
}
