import type { GridEvent } from "@/lib/queries/calendar";
import type { OthersMode } from "@/lib/calendar/views";

/**
 * How a signed-in person's colour preferences repaint the events on their own
 * calendar. Pure and system-import-free so it can run wherever. The shared
 * tablet never calls this — it keeps the household scheme.
 *
 * `personalizeColors` is the master switch: off means the calendar looks exactly
 * like the system default (owner/family/event-type colours), so this returns
 * every event untouched. On, the rules below apply. See DECISIONS.md
 * ("Personal calendar…") for the agreed precedence.
 */
export type ColorPrefs = {
  personalizeColors: boolean;
  othersMode: OthersMode;
  othersColor: string | null;
  holidayColor: string | null;
  familyColor: string | null;
  kindColors: Record<string, string>;
  eventTypeColors: Record<string, string>;
  subColors: Record<string, string>;
};

const GREY = "#9ca3af";
const KIND_KEYS = new Set(["APPOINTMENT", "CLASS", "WORK", "BIRTHDAY"]);

function paint(e: GridEvent, color: string): GridEvent {
  // A chosen colour is solid: drop the participant blend so it renders flat.
  return { ...e, color, memberColors: [] };
}

export function recolorForPersonal(
  e: GridEvent,
  p: ColorPrefs,
  meId: string,
): GridEvent {
  // Master switch off, or full family-scheme parity → leave the system colours.
  if (!p.personalizeColors || p.othersMode === "family") return e;

  // Holidays and birthdays are shared occasions: colour them uniformly across
  // the whole view, regardless of whose they are.
  if (e.kind === "HOLIDAY") {
    return p.holidayColor ? paint(e, p.holidayColor) : e;
  }
  if (e.kind === "BIRTHDAY") {
    return p.kindColors.BIRTHDAY ? paint(e, p.kindColors.BIRTHDAY) : e;
  }

  // Subscribed feeds → my per-feed colour.
  if (e.external) {
    const c = e.externalCalendarId ? p.subColors[e.externalCalendarId] : undefined;
    return c ? paint(e, c) : e;
  }

  // Family / shared household events keep the household (family) colour, unless
  // the person has picked their own family colour.
  if (e.isFamily || e.ownerId == null) {
    return p.familyColor ? paint(e, p.familyColor) : e;
  }

  // Someone else's personal event → their own colour, or one grey.
  if (e.ownerId !== meId) {
    return p.othersMode === "grey" ? paint(e, p.othersColor ?? GREY) : e;
  }

  // My own event → my custom-type colour, else my colour for its kind. School
  // work follows the Class colour.
  if (e.eventTypeId && p.eventTypeColors[e.eventTypeId]) {
    return paint(e, p.eventTypeColors[e.eventTypeId]);
  }
  const k = e.schoolType ? "CLASS" : e.kind;
  if (KIND_KEYS.has(k) && p.kindColors[k]) return paint(e, p.kindColors[k]);
  return e;
}
