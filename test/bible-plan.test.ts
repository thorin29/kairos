import { describe, expect, it } from "vitest";
import { buildPlan, expandSegments } from "@/lib/bible/plan-builder";
import { VERSES } from "@/lib/bible/verses";
import { BOOKS } from "@/lib/bible/books";

describe("verse counts (v0.722)", () => {
  it("cover every chapter of every book", () => {
    for (const b of BOOKS) expect(VERSES[b.name]?.length).toBe(b.chapters);
    expect(Object.values(VERSES).flat().reduce((a, b) => a + b, 0)).toBe(31103);
  });
});

describe("no passage twice (v0.722)", () => {
  it("keeps a repeated chapter only the first time", () => {
    const segs = [{ book: "Ruth" }, { book: "Ruth", from: 2, to: 3 }, { book: "Jonah" }];
    expect(expandSegments(segs).length).toBe(8);
    const p = buildPlan({ segments: segs, startISO: "2026-01-01", pace: { kind: "weekly", perWeekday: { 0: 1, 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1 } }, keepBooksWhole: false });
    expect(p.repeats).toBe(2);
    expect(p.days.length).toBe(8);
  });
});

describe("balance by verses (v0.722)", () => {
  const every = { 0: 3, 1: 3, 2: 3, 3: 3, 4: 3, 5: 3, 6: 3 };
  it("evens days out: short psalms together, Psalm 119 alone", () => {
    const p = buildPlan({ segments: [{ book: "Psalms", from: 113, to: 125 }], startISO: "2026-01-01", pace: { kind: "weekly", perWeekday: every }, keepBooksWhole: false, balance: "verses" });
    expect(p.days.some((d) => d.passage === "Psalm 119")).toBe(true);
    expect(p.days.some((d) => /117/.test(d.passage) && /-/.test(d.passage))).toBe(true);
    expect(p.scheduledChapters).toBe(13);
  });
  it("finishes by the date with every chapter scheduled", () => {
    const p = buildPlan({ segments: [{ book: "Genesis" }, { book: "Exodus" }], startISO: "2026-01-01", pace: { kind: "finish", endISO: "2026-01-30", weekdays: [0, 1, 2, 3, 4, 5, 6] }, keepBooksWhole: false, balance: "verses" });
    expect(p.leftover).toBe(0);
    expect(p.scheduledChapters).toBe(90);
    expect(p.endISO! <= "2026-01-30").toBe(true);
  });
  it("leaves chapter mode as it was", () => {
    const p = buildPlan({ segments: [{ book: "Ruth" }], startISO: "2026-01-01", pace: { kind: "weekly", perWeekday: { 0: 2, 1: 2, 2: 2, 3: 2, 4: 2, 5: 2, 6: 2 } }, keepBooksWhole: false });
    expect(p.days.map((d) => d.passage)).toEqual(["Ruth 1-2", "Ruth 3-4"]);
  });
});
