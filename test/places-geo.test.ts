import { describe, expect, it } from "vitest";
import { boxAround, metres, presenceOf, shortAddress, type TimedPt } from "@/lib/places/geo";
import { contentSecurityPolicy, isMapPath } from "@/lib/csp";

// Invented coordinates — nothing here is a real household location.
const A = { lat: 10, lng: 20 };
const at = (min: number) => new Date(Date.UTC(2026, 10, 23, 12, 0) + min * 60_000);
const pt = (lat: number, lng: number, min: number, speed: number | null = 0): TimedPt => ({
  lat,
  lng,
  at: at(min),
  accuracyM: 10,
  speed,
});
// ~0.0009° latitude ≈ 100 m.
const north = (m: number) => A.lat + m / 111_195;

describe("metres and boxAround", () => {
  it("measures short distances", () => {
    expect(Math.round(metres(A, { lat: north(100), lng: A.lng }))).toBe(100);
    expect(metres(A, A)).toBe(0);
  });
  it("boxes everything within the radius", () => {
    const b = boxAround(A, 60);
    expect(north(59)).toBeLessThan(b.maxLat);
    expect(north(-59)).toBeGreaterThan(b.minLat);
    expect(b.maxLng).toBeGreaterThan(A.lng);
  });
});

describe("presenceOf", () => {
  it("is null with no points", () => {
    expect(presenceOf([])).toBeNull();
  });
  it("finds since-when for someone staying put (newest first)", () => {
    const p = presenceOf([pt(north(10), 20, 60), pt(north(30), 20, 40), pt(A.lat, 20, 20), pt(north(900), 20, 0)]);
    expect(p?.moving).toBe(false);
    expect(p?.since?.toISOString()).toBe(at(20).toISOString());
  });
  it("calls two far-apart reports close in time moving", () => {
    const p = presenceOf([pt(north(800), 20, 5), pt(A.lat, 20, 0)]);
    expect(p?.moving).toBe(true);
    expect(p?.since).toBeNull();
  });
  it("treats a long gap between far-apart reports as arrived, not moving", () => {
    const p = presenceOf([pt(north(5000), 20, 120), pt(A.lat, 20, 0)]);
    expect(p?.moving).toBe(false);
    expect(p?.since?.toISOString()).toBe(at(120).toISOString());
  });
  it("trusts the phone's speed", () => {
    expect(presenceOf([pt(A.lat, 20, 0, 12)])?.moving).toBe(true);
    expect(presenceOf([pt(A.lat, 20, 0, null)])?.moving).toBe(false);
  });
});

describe("shortAddress", () => {
  it("keeps street and town", () => {
    expect(shortAddress("123 Main St, Springfield, TX 75000, USA")).toBe("123 Main St, Springfield");
    expect(shortAddress("Somewhere")).toBe("Somewhere");
    expect(shortAddress(null)).toBeNull();
  });
});

describe("map CSP", () => {
  it("widens the policy only for map pages", () => {
    const strict = contentSecurityPolicy("n", false, false);
    const maps = contentSecurityPolicy("n", false, true);
    expect(strict).not.toContain("googleapis");
    expect(strict).not.toContain("'unsafe-eval'");
    expect(maps).toContain("https://*.googleapis.com");
    expect(maps).toContain("worker-src 'self' blob:");
    expect(maps).toContain("https://fonts.gstatic.com");
    expect(maps).toContain("'nonce-n'");
    expect(isMapPath("/places")).toBe(true);
    expect(isMapPath("/places/embed")).toBe(true);
    expect(isMapPath("/placesx")).toBe(false);
    expect(isMapPath("/")).toBe(false);
  });
});
