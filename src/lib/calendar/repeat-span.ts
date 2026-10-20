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
