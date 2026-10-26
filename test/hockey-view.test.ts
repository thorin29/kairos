import { describe, expect, it } from "vitest";
import { buildHockeyView, placeForRink, countText, spotsLeft } from "@/lib/hockey-view";

// A made-up rink and feed in ice-time's format; nothing household-specific.
const link = (n: number) => `https://yourclub.finnlyconnect.com/registration/activityitemv2/${n}`;
const feed = {
  service: "ice-time",
  generatedAt: "2026-10-26T20:00:00+00:00",
  sections: [
    {
      name: "Drop-in",
      sessions: [
        {
          section: "Drop-in", rink: "Sample Arena",
          start: "2026-10-28T11:45:00", end: "2026-10-28T13:15:00", minutes: 90,
          skaters: { enrolled: 0, max: 24, remaining: 24 },
          goalies: { enrolled: 3, max: 3, remaining: 0 },
          players: null, links: { skaters: link(2), goalies: link(1) },
        },
        {
          section: "Drop-in", rink: "Sample Arena",
          start: "2026-10-27T06:00:00", end: "2026-10-27T07:45:00", minutes: 105,
          skaters: { enrolled: 1, max: 24, remaining: 23 },
          goalies: { enrolled: 0, max: 3, remaining: 3 },
          players: null, links: { skaters: link(2), goalies: link(1) },
        },
        { start: "2026-11-09T06:00:00", end: "2026-11-09T07:00:00", rink: "Sample Arena" },
        { start: "garbage", end: 5 },
      ],
    },
    {
      name: "Parent & child",
      sessions: [
        {
          rink: "Sample Arena", start: "2026-10-31T22:30:00", end: "2026-11-01T00:30:00",
          players: { enrolled: 9, max: 20, remaining: 11 },
          links: { players: "javascript:alert(1)" },
        },
      ],
    },
  ],
  sources: [
    { enabled: true, lastSuccess: "2026-10-26T19:40:00+00:00" },
    { enabled: true, lastSuccess: "2026-10-26T19:10:00+00:00" },
    { enabled: false, lastSuccess: "2026-01-01T00:00:00+00:00" },
  ],
  warnings: ["Sample Arena - Youth: No upcoming sessions on this page."],
};
const places = [{ name: "Sample Arena Ice Center", address: "1 Example Way, Anytown" }];

describe("buildHockeyView", () => {
  const v = buildHockeyView(feed, { today: "2026-10-26", places });

  it("shows seven days from today", () => {
    expect(v.days).toEqual([
      "2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29",
      "2026-10-30", "2026-10-31", "2026-11-01",
    ]);
  });

  it("sorts sessions and drops ones outside the week or malformed", () => {
    const d = v.sections[0];
    expect(d.rows.map((r) => r.date)).toEqual(["2026-10-27", "2026-10-28"]);
    expect(d.colA).toBe("Skaters");
    expect(d.colB).toBe("Goalies");
  });

  it("books goalie sessions as goalie, others as a plain add", () => {
    const r = v.sections[0].rows[0];
    expect(r.add).toEqual({
      title: "Drop-in: Sample Arena",
      label: "Add goalie session",
      location: "1 Example Way, Anytown",
    });
    expect(r.start).toBe("06:00");
    expect(r.end).toBe("07:45");
    expect(r.link).toBe(link(1));
    const p = v.sections[1];
    expect(p.colA).toBe("Signed up");
    expect(p.colB).toBeNull();
    expect(p.rows[0].add.label).toBe("Add to calendar");
  });

  it("keeps an overnight end and refuses non-https links", () => {
    const r = v.sections[1].rows[0];
    expect(r.endDayOffset).toBe(1);
    expect(r.end).toBe("00:30");
    expect(r.link).toBeNull();
  });

  it("reports freshness from the oldest enabled schedule, and warnings", () => {
    expect(v.checkedAt).toBe("2026-10-26T19:10:00+00:00");
    expect(v.warnings).toHaveLength(1);
    expect(v.rinks).toEqual(["Sample Arena"]);
  });

  it("survives a feed that isn't one", () => {
    const e = buildHockeyView("nope", { today: "2026-10-26", places });
    expect(e.sections).toEqual([]);
    expect(e.days).toHaveLength(7);
  });
});

describe("helpers", () => {
  it("matches a saved address by rink name", () => {
    expect(placeForRink("Sample Arena", [{ name: "sample arena", address: "A" }])).toBe("A");
    expect(placeForRink("Sample Arena", places)).toBe("1 Example Way, Anytown");
    expect(placeForRink("Other Rink", places)).toBeNull();
    expect(placeForRink(null, places)).toBeNull();
  });
  it("formats counts and open spots", () => {
    expect(countText({ enrolled: 2, max: 3, remaining: 1 })).toBe("2/3");
    expect(spotsLeft({ enrolled: 3, max: 3, remaining: null })).toBe(0);
  });
});
