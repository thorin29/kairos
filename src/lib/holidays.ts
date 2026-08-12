import "server-only";
import { getSetting, setSetting } from "@/lib/settings";

/**
 * US (and Texas) holidays computed from rules, not stored or subscribed — so
 * they extend to any year without a feed that stops at year's end, and the
 * exact set is whatever the admin turns on. Rendered on the calendar the same
 * way birthdays are: synthesized all-day items at read time.
 */

export const HOLIDAY_SETTING = "holidays.enabled";
export const HOLIDAY_COLOR = "#b45309";

export type HolidayGroup =
  | "Federal"
  | "Texas"
  | "Religious"
  | "Observance"
  | "Seasonal";

type HolidayDef = {
  key: string;
  label: string;
  group: HolidayGroup;
  defaultOn: boolean;
  /** UTC-midnight date of the holiday in the given year. */
  date: (year: number) => Date;
};

const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d));

/** The n-th given weekday of a month (weekday: 0 = Sunday). */
function nthWeekday(year: number, month: number, weekday: number, n: number): Date {
  const first = utc(year, month, 1);
  const shift = (weekday - first.getUTCDay() + 7) % 7;
  return utc(year, month, 1 + shift + (n - 1) * 7);
}

/** The last given weekday of a month. */
function lastWeekday(year: number, month: number, weekday: number): Date {
  const last = new Date(Date.UTC(year, month, 0)); // day 0 of next month
  const shift = (last.getUTCDay() - weekday + 7) % 7;
  return utc(year, month, last.getUTCDate() - shift);
}

function shiftDays(base: Date, days: number): Date {
  return new Date(base.getTime() + days * 86_400_000);
}

/** Easter Sunday via the Anonymous Gregorian computus. */
function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return utc(year, month, day);
}

const fixed = (month: number, day: number) => (year: number) =>
  utc(year, month, day);

export const HOLIDAYS: HolidayDef[] = [
  // Marco's list — on by default.
  { key: "new_year", label: "New Year's Day", group: "Federal", defaultOn: true, date: fixed(1, 1) },
  { key: "mlk", label: "Martin Luther King, Jr. Day", group: "Federal", defaultOn: true, date: (y) => nthWeekday(y, 1, 1, 3) },
  { key: "confederate_heroes", label: "Confederate Heroes Day", group: "Texas", defaultOn: true, date: fixed(1, 19) },
  { key: "valentines", label: "Valentine's Day", group: "Observance", defaultOn: true, date: fixed(2, 14) },
  { key: "presidents", label: "Presidents' Day", group: "Federal", defaultOn: true, date: (y) => nthWeekday(y, 2, 1, 3) },
  { key: "texas_independence", label: "Texas Independence Day", group: "Texas", defaultOn: true, date: fixed(3, 2) },
  { key: "st_patricks", label: "St. Patrick's Day", group: "Observance", defaultOn: true, date: fixed(3, 17) },
  { key: "dst_start", label: "Daylight Saving begins", group: "Seasonal", defaultOn: true, date: (y) => nthWeekday(y, 3, 0, 2) },
  { key: "good_friday", label: "Good Friday", group: "Religious", defaultOn: true, date: (y) => shiftDays(easterSunday(y), -2) },
  { key: "easter", label: "Easter", group: "Religious", defaultOn: true, date: easterSunday },
  { key: "san_jacinto", label: "San Jacinto Day", group: "Texas", defaultOn: true, date: fixed(4, 21) },
  { key: "mothers", label: "Mother's Day", group: "Observance", defaultOn: true, date: (y) => nthWeekday(y, 5, 0, 2) },
  { key: "memorial", label: "Memorial Day", group: "Federal", defaultOn: true, date: (y) => lastWeekday(y, 5, 1) },
  { key: "flag_day", label: "Flag Day", group: "Observance", defaultOn: true, date: fixed(6, 14) },
  { key: "juneteenth", label: "Juneteenth", group: "Federal", defaultOn: true, date: fixed(6, 19) },
  { key: "fathers", label: "Father's Day", group: "Observance", defaultOn: true, date: (y) => nthWeekday(y, 6, 0, 3) },
  { key: "independence", label: "Independence Day", group: "Federal", defaultOn: true, date: fixed(7, 4) },
  { key: "labor", label: "Labor Day", group: "Federal", defaultOn: true, date: (y) => nthWeekday(y, 9, 1, 1) },
  { key: "columbus", label: "Columbus Day", group: "Federal", defaultOn: true, date: (y) => nthWeekday(y, 10, 1, 2) },
  { key: "halloween", label: "Halloween", group: "Observance", defaultOn: true, date: fixed(10, 31) },
  { key: "election_day", label: "Election Day", group: "Observance", defaultOn: true, date: (y) => shiftDays(nthWeekday(y, 11, 1, 1), 1) },
  { key: "veterans", label: "Veterans Day", group: "Federal", defaultOn: true, date: fixed(11, 11) },
  { key: "dst_end", label: "Daylight Saving ends", group: "Seasonal", defaultOn: true, date: (y) => nthWeekday(y, 11, 0, 1) },
  { key: "thanksgiving", label: "Thanksgiving", group: "Federal", defaultOn: true, date: (y) => nthWeekday(y, 11, 4, 4) },
  { key: "day_after_thanksgiving", label: "Day after Thanksgiving", group: "Observance", defaultOn: true, date: (y) => shiftDays(nthWeekday(y, 11, 4, 4), 1) },
  { key: "christmas_eve", label: "Christmas Eve", group: "Observance", defaultOn: true, date: fixed(12, 24) },
  { key: "christmas", label: "Christmas Day", group: "Federal", defaultOn: true, date: fixed(12, 25) },
  { key: "nye", label: "New Year's Eve", group: "Observance", defaultOn: true, date: fixed(12, 31) },

  // Suggested extras that fit the set — off by default, toggle on if wanted.
  { key: "cinco_de_mayo", label: "Cinco de Mayo", group: "Observance", defaultOn: false, date: fixed(5, 5) },
  { key: "ash_wednesday", label: "Ash Wednesday", group: "Religious", defaultOn: false, date: (y) => shiftDays(easterSunday(y), -46) },
  { key: "palm_sunday", label: "Palm Sunday", group: "Religious", defaultOn: false, date: (y) => shiftDays(easterSunday(y), -7) },
  { key: "lbj_day", label: "LBJ Day", group: "Texas", defaultOn: false, date: fixed(8, 27) },
  { key: "cesar_chavez", label: "Cesar Chavez Day", group: "Texas", defaultOn: false, date: fixed(3, 31) },
  { key: "patriot_day", label: "Patriot Day (9/11)", group: "Observance", defaultOn: false, date: fixed(9, 11) },
  { key: "tax_day", label: "Tax Day", group: "Observance", defaultOn: false, date: fixed(4, 15) },
  { key: "grandparents_day", label: "Grandparents Day", group: "Observance", defaultOn: false, date: (y) => shiftDays(nthWeekday(y, 9, 1, 1), 6) },
];

function isoOf(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function defaultEnabledKeys(): string[] {
  return HOLIDAYS.filter((h) => h.defaultOn).map((h) => h.key);
}

export async function getEnabledHolidayKeys(): Promise<Set<string>> {
  const raw = await getSetting(HOLIDAY_SETTING);
  if (raw == null) return new Set(defaultEnabledKeys());
  try {
    const arr: unknown = JSON.parse(raw);
    if (Array.isArray(arr)) {
      return new Set(arr.filter((k): k is string => typeof k === "string"));
    }
  } catch {
    // fall through to defaults on a bad value
  }
  return new Set(defaultEnabledKeys());
}

export async function setEnabledHolidayKeys(keys: string[]): Promise<void> {
  const valid = new Set(HOLIDAYS.map((h) => h.key));
  const clean = [...new Set(keys)].filter((k) => valid.has(k));
  await setSetting(HOLIDAY_SETTING, JSON.stringify(clean));
}

/** All holidays with their on/off state and next upcoming date, for the admin
 *  toggle list. */
export type HolidayRow = {
  key: string;
  label: string;
  group: HolidayGroup;
  enabled: boolean;
  nextISO: string;
};

export async function loadHolidayList(): Promise<HolidayRow[]> {
  const enabled = await getEnabledHolidayKeys();
  const now = new Date();
  const todayUtc = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  const y = now.getUTCFullYear();
  return HOLIDAYS.map((h) => {
    let d = h.date(y);
    if (d.getTime() < todayUtc) d = h.date(y + 1);
    return {
      key: h.key,
      label: h.label,
      group: h.group,
      enabled: enabled.has(h.key),
      nextISO: isoOf(d),
    };
  });
}

/** The synthesized calendar entries for enabled holidays over a set of days. */
export async function holidayEntries(
  days: string[],
): Promise<{ key: string; label: string; iso: string }[]> {
  const enabled = await getEnabledHolidayKeys();
  if (enabled.size === 0) return [];
  const inRange = new Set(days);
  const years = new Set(days.map((d) => Number(d.slice(0, 4))));
  const out: { key: string; label: string; iso: string }[] = [];
  for (const h of HOLIDAYS) {
    if (!enabled.has(h.key)) continue;
    for (const y of years) {
      const iso = isoOf(h.date(y));
      if (inRange.has(iso)) out.push({ key: h.key, label: h.label, iso });
    }
  }
  return out;
}
