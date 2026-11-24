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

import { runOf, tripTotals } from "@/lib/workouts/backpacking-days";
import { encodePolyline, gainLoss } from "@/lib/places/elevation-calc";
import { decodePolyline } from "@/lib/places/route-check";
import { preferPhone, type DayPoint } from "@/lib/places/day";

describe("trip summary pieces", () => {
  it("finds the run a day is in", () => {
    expect(runOf(["2026-12-04", "2026-12-05", "2026-12-09"], "2026-12-05")).toEqual(["2026-12-04", "2026-12-05"]);
  });

  it("totals miles, minutes and feet", () => {
    const t = tripTotals([
      { distanceM: 16_093.44, seconds: 18_000, gainM: 300, lossM: 100 },
      { distanceM: 8_046.72, seconds: 9_000, gainM: null, lossM: null },
    ]);
    expect(t).toEqual({ miles: 15, minutes: 450, gainFt: 984, lossFt: 328 });
  });

  it("counts climbs and drops, not wobble", () => {
    expect(gainLoss([100, 101, 99, 100, 110, 120, 118, 105])).toEqual({ gainM: 20, lossM: 15 });
  });

  it("encodes a polyline Google can read back", () => {
    const pts: [number, number][] = [[38.5, -120.2], [40.7, -120.95], [43.252, -126.453]];
    expect(encodePolyline(pts)).toBe("_p~iF~ps|U_ulLnnqC_mqNvxq`@");
    expect(decodePolyline(encodePolyline(pts))).toEqual(pts);
  });
});

describe("preferPhone", () => {
  const pt = (min: number, source: string | null): DayPoint => ({
    at: new Date(Date.UTC(2026, 11, 4, 15, min)),
    lat: 10,
    lng: 20,
    accuracyM: 10,
    speed: null,
    source,
  });

  it("drops Home Assistant points near the phone's own", () => {
    const out = preferPhone([pt(0, null), pt(10, "phone"), pt(12, null), pt(20, "phone"), pt(40, null)]);
    expect(out.map((p) => p.source ?? "ha")).toEqual(["ha", "phone", "phone", "ha"]);
  });
});

import { elevationNote, isElevationNote } from "@/lib/places/elevation-calc";

describe("elevationNote", () => {
  it("reads in feet and is recognised", () => {
    const n = elevationNote(378, 360);
    expect(n).toBe("↑ 1,240 ft ↓ 1,181 ft");
    expect(isElevationNote(n)).toBe(true);
    expect(isElevationNote("felt good")).toBe(false);
  });
});
