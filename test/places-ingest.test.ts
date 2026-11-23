import { describe, expect, it } from "vitest";
import { cleanEntityId, num, parsePoint, pointsFromBody, MAX_POINTS } from "@/lib/places/ingest-parse";
import { dayStart, dayEnd } from "@/lib/places/day-bounds";

const NOW = new Date("2026-11-22T18:00:00Z");

// Invented coordinates — nothing here is a real household location.
const base = {
  entity_id: "device_tracker.phone_a",
  latitude: 10.5,
  longitude: -20.25,
  gps_accuracy: 12,
  speed: 3.4,
  course: 90,
  altitude: 200,
  battery: 64,
  last_updated: "2026-11-22T17:59:30.123456+00:00",
};

describe("cleanEntityId", () => {
  it("accepts and lowercases HA entity ids", () => {
    expect(cleanEntityId(" Device_Tracker.Phone_A ")).toBe("device_tracker.phone_a");
    expect(cleanEntityId("person.alex")).toBe("person.alex");
  });
  it("rejects anything else", () => {
    expect(cleanEntityId("phone_a")).toBeNull();
    expect(cleanEntityId("device_tracker.phone-a")).toBeNull();
    expect(cleanEntityId(42)).toBeNull();
  });
});

describe("num", () => {
  it("reads numbers and numeric strings", () => {
    expect(num(3.5)).toBe(3.5);
    expect(num("12")).toBe(12);
    expect(num("-1.5")).toBe(-1.5);
  });
  it("treats HA placeholders as missing", () => {
    expect(num("None")).toBeNull();
    expect(num("unknown")).toBeNull();
    expect(num("")).toBeNull();
    expect(num(null)).toBeNull();
    expect(num(Number.NaN)).toBeNull();
  });
});

describe("parsePoint", () => {
  it("keeps every field as sent", () => {
    const r = parsePoint(base, NOW);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.point).toMatchObject({
      entityId: "device_tracker.phone_a",
      lat: 10.5,
      lng: -20.25,
      accuracyM: 12,
      speed: 3.4,
      courseDeg: 90,
      altitudeM: 200,
      battery: 64,
    });
    expect(r.point.at.toISOString()).toBe("2026-11-22T17:59:30.123Z");
  });

  it("accepts string values from HA templates", () => {
    const r = parsePoint({ ...base, latitude: "10.5", longitude: "-20.25", battery: "None", speed: "None" }, NOW);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.point.lat).toBe(10.5);
    expect(r.point.battery).toBeNull();
    expect(r.point.speed).toBeNull();
  });

  it("refuses a point with no fix or a bad position", () => {
    expect(parsePoint({ ...base, latitude: 0, longitude: 0 }, NOW).ok).toBe(false);
    expect(parsePoint({ ...base, latitude: 95 }, NOW).ok).toBe(false);
    expect(parsePoint({ ...base, longitude: undefined }, NOW).ok).toBe(false);
    expect(parsePoint({ ...base, entity_id: "nope" }, NOW).ok).toBe(false);
    expect(parsePoint("x", NOW).ok).toBe(false);
  });

  it("falls back to now for a missing or future time", () => {
    const missing = parsePoint({ ...base, last_updated: undefined }, NOW);
    const future = parsePoint({ ...base, last_updated: "2026-11-22T19:00:00Z" }, NOW);
    expect(missing.ok && missing.point.at.getTime()).toBe(NOW.getTime());
    expect(future.ok && future.point.at.getTime()).toBe(NOW.getTime());
  });

  it("drops out-of-range extras but keeps the point", () => {
    const r = parsePoint({ ...base, battery: 140, course: 400, gps_accuracy: -1, speed: -1 }, NOW);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.point.battery).toBeNull();
    expect(r.point.courseDeg).toBeNull();
    expect(r.point.accuracyM).toBeNull();
    expect(r.point.speed).toBeNull();
  });
});

describe("pointsFromBody", () => {
  it("takes one point or a list, capped", () => {
    expect(pointsFromBody(base)).toHaveLength(1);
    expect(pointsFromBody({ points: [base, base] })).toHaveLength(2);
    expect(pointsFromBody({ points: Array(MAX_POINTS + 10).fill(base) })).toHaveLength(MAX_POINTS);
    expect(pointsFromBody(null)).toHaveLength(0);
  });
});

describe("day bounds", () => {
  it("finds local midnight", () => {
    expect(dayStart("2026-11-22", "America/Chicago").toISOString()).toBe("2026-11-22T06:00:00.000Z");
    expect(dayStart("2026-07-04", "America/Chicago").toISOString()).toBe("2026-07-04T05:00:00.000Z");
    expect(dayStart("2026-11-22", "UTC").toISOString()).toBe("2026-11-22T00:00:00.000Z");
  });
  it("handles DST days (23 and 25 hours)", () => {
    const spring = dayEnd("2026-03-08", "America/Chicago").getTime() - dayStart("2026-03-08", "America/Chicago").getTime();
    const fall = dayEnd("2026-11-01", "America/Chicago").getTime() - dayStart("2026-11-01", "America/Chicago").getTime();
    expect(spring / 3_600_000).toBe(23);
    expect(fall / 3_600_000).toBe(25);
  });
});
