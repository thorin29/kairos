import { localParts } from "@/lib/dates";

/**
 * How long each occurrence of a REPEATING event may be — one rule for the web
 * form, the phone, and every save path.
 *
 * A repeating event has two "ends": when each occurrence finishes (the Ends
 * beside Starts) and when the series stops (Repeats → Ends). They were easy to
 * confuse: setting the first to the day the series should stop turned a yearly
 * birthday into one occurrence years long, overlapping every one after it. The
 * series end is the one that decides how long it goes on, so:
 *
 *   - an all-day repeating event is always one day per occurrence;
 *   - a timed one may run into the next morning (a night shift) but never past
 *     24 hours — anything longer is the series end typed in the wrong place.
 *
 * Pure: takes and returns instants; all-day ends are exclusive.
 */
export function fitRepeatingSpan(
  startsAt: Date,
  endsAt: Date,
  allDay: boolean,
): { endsAt: Date } | { error: string } {
  const DAY = 86_400_000;
  if (allDay) return { endsAt: new Date(startsAt.getTime() + DAY) };
  if (endsAt.getTime() - startsAt.getTime() > DAY) {
    return {
      error:
        "A repeating event can't last more than a day each time. To stop the series on a date, use Ends under Repeats.",
    };
  }
  return { endsAt };
}

/**
 * How long each occurrence of a STORED repeating event lasts, in ms — the read
 * side of the rule above, for rows saved before it existed.
 *
 * Before v0.590 nothing stopped a series' "Ends" being set days after its
 * start (a 4 PM shift ending "12:00 AM" got the next free date, or the day the
 * job ended), so every occurrence was drawn across several days and overlapped
 * the next: one event that read as a row of duplicates. Rather than trust that
 * span, keep what was meant: all-day → one day; timed → start to the end's
 * clock time, the same day or the next morning. A sane span (≤ 24 h) is kept
 * exactly. Used everywhere an occurrence's end is derived, and by the repair
 * that rewrites such rows (`repairEventRows`).
 */
export function occurrenceSpanMs(
  startsAt: Date,
  endsAt: Date,
  allDay: boolean,
  tz: string,
): number {
  const DAY = 86_400_000;
  if (allDay) return DAY;
  const span = endsAt.getTime() - startsAt.getTime();
  if (span > 0 && span <= DAY) return span;
  const s = localParts(startsAt, tz).minutes;
  const e = localParts(endsAt, tz).minutes;
  const mins = e > s ? e - s : e + 1440 - s;
  return mins * 60_000;
}
