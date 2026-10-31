/**
 * Concept2 Logbook: turning results into rows (pure). The fetching, the
 * ledger and the day's sessions are in concept2-run.ts.
 *
 * A result's `time` is tenths of a second and `distance` metres; `date` is the
 * monitor's local time ("2026-10-31 07:12:00"), so its first ten characters
 * are the day the row counts for. Only rower results are taken (the household
 * has a rower); a SkiErg or bike result is skipped.
 */

export const C2_BASE = "https://log.concept2.com";
export const C2_ACCEPT = "application/vnd.c2logbook.v1+json";
/** How far back the first sync reaches, and the most any sync reaches. */
export const FIRST_SYNC_DAYS = 14;
export const MAX_BACK_DAYS = 90;
/** Opening the day page syncs at most this often; "Check now" always does. */
export const SYNC_EVERY_MIN = 5;

export type C2Raw = {
  id?: unknown;
  type?: unknown;
  date?: unknown;
  distance?: unknown;
  time?: unknown;
  stroke_rate?: unknown;
};

export type C2Row = {
  resultId: string;
  dateISO: string;
  meters: number;
  seconds: number;
  /** Seconds per 500 m, to a tenth; null with no distance. */
  pace: number | null;
  strokeRate: number | null;
};

const num = (v: unknown): number | null => {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
};

/** One result as a row, or null when it isn't a usable rower result. */
export function mapResult(r: C2Raw): C2Row | null {
  if (r.type !== "rower") return null;
  const id = num(r.id);
  const date = typeof r.date === "string" ? r.date.slice(0, 10) : "";
  const meters = num(r.distance) ?? 0;
  const tenths = num(r.time) ?? 0;
  if (id == null || !/^\d{4}-\d{2}-\d{2}$/.test(date) || (meters <= 0 && tenths <= 0)) return null;
  const pace = meters > 0 && tenths > 0 ? Math.round((tenths / 10 / (meters / 500)) * 10) / 10 : null;
  const spm = num(r.stroke_rate);
  return {
    resultId: String(Math.trunc(id)),
    dateISO: date,
    meters: Math.round(meters),
    seconds: Math.round(tenths / 10),
    pace,
    strokeRate: spm && spm > 0 ? Math.round(spm) : null,
  };
}

/** "7:45" or "1:02:05"; with tenths, "1:56.3". */
export function fmtClock(seconds: number, tenths = false): string {
  const t = Math.max(0, seconds);
  const whole = Math.floor(t);
  const h = Math.floor(whole / 3600);
  const m = Math.floor((whole % 3600) / 60);
  const s = whole % 60;
  const ss = String(s).padStart(2, "0") + (tenths ? `.${Math.round((t - whole) * 10) % 10}` : "");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

/** "2,000 m · 7:45 · 1:56.3 /500m": how a row reads everywhere. */
export function rowSummary(r: Pick<C2Row, "meters" | "seconds" | "pace">): string {
  return [
    r.meters > 0 ? `${r.meters.toLocaleString("en-US")} m` : "",
    r.seconds > 0 ? fmtClock(r.seconds) : "",
    r.pace != null ? `${fmtClock(r.pace, true)} /500m` : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

/** The session note that marks a row as Concept2's. */
export function rowNotes(r: C2Row): string {
  return ["Concept2", r.pace != null ? `${fmtClock(r.pace, true)} /500m` : "", r.strokeRate ? `${r.strokeRate} spm` : ""]
    .filter(Boolean)
    .join(" · ");
}

/** The `updated_after` to ask for: a day before the last good sync (edits and
 *  late uploads still come through), or the first-sync window. */
export function syncFrom(lastSyncISO: string | null, todayISO: string): string {
  const back = (iso: string, days: number) => {
    const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - days);
    return d.toISOString().slice(0, 10);
  };
  const floor = back(todayISO, MAX_BACK_DAYS);
  const from = lastSyncISO ? back(lastSyncISO, 1) : back(todayISO, FIRST_SYNC_DAYS);
  return from < floor ? floor : from;
}

/** Whether opening the page should sync now. */
export function syncDue(lastSyncISO: string | null, now: Date, force = false): boolean {
  if (force || !lastSyncISO) return true;
  const last = Date.parse(lastSyncISO);
  return !Number.isFinite(last) || now.getTime() - last >= SYNC_EVERY_MIN * 60_000;
}

/** A token as pasted: trimmed, "Bearer " dropped, nothing that can't be one. */
export function cleanToken(raw: string): string | null {
  const t = raw.trim().replace(/^bearer\s+/i, "");
  return /^[A-Za-z0-9._~+/=-]{16,2000}$/.test(t) ? t : null;
}
