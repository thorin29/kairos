import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/places/history", () => ({ loadDay: vi.fn() }));

import { pickPlace } from "@/lib/places/visits";

// About 111 m per 0.001° of latitude.
const at = (dLatM: number) => ({ lat: 33 + dLatM / 111_000, lng: -97 });
const place = (id: string, dLatM: number, radiusM: number) => ({ id, ...at(dLatM), radiusM, userId: null });

describe("pickPlace (v0.795)", () => {
  it("takes the place whose circle covers the stop", () => {
    expect(pickPlace([place("a", 0, 120)], at(40))).toEqual({ placeNameId: "a", altPlaceNameId: null });
  });
  it("leaves a stop outside every circle unmatched", () => {
    expect(pickPlace([place("a", 0, 60)], at(90))).toEqual({ placeNameId: null, altPlaceNameId: null });
  });
  it("picks the nearer of two when they're clearly apart", () => {
    expect(pickPlace([place("a", 0, 120), place("b", 80, 120)], at(5))).toEqual({ placeNameId: "a", altPlaceNameId: null });
  });
  it("asks which one when two are nearly as close", () => {
    expect(pickPlace([place("a", 0, 60), place("b", 30, 60)], at(14))).toEqual({ placeNameId: "a", altPlaceNameId: "b" });
  });
});
