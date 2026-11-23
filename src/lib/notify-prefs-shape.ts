/**
 * The shape of a person's notification choices (v0.772), shared by the server
 * and its tests. Everything is checked on the way in; unknown fields drop.
 */

export type PlaceRule = {
  id: string;
  /** Whose comings and goings; null = anyone (never the person themselves). */
  about: string | null;
  /** "z:<zone>" | "n:<named place id>" | "s:<saved address id>". */
  place: string;
  arrive: boolean;
  leave: boolean;
};

export type NotifyPrefsData = {
  /** A reminder only ever comes when the event's reminders name this person;
   *  these say which of those to let through. */
  calendar: {
    /** Events that are mine. */
    mine: boolean;
    /** Family events. */
    family: boolean;
    /** Someone else's events I'm on. */
    others: boolean;
  };
  tasks: boolean;
  /** "<name> gave you a task". */
  assigned: boolean;
  /** Parents: money and suggested family workouts waiting for an OK. */
  approvals: boolean;
  /** A family workout you're in. */
  familyWorkout: boolean;
  /** Morning: shared chores where it's most your turn. */
  choreTurn: boolean;
  places: PlaceRule[];
  /** Parents: alerts about the children. */
  safety: {
    /** Child id → mph; one alert per drive when first over. */
    speed: Record<string, number>;
    /** Hours with no update from a child's phone; null = off. */
    noUpdateHours: number | null;
    /** Battery % a child's phone drops below; null = off. */
    lowBattery: number | null;
  };
  /** "HH:MM" in the household's time; held Family map news waits until `to`. */
  quiet: { from: string; to: string } | null;
};

export function emptyPrefs(): NotifyPrefsData {
  return {
    calendar: { mine: false, family: false, others: false },
    tasks: false,
    assigned: false,
    approvals: false,
    familyWorkout: false,
    choreTurn: false,
    places: [],
    safety: { speed: {}, noUpdateHours: null, lowBattery: null },
    quiet: null,
  };
}

const ID = /^[A-Za-z0-9_-]{1,40}$/;
const PLACE = /^(z:[^\n]{1,60}|n:[A-Za-z0-9_-]{1,40}|s:[A-Za-z0-9_-]{1,40})$/;
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const bool = (v: unknown, d = false) => (typeof v === "boolean" ? v : d);
const intIn = (v: unknown, min: number, max: number): number | null =>
  typeof v === "number" && Number.isFinite(v) && v >= min && v <= max ? Math.round(v) : null;

export function sanitizePrefs(raw: unknown): NotifyPrefsData {
  const r = obj(raw);
  const cal = obj(r.calendar);
  const safety = obj(r.safety);
  const speed: Record<string, number> = {};
  for (const [k, v] of Object.entries(obj(safety.speed))) {
    const mph = intIn(v, 10, 150);
    if (ID.test(k) && mph != null) speed[k] = mph;
  }
  const places: PlaceRule[] = [];
  for (const p of Array.isArray(r.places) ? r.places.slice(0, 50) : []) {
    const o = obj(p);
    const about = o.about == null ? null : typeof o.about === "string" && ID.test(o.about) ? o.about : undefined;
    const place = typeof o.place === "string" && PLACE.test(o.place) ? o.place : null;
    const arrive = bool(o.arrive);
    const leave = bool(o.leave);
    if (about === undefined || !place || (!arrive && !leave)) continue;
    const id = typeof o.id === "string" && ID.test(o.id) ? o.id : `r${places.length}${Date.now().toString(36)}`;
    places.push({ id, about, place, arrive, leave });
  }
  const q = obj(r.quiet);
  const quiet =
    typeof q.from === "string" && typeof q.to === "string" && HHMM.test(q.from) && HHMM.test(q.to) && q.from !== q.to
      ? { from: q.from, to: q.to }
      : null;
  return {
    // Saved before family had its own switch (v0.771): it went with others.
    calendar: { mine: bool(cal.mine), family: bool(cal.family, bool(cal.others)), others: bool(cal.others) },
    tasks: bool(r.tasks),
    assigned: bool(r.assigned),
    approvals: bool(r.approvals),
    familyWorkout: bool(r.familyWorkout),
    choreTurn: bool(r.choreTurn),
    places,
    safety: {
      speed,
      noUpdateHours: intIn(safety.noUpdateHours, 1, 72),
      lowBattery: intIn(safety.lowBattery, 5, 50),
    },
    quiet,
  };
}
