import "server-only";
import { prisma } from "@/lib/prisma";
import {
  CAL_VIEWS,
  type CalView,
  type OthersMode,
} from "@/lib/calendar/views";

export {
  CAL_VIEWS,
  CAL_VIEW_LABELS,
  type CalView,
  type OthersMode,
} from "@/lib/calendar/views";

/**
 * Per-user personal-calendar preferences. Loaded for the signed-in personal
 * view (and later the app); the shared tablet never touches this. Phase A uses
 * the structure fields; the colour fields are carried through for Phase B.
 *
 * `shownPeople` / `shownSubs` are null when the user has never customised them,
 * which the caller resolves to a default (just self; the user's own feeds) —
 * distinct from an explicit empty list (show nobody / no feeds).
 */

export type CalendarPrefs = {
  view: CalView;
  showFamily: boolean;
  showSchoolWork: boolean;
  shownPeople: string[] | null;
  shownSubs: string[] | null;
  // Phase B (unused until then, but loaded so the shape is stable)
  personalizeColors: boolean;
  othersMode: OthersMode;
  othersColor: string | null;
  nowColor: string | null;
  holidayColor: string | null;
  familyColor: string | null;
  kindColors: Record<string, string>;
  eventTypeColors: Record<string, string>;
  subColors: Record<string, string>;
};

function asStringArray(v: unknown): string[] | null {
  if (!Array.isArray(v)) return null;
  return v.filter((x): x is string => typeof x === "string");
}

function asColorMap(v: unknown): Record<string, string> {
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  const out: Record<string, string> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    if (typeof val === "string") out[k] = val;
  }
  return out;
}

function asView(v: unknown): CalView {
  return CAL_VIEWS.includes(v as CalView) ? (v as CalView) : "week";
}

function asOthersMode(v: unknown): OthersMode {
  return v === "grey" || v === "family" ? v : "own";
}

const DEFAULTS: CalendarPrefs = {
  view: "week",
  showFamily: false,
  showSchoolWork: true,
  shownPeople: null,
  shownSubs: null,
  personalizeColors: false,
  othersMode: "own",
  othersColor: null,
  nowColor: null,
  holidayColor: null,
  familyColor: null,
  kindColors: {},
  eventTypeColors: {},
  subColors: {},
};

export async function loadCalendarPrefs(
  userId: string,
): Promise<CalendarPrefs> {
  const row = await prisma.userCalendarPref.findUnique({ where: { userId } });
  if (!row) return { ...DEFAULTS };
  return {
    view: asView(row.view),
    showFamily: row.showFamily,
    showSchoolWork: row.showSchoolWork,
    shownPeople: asStringArray(row.shownPeople),
    shownSubs: asStringArray(row.shownSubs),
    personalizeColors: row.personalizeColors,
    othersMode: asOthersMode(row.othersMode),
    othersColor: row.othersColor,
    nowColor: row.nowColor,
    holidayColor: row.holidayColor,
    familyColor: row.familyColor,
    kindColors: asColorMap(row.kindColors),
    eventTypeColors: asColorMap(row.eventTypeColors),
    subColors: asColorMap(row.subColors),
  };
}

/** Upsert one or more preference fields for a user, creating the row if needed
 *  with the documented defaults for everything else. */
async function patchPrefs(
  userId: string,
  data: Record<string, unknown>,
): Promise<void> {
  await prisma.userCalendarPref.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
  });
}

export async function setView(userId: string, view: CalView): Promise<void> {
  await patchPrefs(userId, { view });
}

export async function setShowFamily(
  userId: string,
  on: boolean,
): Promise<void> {
  await patchPrefs(userId, { showFamily: on });
}

export async function setShowSchoolWork(
  userId: string,
  on: boolean,
): Promise<void> {
  await patchPrefs(userId, { showSchoolWork: on });
}

export async function setShownPeople(
  userId: string,
  ids: string[],
): Promise<void> {
  await patchPrefs(userId, { shownPeople: ids });
}

export async function setShownSubs(
  userId: string,
  ids: string[],
): Promise<void> {
  await patchPrefs(userId, { shownSubs: ids });
}

// --- Phase B: colours ---

export async function setPersonalize(
  userId: string,
  on: boolean,
): Promise<void> {
  await patchPrefs(userId, { personalizeColors: on });
}

export async function setOthersMode(
  userId: string,
  mode: OthersMode,
): Promise<void> {
  await patchPrefs(userId, { othersMode: mode });
}

export async function setOthersColor(
  userId: string,
  color: string | null,
): Promise<void> {
  await patchPrefs(userId, { othersColor: color });
}

export async function setNowColor(
  userId: string,
  color: string | null,
): Promise<void> {
  await patchPrefs(userId, { nowColor: color });
}

export async function setHolidayColor(
  userId: string,
  color: string | null,
): Promise<void> {
  await patchPrefs(userId, { holidayColor: color });
}

/** Merge one key into a Json colour map (or clear it when color is null). */
async function patchColorMap(
  userId: string,
  field: "kindColors" | "eventTypeColors" | "subColors",
  key: string,
  color: string | null,
): Promise<void> {
  const prefs = await loadCalendarPrefs(userId);
  const map = { ...prefs[field] };
  if (color) map[key] = color;
  else delete map[key];
  await patchPrefs(userId, { [field]: map });
}

export async function setKindColor(
  userId: string,
  kind: string,
  color: string | null,
): Promise<void> {
  await patchColorMap(userId, "kindColors", kind, color);
}

export async function setEventTypeColor(
  userId: string,
  eventTypeId: string,
  color: string | null,
): Promise<void> {
  await patchColorMap(userId, "eventTypeColors", eventTypeId, color);
}

export async function setSubColor(
  userId: string,
  subId: string,
  color: string | null,
): Promise<void> {
  await patchColorMap(userId, "subColors", subId, color);
}

/** Patch any of the colour fields at once (validated by the caller). Maps are
 *  replaced wholesale — the app sends the full map for the field it changed. */
export async function setColorPrefs(
  userId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  if (Object.keys(patch).length === 0) return;
  await patchPrefs(userId, patch);
}
