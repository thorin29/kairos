// Curriculum plan builder: turn a class's units into a dated schedule.
//
// Two pure steps, both verified against Micah's Teaching Textbooks Pre-Algebra
// (139 lessons + 17 tests -> 156 items; from Lesson 9 at 1/weekday it fills Fall
// to ~Lesson 70 and finishes ~a month before the Spring deadline):
//   expandShorthand()  numbered-lessons shorthand -> ordered unit list
//   spreadUnits()      undone units -> one (or perDay) per school day, skipping
//                      non-weekdays, holidays/pauses, and out-of-term days.

export type PlanUnitType = "ASSIGNMENT" | "TEST" | "PROJECT";
export type PlanUnit = { label: string; type: PlanUnitType; load: number };

export type Shorthand = {
  unitCount: number;
  unitNoun?: string; // default "Lesson"
  unitSize?: number; // lessons per unit, default 1
  testsAfterLesson?: number[]; // a test lands right after each of these lessons
};

/** Expand a numbered-lessons shorthand into an ordered unit list, slotting each
 *  test in right after the unit that contains its trigger lesson. */
export function expandShorthand(o: Shorthand): PlanUnit[] {
  const noun = o.unitNoun ?? "Lesson";
  const size = Math.max(1, o.unitSize ?? 1);
  const tests = new Set(o.testsAfterLesson ?? []);
  const units: PlanUnit[] = [];
  let tnum = 0;
  for (let lo = 1; lo <= o.unitCount; lo += size) {
    const hi = Math.min(lo + size - 1, o.unitCount);
    units.push({
      label: size === 1 ? `${noun} ${lo}` : `${noun}s ${lo}\u2013${hi}`,
      type: "ASSIGNMENT",
      load: hi - lo + 1,
    });
    for (let t = lo; t <= hi; t++) {
      if (tests.has(t)) {
        tnum += 1;
        units.push({ label: `Test ${tnum}`, type: "TEST", load: 1 });
      }
    }
  }
  return units;
}

export type Term = { start: string; end: string }; // YYYY-MM-DD, inclusive
export type Scheduled = { unit: PlanUnit; date: string | null };

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return isoDate(d);
}
/** ISO weekday: 1=Mon .. 7=Sun. */
function isoWeekday(day: string): number {
  const wd = new Date(`${day}T00:00:00Z`).getUTCDay(); // 0=Sun..6=Sat
  return wd === 0 ? 7 : wd;
}

/**
 * Spread undone units across school days. Places up to `perDay` units per day,
 * only on `weekdays` (ISO 1..7), inside one of the `terms` windows, skipping
 * `holidays`. Units that run past the last term end get date=null (they don't
 * fit — the caller surfaces that as "won't finish by the deadline").
 */
export function spreadUnits(
  units: PlanUnit[],
  opts: {
    startDate: string; // first candidate day (YYYY-MM-DD)
    weekdays: number[]; // ISO 1..7
    holidays: Set<string>; // YYYY-MM-DD to skip
    terms: Term[]; // ordered, non-overlapping windows
    perDay?: number;
  },
): Scheduled[] {
  const perDay = Math.max(1, opts.perDay ?? 1);
  const wd = new Set(opts.weekdays);
  const lastEnd = opts.terms.reduce(
    (m, t) => (t.end > m ? t.end : m),
    opts.terms[0]?.end ?? opts.startDate,
  );
  const inTerm = (day: string) => opts.terms.some((t) => day >= t.start && day <= t.end);
  // Within the term, only real school days count. Once we run past the last term
  // day, work keeps landing on weekdays so a class that won't finish in time
  // shows real later dates instead of vanishing as "won't fit".
  const usable = (day: string) =>
    wd.has(isoWeekday(day)) && !opts.holidays.has(day) && (day > lastEnd || inTerm(day));

  const out: Scheduled[] = [];
  let day = opts.startDate;
  let onDay = 0;
  for (const unit of units) {
    while (!usable(day) || onDay >= perDay) {
      day = addDays(day, 1);
      onDay = 0;
    }
    out.push({ unit, date: day });
    onDay += 1;
  }
  return out;
}

/** Every school day in the term windows, in order: weekday in `weekdays`, not a
 *  holiday, inside a term, from startDate to the last term end. */
function schoolDaysIn(opts: {
  startDate: string;
  weekdays: number[];
  holidays: Set<string>;
  terms: Term[];
}): string[] {
  const wd = new Set(opts.weekdays);
  const lastEnd = opts.terms.reduce(
    (m, t) => (t.end > m ? t.end : m),
    opts.terms[0]?.end ?? opts.startDate,
  );
  const inTerm = (day: string) => opts.terms.some((t) => day >= t.start && day <= t.end);
  const days: string[] = [];
  let day = opts.startDate;
  while (day <= lastEnd) {
    if (wd.has(isoWeekday(day)) && inTerm(day) && !opts.holidays.has(day)) days.push(day);
    day = addDays(day, 1);
  }
  return days;
}

/**
 * Spread units to finish by the last term day, front-loading the extra when the
 * work won't fit at one a day. Every school day carries `base` items and the
 * first `extra` days carry one more, so a plan that would overflow instead lands
 * on the last school day with the heavier days at the start. If it already fits
 * at one a day this is just one a day (finishing early), so it's safe to leave
 * on. Ignores perDay — it computes the rate needed to fit.
 */
export function spreadUnitsFit(
  units: PlanUnit[],
  opts: { startDate: string; weekdays: number[]; holidays: Set<string>; terms: Term[] },
): Scheduled[] {
  const days = schoolDaysIn(opts);
  const D = days.length;
  const N = units.length;
  if (D === 0) return units.map((u) => ({ unit: u, date: null }));
  const base = Math.floor(N / D);
  const extra = N - base * D; // the first `extra` days carry base + 1
  const capAt = (i: number) => (i < extra ? base + 1 : base);

  const out: Scheduled[] = [];
  let di = 0;
  let onDay = 0;
  for (const unit of units) {
    while (di < D && onDay >= capAt(di)) {
      di += 1;
      onDay = 0;
    }
    if (di >= D) {
      out.push({ unit, date: null });
      continue;
    }
    out.push({ unit, date: days[di] });
    onDay += 1;
  }
  return out;
}

/** Split a spread at a term boundary: which items fall inside a given term
 *  (locked when that term is published) vs after it (still provisional). */
export function sliceByTerm(scheduled: Scheduled[], term: Term) {
  const inside = scheduled.filter((s) => s.date && s.date >= term.start && s.date <= term.end);
  const after = scheduled.filter((s) => s.date && s.date > term.end);
  return { inside, after };
}
