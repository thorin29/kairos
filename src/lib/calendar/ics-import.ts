import { NOTES_MAX } from "@/lib/calendar/event-notes";
import { addDays, daysBetween, dayOfWeek, tzOffsetMs, zonedToUtc } from "@/lib/dates";

/**
 * Turning ONE calendar file (an .ics attachment from an email) into a draft
 * for the New event form.
 *
 * Not the feed reader: `ics.ts` keeps a subscribed calendar in sync and wants
 * every occurrence it can find. This answers a smaller question — "what is the
 * single event in this file?" — and leaves everything Kairos-specific (whose
 * calendar, the type, reminders, who's going) for the person to choose.
 *
 * MIRRORED on the phone in `IcsImport.kt`, which parses the file on the device.
 * The two copies must agree exactly — the same file gives the same draft on
 * both — and `scripts/ics-parity/` checks them against a shared set of files.
 * Change one, change the other, and re-run the parity check.
 *
 * The rules, so both copies can be read against them:
 *  - Only properties directly on a VEVENT count; an alarm's DESCRIPTION is not
 *    the event's. First value wins.
 *  - METHOD:CANCEL, or every event STATUS:CANCELLED → "cancelled".
 *  - A VEVENT with RECURRENCE-ID changes one occurrence of another; those are
 *    only used when the file holds nothing else. Events are counted by UID.
 *    More than one → "many": a schedule belongs in a subscription, not here.
 *  - Times land as wall-clock in `targetTz` (the household's zone, which both
 *    forms enter times in). A UTC time or a known TZID is converted; a TZID
 *    that isn't a real zone (after the Windows names Outlook uses) and a
 *    floating time are read as already being in `targetTz`.
 *  - All-day DTEND is exclusive in the file; the draft's endDate is the last
 *    day, as both forms show it. A timed event with no usable end runs an hour.
 *  - A repeat carries over only when it is plainly daily / weekly / monthly /
 *    yearly from the start date with no end, interval, exceptions or changed
 *    occurrences. Anything else is dropped and flagged, never approximated.
 */

export type IcsRepeat = "NONE" | "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";

export type IcsDraft = {
  title: string;
  allDay: boolean;
  startDate: string; // YYYY-MM-DD
  startTime: string | null; // HH:MM, null when all day
  endDate: string; // YYYY-MM-DD — the last day for all-day, the day it ends otherwise
  endTime: string | null;
  location: string | null;
  notes: string | null;
  repeat: IcsRepeat;
  repeatDropped: boolean;
};

export type IcsImport =
  | { kind: "event"; draft: IcsDraft }
  | { kind: "many"; count: number }
  | { kind: "cancelled" }
  | { kind: "none" };

export const ICS_TITLE_MAX = 120;
export const ICS_LOCATION_MAX = 200;
/** Bigger than any single invite; a file past this is a schedule or not a calendar. */
export const ICS_MAX_BYTES = 1_000_000;

/** Windows zone names, as Outlook writes them in TZID, to IANA. */
const WINDOWS_TZ: Record<string, string> = {
  "Eastern Standard Time": "America/New_York",
  "Central Standard Time": "America/Chicago",
  "Mountain Standard Time": "America/Denver",
  "US Mountain Standard Time": "America/Phoenix",
  "Pacific Standard Time": "America/Los_Angeles",
  "Alaskan Standard Time": "America/Anchorage",
  "Hawaiian Standard Time": "Pacific/Honolulu",
  "Atlantic Standard Time": "America/Halifax",
  "Central Standard Time (Mexico)": "America/Mexico_City",
  "GMT Standard Time": "Europe/London",
  "W. Europe Standard Time": "Europe/Berlin",
  "Romance Standard Time": "Europe/Paris",
  "UTC": "UTC",
  "Coordinated Universal Time": "UTC",
};

type Field = { value: string; params: Record<string, string> };
type Vevent = Record<string, Field>;

const WS = " \t\r\n\f\u000b ﻿";

function trimWs(s: string): string {
  let a = 0;
  let b = s.length;
  while (a < b && WS.includes(s[a])) a++;
  while (b > a && WS.includes(s[b - 1])) b--;
  return s.slice(a, b);
}

/** First `max` UTF-16 units, never ending on half of a surrogate pair (an emoji
 *  cut in two would save as a broken character). */
function clip(s: string, max: number): string {
  if (s.length <= max) return s;
  const code = s.charCodeAt(max - 1);
  return s.slice(0, code >= 0xd800 && code <= 0xdbff ? max - 1 : max);
}

function unescapeText(v: string): string {
  let out = "";
  for (let i = 0; i < v.length; i++) {
    const c = v[i];
    if (c === "\\" && i + 1 < v.length) {
      const n = v[i + 1];
      out += n === "n" || n === "N" ? "\n" : n;
      i++;
    } else {
      out += c;
    }
  }
  return out;
}

function unfold(raw: string): string[] {
  const lines: string[] = [];
  for (const line of raw.split(/\r\n|\n|\r/)) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && lines.length > 0) {
      lines[lines.length - 1] += line.slice(1);
    } else {
      lines.push(line);
    }
  }
  return lines;
}

/** NAME;P=x;Q="y":value — the first colon outside quotes ends the name part. */
function parseLine(line: string): { name: string; field: Field } | null {
  let inQuote = false;
  let colon = -1;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') inQuote = !inQuote;
    else if (c === ":" && !inQuote) {
      colon = i;
      break;
    }
  }
  if (colon <= 0) return null;
  const head = line.slice(0, colon);
  const value = line.slice(colon + 1);
  const parts: string[] = [];
  let cur = "";
  inQuote = false;
  for (const c of head) {
    if (c === '"') inQuote = !inQuote;
    if (c === ";" && !inQuote) {
      parts.push(cur);
      cur = "";
    } else cur += c;
  }
  parts.push(cur);
  const name = trimWs(parts[0]).toUpperCase();
  if (!name) return null;
  const params: Record<string, string> = {};
  for (const p of parts.slice(1)) {
    const eq = p.indexOf("=");
    if (eq <= 0) continue;
    let v = p.slice(eq + 1);
    if (v.length >= 2 && v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    params[trimWs(p.slice(0, eq)).toUpperCase()] = v;
  }
  return { name, field: { value, params } };
}

function isZone(tz: string): boolean {
  if (!/^[A-Za-z][A-Za-z0-9_+\-]*(\/[A-Za-z0-9_+\-]+)*$/.test(tz)) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** The zone a TZID names, or null to read the time as floating. */
function resolveZone(tzid: string | undefined): string | null {
  if (!tzid) return null;
  const t = trimWs(tzid);
  if (WINDOWS_TZ[t]) return WINDOWS_TZ[t];
  if (isZone(t)) return t;
  // "/mozilla.org/20050126_1/America/New_York" and similar prefixed ids.
  const segs = t.split("/").filter(Boolean);
  if (segs.length >= 2) {
    const tail = `${segs[segs.length - 2]}/${segs[segs.length - 1]}`;
    if (isZone(tail)) return tail;
  }
  return null;
}

const pad = (n: number) => String(n).padStart(2, "0");

type Moment =
  | { allDay: true; date: string }
  | { allDay: false; epochMs: number };

const DT = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/;

function parseMoment(f: Field, targetTz: string): Moment | null {
  const m = DT.exec(trimWs(f.value));
  if (!m) return null;
  const [, y, mo, d, h, mi, s, z] = m;
  const Y = Number(y), MO = Number(mo), D = Number(d);
  // A real calendar day only — Date.UTC would quietly roll 31 Feb into March.
  // Real invites only; also keeps every date four digits after a zone shift.
  if (Y < 1900 || Y > 2199) return null;
  const check = new Date(Date.UTC(Y, MO - 1, D));
  if (check.getUTCFullYear() !== Y || check.getUTCMonth() !== MO - 1 || check.getUTCDate() !== D) {
    return null;
  }
  const date = `${y}-${mo}-${d}`;
  if (f.params.VALUE?.toUpperCase() === "DATE" || h === undefined) {
    return { allDay: true, date };
  }
  const H = Number(h), MI = Number(mi);
  const S = s === undefined ? 0 : Number(s);
  if (H > 23 || MI > 59 || S > 59) return null;
  if (z) return { allDay: false, epochMs: Date.UTC(Y, MO - 1, D, H, MI, S) };
  const zone = resolveZone(f.params.TZID) ?? targetTz;
  return { allDay: false, epochMs: zonedToUtc(Y, MO, D, H, MI, S, zone).getTime() };
}

function wallClock(epochMs: number, tz: string): { date: string; time: string } {
  const local = new Date(epochMs + tzOffsetMs(new Date(epochMs), tz));
  return {
    date: `${local.getUTCFullYear()}-${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())}`,
    time: `${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}`,
  };
}

/** P1W, P2D, PT1H30M, -PT15M → ms (or whole days for all-day use). */
function parseDuration(v: string): { ms: number; days: number } | null {
  const m = /^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(
    trimWs(v).toUpperCase(),
  );
  if (!m) return null;
  const sign = m[1] === "-" ? -1 : 1;
  const days = (Number(m[2] ?? 0) * 7 + Number(m[3] ?? 0)) * sign;
  const secs = Number(m[4] ?? 0) * 3600 + Number(m[5] ?? 0) * 60 + Number(m[6] ?? 0);
  return { ms: (days * 86400 + secs * sign) * 1000, days };
}

const DAY_TOKENS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

function mapRepeat(ev: Vevent, startDate: string, hasOverrides: boolean): { repeat: IcsRepeat; dropped: boolean } {
  const rule = ev.RRULE?.value;
  if (!rule) return { repeat: "NONE", dropped: false };
  const drop = { repeat: "NONE" as IcsRepeat, dropped: true };
  if (ev.EXDATE || ev.RDATE || hasOverrides) return drop;
  const parts: Record<string, string> = {};
  for (const p of rule.split(";")) {
    const eq = p.indexOf("=");
    if (eq > 0) parts[trimWs(p.slice(0, eq)).toUpperCase()] = trimWs(p.slice(eq + 1)).toUpperCase();
  }
  const freq = parts.FREQ;
  if (freq !== "DAILY" && freq !== "WEEKLY" && freq !== "MONTHLY" && freq !== "YEARLY") return drop;
  const day = Number(startDate.slice(8, 10));
  const month = Number(startDate.slice(5, 7));
  for (const [k, v] of Object.entries(parts)) {
    if (k === "FREQ" || k === "WKST") continue;
    if (k === "INTERVAL" && v === "1") continue;
    if (k === "BYDAY" && freq === "WEEKLY" && v === DAY_TOKENS[dayOfWeek(startDate)]) continue;
    if (k === "BYMONTHDAY" && (freq === "MONTHLY" || freq === "YEARLY") && v === String(day)) continue;
    if (k === "BYMONTH" && freq === "YEARLY" && v === String(month)) continue;
    return drop;
  }
  return { repeat: freq, dropped: false };
}

function buildDraft(ev: Vevent, targetTz: string, hasOverrides: boolean): IcsDraft | null {
  const start = ev.DTSTART ? parseMoment(ev.DTSTART, targetTz) : null;
  if (!start) return null;

  const title = clip(trimWs(
    unescapeText(ev.SUMMARY?.value ?? "").replace(/[\r\n\t ]+/g, " "),
  ), ICS_TITLE_MAX);
  const loc = trimWs(unescapeText(ev.LOCATION?.value ?? "").replace(/[\r\n]+/g, ", "));
  const notes = clip(trimWs(unescapeText(ev.DESCRIPTION?.value ?? "")), NOTES_MAX);
  const end = ev.DTEND ? parseMoment(ev.DTEND, targetTz) : null;
  const dur = !end && ev.DURATION ? parseDuration(ev.DURATION.value) : null;

  let draft: Omit<IcsDraft, "repeat" | "repeatDropped">;
  if (start.allDay) {
    let lastDay = start.date;
    if (end) {
      const endDay = end.allDay ? end.date : wallClock(end.epochMs, targetTz).date;
      lastDay = addDays(endDay, -1);
    } else if (dur && dur.days > 0) {
      lastDay = addDays(start.date, dur.days - 1);
    }
    if (daysBetween(start.date, lastDay) < 0) lastDay = start.date;
    draft = {
      title,
      allDay: true,
      startDate: start.date,
      startTime: null,
      endDate: lastDay,
      endTime: null,
      location: null,
      notes: null,
    };
  } else {
    let endMs: number | null = null;
    if (end) {
      endMs = end.allDay
        ? zonedToUtc(
            Number(end.date.slice(0, 4)),
            Number(end.date.slice(5, 7)),
            Number(end.date.slice(8, 10)),
            0, 0, 0, targetTz,
          ).getTime()
        : end.epochMs;
    } else if (dur) {
      endMs = start.epochMs + dur.ms;
    }
    if (endMs === null || endMs <= start.epochMs) endMs = start.epochMs + 3_600_000;
    const s = wallClock(start.epochMs, targetTz);
    const e = wallClock(endMs, targetTz);
    draft = {
      title,
      allDay: false,
      startDate: s.date,
      startTime: s.time,
      endDate: e.date,
      endTime: e.time,
      location: null,
      notes: null,
    };
  }
  draft.location = loc ? clip(loc, ICS_LOCATION_MAX) : null;
  draft.notes = notes || null;
  const r = mapRepeat(ev, draft.startDate, hasOverrides);
  return { ...draft, repeat: r.repeat, repeatDropped: r.dropped };
}

/** Never throws: a file it can't make sense of is simply "no event". */
export function readIcsFile(raw: string, householdTz: string): IcsImport {
  try {
    return read(raw, householdTz);
  } catch {
    return { kind: "none" };
  }
}

function read(raw: string, householdTz: string): IcsImport {
  const targetTz = isZone(householdTz) ? householdTz : "UTC";
  const text = raw.startsWith("﻿") ? raw.slice(1) : raw;
  const stack: string[] = [];
  const events: Vevent[] = [];
  let method = "";
  let current: Vevent | null = null;

  for (const line of unfold(text)) {
    const parsed = parseLine(line);
    if (!parsed) continue;
    const { name, field } = parsed;
    if (name === "BEGIN") {
      const comp = trimWs(field.value).toUpperCase();
      stack.push(comp);
      if (comp === "VEVENT") current = {};
      continue;
    }
    if (name === "END") {
      const comp = stack.pop();
      if (comp === "VEVENT" && current) {
        events.push(current);
        current = null;
      }
      continue;
    }
    const top = stack[stack.length - 1];
    if (top === "VCALENDAR" && name === "METHOD" && !method) {
      method = trimWs(field.value).toUpperCase();
    } else if (top === "VEVENT" && current && !(name in current)) {
      current[name] = field;
    }
  }

  if (method === "CANCEL") return { kind: "cancelled" };
  const isCancelled = (e: Vevent) => trimWs(e.STATUS?.value ?? "").toUpperCase() === "CANCELLED";
  const live = events.filter((e) => e.DTSTART && !isCancelled(e));
  const masters = live.filter((e) => !e["RECURRENCE-ID"]);
  const overrides = live.filter((e) => e["RECURRENCE-ID"]);

  const pool = masters.length > 0 ? masters : overrides;
  const seen = new Set<string>();
  const distinct: Vevent[] = [];
  for (const e of pool) {
    const uid = trimWs(e.UID?.value ?? "");
    const key = masters.length > 0 ? uid : `${uid}|${e["RECURRENCE-ID"]?.value ?? ""}`;
    if (uid && seen.has(key)) continue;
    if (uid) seen.add(key);
    distinct.push(e);
  }

  if (distinct.length === 0) {
    return events.some(isCancelled) ? { kind: "cancelled" } : { kind: "none" };
  }
  if (distinct.length > 1) return { kind: "many", count: distinct.length };

  const only = distinct[0];
  const uid = trimWs(only.UID?.value ?? "");
  const hasOverrides =
    masters.length > 0 && Boolean(uid) && overrides.some((o) => trimWs(o.UID?.value ?? "") === uid);
  const draft = buildDraft(only, targetTz, hasOverrides);
  return draft ? { kind: "event", draft } : { kind: "none" };
}
