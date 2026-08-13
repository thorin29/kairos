/**
 * Which background image a calendar item uses. Image files live at
 * `/event-bg/<key>.jpg` — create them in `public/event-bg/` (see the README
 * there). Missing files degrade gracefully: the item just shows its colour, so
 * this is safe to ship before any art exists.
 */

/** Keys that have (or will have) an image. Used for docs/validation. */
export const EVENT_BG_KEYS = [
  "birthday",
  "christmas",
  "thanksgiving",
  "easter",
  "halloween",
  "newyear",
  "valentines",
  "independence",
  "stpatricks",
  "hockey",
  "class",
  "church",
  "appointment",
  "vacation",
  "default",
] as const;

export function bgUrl(key: string): string {
  return `/event-bg/${key}.jpg`;
}

/** A built-in kind or custom event-type name → image key, or null for none. */
export function bgKeyForKind(kind: string | null | undefined): string | null {
  if (!kind) return null;
  const k = kind.trim().toLowerCase();
  const map: Record<string, string> = {
    class: "class",
    school: "class",
    appointment: "appointment",
    appt: "appointment",
    church: "church",
    hockey: "hockey",
    vacation: "vacation",
    trip: "vacation",
    travel: "vacation",
    birthday: "birthday",
  };
  return map[k] ?? null;
}

/** A holiday key → image key. Holidays without a specific image fall back to
 *  "default". */
export function bgKeyForHoliday(holidayKey: string): string {
  const map: Record<string, string> = {
    christmas: "christmas",
    christmas_eve: "christmas",
    thanksgiving: "thanksgiving",
    day_after_thanksgiving: "thanksgiving",
    easter: "easter",
    good_friday: "easter",
    palm_sunday: "easter",
    halloween: "halloween",
    new_year: "newyear",
    nye: "newyear",
    valentines: "valentines",
    independence: "independence",
    st_patricks: "stpatricks",
  };
  return map[holidayKey] ?? "default";
}
