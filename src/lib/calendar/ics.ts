import { zonedToUtc } from "@/lib/dates";

/**
 * Minimal iCalendar reader for subscribed feeds.
 *
 * Deliberately not a full RFC 5545 implementation — it handles what public
 * schedule feeds actually publish: explicit VEVENTs with a start, an end,
 * and a summary. Recurrence rules are captured but not expanded, so a feed
 * built entirely from RRULEs will under-report. Sports and school feeds,
 * the cases this is for, list every occurrence individually.
 */

export type IcsEvent = {
  uid: string;
  summary: string;
  location: string | null;
  description: string | null;
  startsAt: Date;
  endsAt: Date;
  allDay: boolean;
  rrule: string | null;
};

/** Joins continuation lines, which iCalendar marks with leading whitespace. */
function unfold(raw: string): string[] {
  const lines = raw.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];

  for (const line of lines) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && out.length > 0) {
      out[out.length - 1] += line.slice(1);
    } else {
      out.push(line);
    }
  }

  return out;
}

function unescape(value: string): string {
  return value
    .replace(/\\n/gi, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");
}

type Field = { params: Record<string, string>; value: string };

function parseLine(line: string): { name: string; field: Field } | null {
  const colon = line.indexOf(":");
  if (colon === -1) return null;

  const left = line.slice(0, colon);
  const value = line.slice(colon + 1);
  const [name, ...paramParts] = left.split(";");

  const params: Record<string, string> = {};
  for (const p of paramParts) {
    const eq = p.indexOf("=");
    if (eq > 0) params[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1);
  }

  return { name: name.toUpperCase(), field: { params, value } };
}

/**
 * Three date forms appear in practice: a UTC instant ending in Z, a
 * floating or zoned wall-clock time, and a date-only value for all-day
 * events. Zoned times are resolved through the feed's TZID.
 */
function parseDate(
  field: Field,
  fallbackTz: string,
): { at: Date; allDay: boolean } | null {
  const v = field.value.trim();

  if (field.params.VALUE === "DATE" || /^\d{8}$/.test(v)) {
    const y = Number(v.slice(0, 4));
    const mo = Number(v.slice(4, 6));
    const d = Number(v.slice(6, 8));
    return { at: new Date(Date.UTC(y, mo - 1, d)), allDay: true };
  }

  const m = v.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/);
  if (!m) return null;

  const [, y, mo, d, h, mi, s, z] = m;

  if (z) {
    return {
      at: new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s)),
      allDay: false,
    };
  }

  const tz = field.params.TZID || fallbackTz;
  return { at: zonedToUtc(+y, +mo, +d, +h, +mi, +s, tz), allDay: false };
}

export function parseIcs(raw: string, fallbackTz: string): IcsEvent[] {
  const lines = unfold(raw);
  const events: IcsEvent[] = [];

  let current: Record<string, Field> | null = null;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed === "BEGIN:VEVENT") {
      current = {};
      continue;
    }

    if (trimmed === "END:VEVENT") {
      if (current) {
        const event = buildEvent(current, fallbackTz);
        if (event) events.push(event);
      }
      current = null;
      continue;
    }

    if (!current) continue;

    const parsed = parseLine(line);
    if (parsed) current[parsed.name] = parsed.field;
  }

  return events;
}

function buildEvent(
  fields: Record<string, Field>,
  fallbackTz: string,
): IcsEvent | null {
  const start = fields.DTSTART ? parseDate(fields.DTSTART, fallbackTz) : null;
  if (!start) return null;

  const uid = fields.UID?.value?.trim();
  if (!uid) return null;

  let end = fields.DTEND ? parseDate(fields.DTEND, fallbackTz) : null;

  // Some feeds give a duration instead of an end; others give neither.
  if (!end && fields.DURATION) {
    const ms = parseDuration(fields.DURATION.value);
    if (ms !== null) {
      end = { at: new Date(start.at.getTime() + ms), allDay: start.allDay };
    }
  }

  if (!end) {
    const ms = start.allDay ? 86_400_000 : 3_600_000;
    end = { at: new Date(start.at.getTime() + ms), allDay: start.allDay };
  }

  return {
    uid,
    summary: unescape(fields.SUMMARY?.value ?? "Untitled").slice(0, 200),
    location: fields.LOCATION
      ? unescape(fields.LOCATION.value).slice(0, 200)
      : null,
    description: fields.DESCRIPTION
      ? unescape(fields.DESCRIPTION.value).slice(0, 1000)
      : null,
    startsAt: start.at,
    endsAt: end.at,
    allDay: start.allDay,
    rrule: fields.RRULE?.value ?? null,
  };
}

function parseDuration(value: string): number | null {
  const m = value
    .trim()
    .match(
      /^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/,
    );
  if (!m) return null;

  const [, sign, w, d, h, mi, s] = m;
  const ms =
    (Number(w ?? 0) * 604800 +
      Number(d ?? 0) * 86400 +
      Number(h ?? 0) * 3600 +
      Number(mi ?? 0) * 60 +
      Number(s ?? 0)) *
    1000;

  return sign === "-" ? -ms : ms;
}
