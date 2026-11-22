import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
import { parseTime, timeLabel } from "@/lib/workouts/workout-time";

describe("workout time", () => {
  it("reads HH:MM and minutes", () => {
    expect(parseTime("12:00")).toBe(720);
    expect(parseTime("6:30")).toBe(390);
    expect(parseTime(720)).toBe(720);
    expect(parseTime("720")).toBe(720);
  });
  it("refuses what isn't a time", () => {
    expect(parseTime("25:00")).toBeNull();
    expect(parseTime("noon")).toBeNull();
    expect(parseTime(1440)).toBeNull();
    expect(parseTime(null)).toBeNull();
  });
  it("labels", () => {
    expect(timeLabel(0)).toBe("12:00 AM");
    expect(timeLabel(720)).toBe("12:00 PM");
    expect(timeLabel(1050)).toBe("5:30 PM");
  });
});
