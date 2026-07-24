import { addDays, localParts, shiftMonths, shiftYears, zonedToUtc } from "@/lib/dates";

/**
 * Expands the simple recurrence rules this app writes: a frequency, an
 * interval, and optionally an end date or a count.
 *
 * Occurrences are stepped in *local* calendar terms and converted back to
 * instants, not by adding a fixed number of milliseconds. A weekly 4pm shift
 * has to stay 4pm across the March clock change, and adding 7×24 hours would
 * quietly shift it to 3pm.
 *
 * Feed events are not expanded here — see the note in ics.ts.
 */

export type Recurrence = {
  freq: "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
  interval: number;
  until: string | null;
  count: number | null;
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

  return {
    freq,
    interval: Number.isFinite(interval) && interval > 0 ? interval : 1,
    until: untilRaw
      ? `${untilRaw.slice(0, 4)}-${untilRaw.slice(4, 6)}-${untilRaw.slice(6, 8)}`
      : null,
    count: parts.COUNT ? Number(parts.COUNT) : null,
  };
}

export function buildRule(
  freq: Recurrence["freq"],
  interval: number,
  until: string | null,
): string {
  const parts = [`FREQ=${freq}`];
  if (interval > 1) parts.push(`INTERVAL=${interval}`);
  if (until) parts.push(`UNTIL=${until.replace(/-/g, "")}`);
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
  const out: Date[] = [];

  for (let n = 0; n < MAX_OCCURRENCES; n++) {
    if (rule.count !== null && n >= rule.count) break;

    const iso = step(base.iso, rule, n);
    if (rule.until && iso > rule.until) break;
    if (iso > toISO) break;
    if (iso < fromISO) continue;

    const [y, mo, d] = iso.split("-").map(Number);
    out.push(
      zonedToUtc(
        y,
        mo,
        d,
        Math.floor(base.minutes / 60),
        base.minutes % 60,
        0,
        tz,
      ),
    );
  }

  return out;
}
