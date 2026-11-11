import { describe, expect, it } from "vitest";
import { occursOn, recurLabel } from "@/lib/tasks/recur-rule";

const r = (freq: string, interval: number, startISO: string, byday: string | null = null) => ({ freq, interval, byday, startISO });

describe("task repeats", () => {
  it("every 90 days from the first due date (no cap at 52)", () => {
    const x = r("DAILY", 90, "2026-01-30");
    expect(occursOn(x, "2026-01-30")).toBe(true);
    expect(occursOn(x, "2026-04-30")).toBe(true);
    expect(occursOn(x, "2026-03-23")).toBe(false);
    expect(occursOn(x, "2026-01-29")).toBe(false);
    expect(recurLabel(x)).toBe("Every 90 days");
  });
  it("weekly with no weekdays lands on the first due date's weekday", () => {
    const x = r("WEEKLY", 1, "2026-11-11");
    expect(occursOn(x, "2026-11-18")).toBe(true);
    expect(occursOn(x, "2026-11-19")).toBe(false);
    expect(recurLabel(x)).toBe("Weekly on Wed");
    expect(recurLabel(r("WEEKLY", 2, "2026-11-11", "MO,TH"))).toBe("Every 2 weeks on Mon, Thu");
  });
  it("monthly on the 31st lands on the last day of shorter months", () => {
    const x = r("MONTHLY", 1, "2026-01-31");
    expect(occursOn(x, "2026-02-28")).toBe(true);
    expect(occursOn(x, "2026-04-30")).toBe(true);
    expect(occursOn(x, "2026-03-31")).toBe(true);
    expect(occursOn(x, "2026-03-30")).toBe(false);
    expect(recurLabel(r("MONTHLY", 1, "2026-01-30"))).toBe("Monthly on the 30th");
    expect(recurLabel(r("MONTHLY", 3, "2026-01-01"))).toBe("Every 3 months on the 1st");
  });
  it("yearly, and Feb 29 on Feb 28 in other years", () => {
    expect(occursOn(r("YEARLY", 1, "2026-01-30"), "2027-01-30")).toBe(true);
    expect(occursOn(r("YEARLY", 2, "2026-01-30"), "2027-01-30")).toBe(false);
    expect(occursOn(r("YEARLY", 2, "2026-01-30"), "2028-01-30")).toBe(true);
    const leap = r("YEARLY", 1, "2028-02-29");
    expect(occursOn(leap, "2029-02-28")).toBe(true);
    expect(occursOn(leap, "2032-02-29")).toBe(true);
    expect(occursOn(leap, "2032-02-28")).toBe(false);
    expect(recurLabel(r("YEARLY", 1, "2026-01-30"))).toBe("Yearly on Jan 30");
  });
});
