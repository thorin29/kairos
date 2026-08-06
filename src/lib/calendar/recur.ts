import {
  addDays,
  localParts,
  shiftMonths,
  shiftYears,
  startOfWeek,
  zonedToUtc,
} from "@/lib/dates";

/**
 * Expands the simple recurrence rules this app writes: a frequency, an
 * interval, optionally an end date or a count, and — for weekly rules — an
 * optional set of weekdays (a practice on Monday and Wednesday every week).
 *
 * Occurrences are stepped in *local* calendar terms and converted back to
 * instants, not by adding a fixed number of milliseconds. A weekly 4pm shift
 * has to stay 4pm across the March clock change, and adding 7×24 hours would
 * quietly shift it to 3pm.
 *
 * Feed events are not expanded here — see the note in ics.ts.
 */

/** iCalendar weekday tokens, in Sunday-first order to match the week grid. */
export const WEEKDAY_TOKENS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"] as const;
const WEEKDAY_NUM: Record<string, number> = {
  SU: 0,
  MO: 1,
  TU: 2,
  WE: 3,
  TH: 4,
  FR: 5,
  SA: 6,
};

export type Recurrence = {
  freq: "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
  interval: number;
  until: string | null;
  count: number | null;
  /** Weekly-only: which weekdays to land on. Null means "same day as start". */
  byday: string[] | null;
};

export function parseRule(rrule: string | null): Recurrence | null {
  if (!rrule) return null;

  const parts = Object.fromEntries(
    rrule
      .replace(/^RRULE:/i, "")
      .split(";")
      .map((p) => {
        const [k, v] = p.split("=");
        return [k?.toUpperCase(), v];
      }),
  ) as Record<string, string | undefined>;

  const freq = parts.FREQ?.toUpperCase();
  if (
    freq !== "DAILY" &&
    freq !== "WEEKLY" &&
    freq !== "MONTHLY" &&
    freq !== "YEARLY"
  ) {
    return null;
  }

  const interval = Number(parts.INTERVAL ?? 1);
  const untilRaw = parts.UNTIL;

  const byday =
    freq === "WEEKLY" && parts.BYDAY
      ? parts.BYDAY.split(",")
          .map((d) => d.trim().toUpperCase())
          .filter((d) => d in WEEKDAY_NUM)
      : null;

  return {
    freq,
    interval: Number.isFinite(interval) && interval > 0 ? interval : 1,
    until: untilRaw
      ? `${untilRaw.slice(0, 4)}-${untilRaw.slice(4, 6)}-${untilRaw.slice(6, 8)}`
      : null,
    count: parts.COUNT ? Number(parts.COUNT) : null,
    byday: byday && byday.length > 0 ? byday : null,
  };
}

export function buildRule(
  freq: Recurrence["freq"],
  interval: number,
  until: string | null,
  count: number | null = null,
  byday: string[] | null = null,
): string {
  const parts = [`FREQ=${freq}`];
  if (interval > 1) parts.push(`INTERVAL=${interval}`);
  // Weekdays only make sense for a weekly rule.
  if (freq === "WEEKLY" && byday && byday.length > 0) {
    const clean = byday
      .map((d) => d.trim().toUpperCase())
      .filter((d) => d in WEEKDAY_NUM);
    if (clean.length > 0) parts.push(`BYDAY=${clean.join(",")}`);
  }
  // UNTIL and COUNT are mutually exclusive in iCalendar; callers pass at most
  // one, and UNTIL wins if somehow both arrive.
  if (until) parts.push(`UNTIL=${until.replace(/-/g, "")}`);
  else if (count && count > 0) parts.push(`COUNT=${count}`);
  return parts.join(";");
}

function step(iso: string, rule: Recurrence, n: number): string {
  const k = rule.interval * n;
  switch (rule.freq) {
    case "DAILY":
      return addDays(iso, k);
    case "WEEKLY":
      return addDays(iso, k * 7);
    case "MONTHLY":
      return shiftMonths(iso, k);
    case "YEARLY":
      return shiftYears(iso, k);
  }
}

const MAX_OCCURRENCES = 800;

/**
 * Occurrence start instants falling inside [fromISO, toISO], inclusive.
 * The first occurrence is the event's own start.
 */
export function occurrencesIn(
  baseStart: Date,
  rrule: string,
  fromISO: string,
  toISO: string,
  tz: string,
): Date[] {
  const rule = parseRule(rrule);
  if (!rule) return [];

  const base = localParts(baseStart);
  const hour = Math.floor(base.minutes / 60);
  const minute = base.minutes % 60;

  const at = (iso: string): Date => {
    const [y, mo, d] = iso.split("-").map(Number);
    return zonedToUtc(y, mo, d, hour, minute, 0, tz);
  };

  // Weekly on specific weekdays (e.g. Monday and Wednesday every week). Each
  // interval-week contributes every selected weekday on or after the start
  // date, in calendar order, capped by COUNT / UNTIL.
  if (rule.freq === "WEEKLY" && rule.byday && rule.byday.length > 0) {
    const targets = rule.byday
      .map((d) => WEEKDAY_NUM[d])
      .filter((n): n is number => n !== undefined)
      .sort((a, b) => a - b);
    if (targets.length === 0) return [];

    const out: Date[] = [];
    const week0 = startOfWeek(base.iso); // Sunday of the start's week
    let produced = 0;

    for (let w = 0; w < MAX_OCCURRENCES; w++) {
      const weekStart = addDays(week0, w * 7 * rule.interval);
      // Once the earliest day of the week is past the window, we're done.
      if (weekStart > toISO) break;

      for (const td of targets) {
        const iso = addDays(weekStart, td);
        if (iso < base.iso) continue; // before the series' own start
        if (rule.until && iso > rule.until) return out;
        if (rule.count !== null && produced >= rule.count) return out;
        produced++;
        if (iso >= fromISO && iso <= toISO) out.push(at(iso));
      }

      if (produced >= MAX_OCCURRENCES) break;
    }

    return out;
  }

  const out: Date[] = [];

  for (let n = 0; n < MAX_OCCURRENCES; n++) {
    if (rule.count !== null && n >= rule.count) break;

    const iso = step(base.iso, rule, n);
    if (rule.until && iso > rule.until) break;
    if (iso > toISO) break;
    if (iso < fromISO) continue;

    out.push(at(iso));
  }

  return out;
}
