import { describe, expect, it } from "vitest";
import { occurrenceDayFor } from "@/lib/calendar/recur";
import { occurrenceSpanMs } from "@/lib/calendar/repeat-span";

// Pure rules behind the "duplicated across days" fix (v0.597). An example zone
// with DST; nothing here reads the household's own.
const TZ = "America/New_York";
const HOUR = 3_600_000;

describe("occurrenceSpanMs", () => {
  it("keeps a sane span exactly", () => {
    const s = new Date("2026-10-05T20:00:00Z"); // 4 PM EDT
    expect(occurrenceSpanMs(s, new Date("2026-10-06T04:00:00Z"), false, TZ)).toBe(8 * HOUR);
  });
  it("cuts an old multi-day span back to start → the end's clock time", () => {
    // Mon 4 PM, "Ends" Thu 12:00 AM: each occurrence is 4 PM → midnight.
    const s = new Date("2026-10-05T20:00:00Z");
    expect(occurrenceSpanMs(s, new Date("2026-10-08T04:00:00Z"), false, TZ)).toBe(8 * HOUR);
  });
  it("an all-day occurrence is one day", () => {
    const s = new Date("2026-10-10T00:00:00Z");
    expect(occurrenceSpanMs(s, new Date("2029-10-11T00:00:00Z"), true, "UTC")).toBe(24 * HOUR);
  });
});

describe("occurrenceDayFor", () => {
  // Weekly Mon 10 PM → 2 AM.
  const start = new Date("2026-10-06T02:00:00Z"); // Mon Oct 5, 10 PM EDT
  const rule = "FREQ=WEEKLY;BYDAY=MO";
  const span = 4 * HOUR;
  it("the after-midnight piece belongs to the night before", () => {
    expect(occurrenceDayFor(start, rule, span, "2026-10-13", TZ)).toBe("2026-10-12");
  });
  it("the occurrence's own day is itself", () => {
    expect(occurrenceDayFor(start, rule, span, "2026-10-12", TZ)).toBe("2026-10-12");
  });
  it("a midnight end does not reach into the next day", () => {
    // Weekly Mon 4 PM → 12:00 AM: Tuesday is not part of it.
    const s = new Date("2026-10-05T20:00:00Z");
    expect(occurrenceDayFor(s, rule, 8 * HOUR, "2026-10-13", TZ)).toBe("2026-10-13");
  });
  it("a day with no occurrence near it is returned as given", () => {
    expect(occurrenceDayFor(start, rule, span, "2026-10-15", TZ)).toBe("2026-10-15");
  });
});
