import { describe, expect, it } from "vitest";
import { dayOfTrip, tripDays, type TripEvent } from "@/lib/workouts/backpacking-days";

const allDay = (from: string, toExclusive: string, extra: Partial<TripEvent> = {}): TripEvent => ({
  userId: "alex",
  participants: [],
  startsAt: new Date(`${from}T00:00:00Z`),
  endsAt: new Date(`${toExclusive}T00:00:00Z`),
  allDay: true,
  rrule: null,
  ...extra,
});

describe("tripDays", () => {
  it("covers every day of one event over several days (all-day end is exclusive)", () => {
    expect(tripDays([allDay("2026-12-04", "2026-12-07")], "alex", "2026-12-01", "2026-12-31")).toEqual([
      "2026-12-04",
      "2026-12-05",
      "2026-12-06",
    ]);
  });

  it("covers a repeating event's back-to-back days", () => {
    const e = allDay("2026-12-04", "2026-12-05", { rrule: "FREQ=DAILY;COUNT=3" });
    expect(tripDays([e], "alex", "2026-12-01", "2026-12-31")).toEqual(["2026-12-04", "2026-12-05", "2026-12-06"]);
  });

  it("counts a timed event running into another day", () => {
    const e: TripEvent = {
      userId: "alex",
      participants: [],
      startsAt: new Date("2026-12-04T14:00:00Z"),
      endsAt: new Date("2026-12-06T20:00:00Z"),
      allDay: false,
      rrule: null,
    };
    expect(tripDays([e], "alex", "2026-12-01", "2026-12-31")).toEqual(["2026-12-04", "2026-12-05", "2026-12-06"]);
  });

  it("is only for the event's owner and people", () => {
    const e = allDay("2026-12-04", "2026-12-06", { userId: "sam", participants: ["alex"] });
    expect(tripDays([e], "alex", "2026-12-01", "2026-12-31")).toHaveLength(2);
    expect(tripDays([e], "kim", "2026-12-01", "2026-12-31")).toHaveLength(0);
  });
});

describe("dayOfTrip", () => {
  it("says which day of the run it is", () => {
    const days = ["2026-12-04", "2026-12-05", "2026-12-06"];
    expect(dayOfTrip(days, "2026-12-05")).toEqual({ day: 2, of: 3 });
    expect(dayOfTrip(days, "2026-12-08")).toBeNull();
  });
});
