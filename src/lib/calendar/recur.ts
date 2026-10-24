import {
  addDays,
  dayOfWeek,
  localParts,
  shiftMonths,
  shiftYears,
  startOfWeek,
  zonedToUtc,
  eventTz,
} from "@/lib/dates";
import { occurrenceSpanMs } from "@/lib/calendar/repeat-span";

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

/**
 * For a "this and future" split: if a weekly rule's BYDAY no longer includes the
 * (possibly moved) start date's weekday, the edited occurrence — now on a new
 * day — would never be generated. For a SINGLE-day rule, drop BYDAY so the
 * series simply repeats on the new start date's weekday. Multi-day rules (the
 * start only anchors the first week) and non-weekly rules are returned unchanged.
 */
export function alignWeeklyByday(
  rrule: string | null,
  startISO: string,
): string | null {
  const r = parseRule(rrule);
  if (!r || r.freq !== "WEEKLY" || !r.byday || r.byday.length === 0) return rrule;
  const startTok = WEEKDAY_TOKENS[dayOfWeek(startISO)];
  if (r.byday.includes(startTok) || r.byday.length > 1) return rrule;
  return buildRule(r.freq, r.interval, r.until, r.count, null);
}
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

  // The start's own wall clock in `tz` — for an all-day event that is UTC
  // (see eventTz), so its day is not read as the evening before.
  const base = localParts(baseStart, tz);
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

/**
 * The occurrence a calendar DAY belongs to, as that occurrence's start date.
 *
 * An occurrence that runs past midnight is drawn on two days; the calendar
 * hands an editor whichever piece was tapped. Opening the after-midnight
 * piece used to send the NEXT day as "the occurrence", so a single-occurrence
 * edit saved an override for a date the series never had — the original
 * stayed and an edited copy appeared a day later (a duplicate), and "delete
 * this event" deleted nothing. Every save and delete path resolves the date
 * through here first; so does the read side for overrides saved before.
 *
 * `spanMs` is the occurrence length (`occurrenceSpanMs`, ≤ 24 h), so only the
 * day itself and the day before can hold an occurrence covering `iso`. A day
 * that starts an occurrence of its own wins; otherwise the day before is
 * used if its occurrence reaches past midnight; otherwise `iso` as given.
 */
export function occurrenceDayFor(
  baseStart: Date,
  rrule: string,
  spanMs: number,
  iso: string,
  tz: string,
): string {
  const own = occurrencesIn(baseStart, rrule, iso, iso, tz);
  if (own.length > 0) return iso;
  const prevISO = addDays(iso, -1);
  const prev = occurrencesIn(baseStart, rrule, prevISO, prevISO, tz);
  if (prev.length === 0) return iso;
  const [y, mo, d] = iso.split("-").map(Number);
  const dayStart = zonedToUtc(y, mo, d, 0, 0, 0, tz);
  const reaches = prev.some((p) => p.getTime() + spanMs > dayStart.getTime());
  return reaches ? prevISO : iso;
}

/**
 * `occurrenceDayFor` for a stored series row: the one call every save, delete
 * and read path makes with the day a client sent. A malformed day, or a row
 * that doesn't repeat, comes back unchanged.
 */
export function occurrenceOfRow(
  row: { startsAt: Date; endsAt: Date; allDay: boolean; rrule: string | null },
  iso: string,
): string {
  if (!row.rrule || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const tz = eventTz(row.allDay);
  return occurrenceDayFor(
    row.startsAt,
    row.rrule,
    occurrenceSpanMs(row.startsAt, row.endsAt, row.allDay, tz),
    iso,
    tz,
  );
}
