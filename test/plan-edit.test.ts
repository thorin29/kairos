import { describe, expect, it } from "vitest";
import { addReadings, formatPlanText, joinChapters, parsePlanText } from "@/lib/bible/plan-edit";
import { buildTracker, planKind, formatSpan, rollUp } from "@/lib/bible/tracker";
import { BOOKS } from "@/lib/bible/books";

const plan = [
  { iso: "2026-12-22", passage: "Revelation 14-15" },
  { iso: "2026-12-23", passage: "Revelation 16-17" },
  { iso: "2026-12-24", passage: "Revelation 18" },
  { iso: "2026-12-25", passage: "Revelation 19" },
];
const three = ["Luke 2:1-20", "Isaiah 9:1-7", "Psalm 96"];

describe("addReadings", () => {
  it("pushes the plan back", () => {
    const r = addReadings(plan, three, "2026-12-23", "push");
    expect(r.error).toBeNull();
    expect(r.days.map((d) => d.passage)).toEqual([
      "Revelation 14-15",
      ...three,
      "Revelation 16-17",
      "Revelation 18",
      "Revelation 19",
    ]);
    expect(r.days[4]).toMatchObject({ iso: "2026-12-26", tag: "moved", fromISO: "2026-12-23" });
    expect(r.days[1]).toMatchObject({ isExtra: false, tag: "new" });
    expect(r.endISO).toBe("2026-12-28");
    expect(r.oldEndISO).toBe("2026-12-25");
  });

  it("adds to existing days without moving the end", () => {
    const r = addReadings(plan, three, "2026-12-23", "add");
    expect(r.endISO).toBe("2026-12-25");
    expect(r.days[1]).toMatchObject({ passage: "Revelation 16-17", extra: "Luke 2:1-20", tag: "added" });
    expect(r.days[3].extra).toBe("Psalm 96");
  });

  it("keeps a weekday-only plan on its weekdays", () => {
    // Mon/Wed/Fri plan.
    const isos = ["2026-11-16", "2026-11-18", "2026-11-20", "2026-11-23", "2026-11-25", "2026-11-27", "2026-11-30", "2026-12-02", "2026-12-04"];
    const mwf = isos.map((iso, i) => ({ iso, passage: `John ${i + 1}` }));
    const r = addReadings(mwf, ["Psalm 1", "Psalm 2"], "2026-12-02", "push");
    expect(r.days.slice(-5).map((d) => d.iso)).toEqual(["2026-11-30", "2026-12-02", "2026-12-04", "2026-12-07", "2026-12-09"]);
  });

  it("starts on a day the plan skips without moving earlier readings", () => {
    const r = addReadings(plan, ["Psalm 1"], "2026-12-21", "push");
    expect(r.days[0]).toMatchObject({ iso: "2026-12-21", passage: "Psalm 1" });
    expect(r.days[1]).toMatchObject({ iso: "2026-12-22", tag: "" });
  });

  it("appends past the end", () => {
    const r = addReadings(plan, ["Psalm 1"], "2027-01-05", "add");
    expect(r.days[r.days.length - 1]).toMatchObject({ iso: "2027-01-05", tag: "new" });
  });
});

describe("joinChapters", () => {
  it("joins runs and separates the rest", () => {
    expect(
      joinChapters([
        { book: "Luke", chapter: 2 },
        { book: "Luke", chapter: 3 },
        { book: "Acts", chapter: 1 },
      ]),
    ).toBe("Luke 2-3; Acts 1");
  });
});

describe("parsePlanText", () => {
  it("reads dated lines and a name", () => {
    const p = parsePlanText("# My plan\n2026-12-01, John 1\n12/2/2026, John 2-3\nnonsense\n2026-12-01, Psalm 1");
    expect(p.name).toBe("My plan");
    expect(p.dated).toBe(true);
    expect(p.days).toEqual([
      { iso: "2026-12-01", passage: "John 1; Psalm 1" },
      { iso: "2026-12-02", passage: "John 2-3" },
    ]);
    expect(p.skipped).toEqual(["nonsense"]);
  });

  it("lays out undated passages on the chosen weekdays", () => {
    const p = parsePlanText("John 1\nJohn 2\nJohn 3", { startISO: "2026-12-05", weekdays: [1, 3] });
    expect(p.days.map((d) => d.iso)).toEqual(["2026-12-07", "2026-12-09", "2026-12-14"]);
  });

  it("asks for a start date when undated", () => {
    expect(parsePlanText("John 1").error).toBe("Pick a start date.");
  });

  it("round-trips through export", () => {
    const days = [
      { iso: "2026-12-01", passage: "John 1" },
      { iso: "2026-12-02", passage: "Psalm 23; Psalm 24" },
    ];
    const p = parsePlanText(formatPlanText("Advent", days));
    expect(p.name).toBe("Advent");
    expect(p.days).toEqual(days);
  });
});

describe("extras in import / export", () => {
  it("round-trips a day's extra and an extra day", () => {
    const days = [
      { iso: "2026-12-23", passage: "Revelation 16-17", extra: "Luke 2" },
      { iso: "2026-12-24", passage: "Isaiah 9", isExtra: true },
    ];
    const text = formatPlanText("Advent", days);
    expect(text).toContain("2026-12-23, Revelation 16-17 + Luke 2");
    expect(text).toContain("2026-12-24, + Isaiah 9");
    expect(parsePlanText(text).days).toEqual(days);
  });
});

const keysOf = (names: string[]) =>
  BOOKS.filter((b) => names.includes(b.name)).flatMap((b) =>
    Array.from({ length: b.chapters }, (_, i) => `${b.name}|${i + 1}`),
  );

describe("tracker", () => {
  const DAY = 86_400_000;
  const nt = BOOKS.filter((b) => b.testament === "NT").map((b) => b.name);
  const ot = BOOKS.filter((b) => b.testament === "OT").map((b) => b.name);

  it("counts NT twice and OT once, and times each time through", () => {
    const t0 = Date.UTC(2026, 0, 1);
    const events = [
      ...keysOf(nt).map((key, i) => ({ key, at: t0 + i * 1000, timed: true })),
      ...keysOf(ot).map((key, i) => ({ key, at: t0 + 30 * DAY + i * 1000, timed: true })),
      ...keysOf(nt).map((key, i) => ({ key, at: t0 + 90 * DAY + i * 1000, timed: true })),
    ];
    const t = buildTracker(events);
    expect(t.nt.times).toBe(2);
    expect(t.ot.times).toBe(1);
    expect(t.bible.times).toBe(1);
    expect(t.bible.progress).toBe(Math.floor((260 / 1189) * 100));
    expect(t.nt.completions[1].days).toBe(1);
    expect(t.books.find((b) => b.key === "Romans")?.times).toBe(2);
  });

  it("keeps a finished testament full until the whole Bible is done", () => {
    const t = buildTracker(keysOf(nt).map((key, i) => ({ key, at: i, timed: true })));
    expect(t.nt).toMatchObject({ times: 1, progress: 100 });
    expect(t.ot).toMatchObject({ times: 0, progress: 0 });
    expect(t.books.find((b) => b.key === "Acts")?.progress).toBe(100);
    expect(t.bible.progress).toBe(Math.floor((260 / 1189) * 100));
  });

  it("a finished book started again shows its new time through", () => {
    const acts = keysOf(["Acts"]);
    const t = buildTracker([
      ...acts.map((key, i) => ({ key, at: i, timed: true })),
      { key: "Acts|1", at: 1000, timed: true },
    ]);
    const a = t.books.find((b) => b.key === "Acts")!;
    expect(a).toMatchObject({ times: 1, progress: Math.floor((1 / 28) * 100) });
  });

  it("an extra doesn't start a finished book again; a plan reading does", () => {
    const acts = keysOf(["Acts"]);
    const done = acts.map((key, i) => ({ key, at: i, timed: true }));
    const withExtra = buildTracker([...done, { key: "Acts|1", at: 1000, timed: true, extra: true }]);
    expect(withExtra.books.find((b) => b.key === "Acts")?.progress).toBe(100);
    const withPlan = buildTracker([...done, { key: "Acts|1", at: 1000, timed: true }]);
    expect(withPlan.books.find((b) => b.key === "Acts")?.progress).toBe(Math.floor((1 / 28) * 100));
  });

  it("start over: bars from zero, times kept", () => {
    const t = buildTracker(keysOf(nt).map((key, i) => ({ key, at: i, timed: true })), 10_000);
    expect(t.nt).toMatchObject({ times: 1, progress: 0 });
    expect(t.nt.completions).toHaveLength(1);
  });

  it("logged reads count but aren't timed", () => {
    const t = buildTracker(keysOf(["Jude"]).map((key) => ({ key, at: 0, timed: false })));
    const jude = t.books.find((b) => b.key === "Jude")!;
    expect(jude.times).toBe(1);
    expect(jude.completions[0]).toMatchObject({ days: null, beforeTracking: true });
  });

  it("rolls finished books up into their section and testament", () => {
    const DAYMS = 86_400_000;
    const gospels = keysOf(["Matthew", "Mark", "Luke", "John"]);
    const t = buildTracker([
      ...gospels.map((key, i) => ({ key, at: i * DAYMS, timed: true })),
      ...keysOf(["Romans"]).map((key, i) => ({ key, at: 200 * DAYMS + i, timed: true })),
    ]);
    const shown = rollUp(t).map((x) => x.level.label);
    expect(shown).toContain("Gospels");
    expect(shown).toContain("Romans");
    expect(shown).not.toContain("Matthew");
    const nt = BOOKS.filter((b) => b.testament === "NT").map((b) => b.name);
    const all = buildTracker(keysOf(nt).map((key, i) => ({ key, at: i, timed: true })));
    expect(rollUp(all).map((x) => x.level.label)).toEqual(["New Testament"]);
  });

  it("labels plans by what they cover", () => {
    expect(planKind(new Set(keysOf([...ot, ...nt])))).toBe("bible");
    expect(planKind(new Set(keysOf(["Matthew", "Mark", "Luke", "John"])))).toBe("section");
    expect(planKind(new Set(keysOf(["Romans", "James"])))).toBe("book");
  });

  it("formats spans", () => {
    expect(formatSpan(3)).toBe("3 days");
    expect(formatSpan(21)).toBe("3 weeks");
    expect(formatSpan(122)).toBe("4 months");
    expect(formatSpan(426)).toBe("1 year 2 months");
  });
});
