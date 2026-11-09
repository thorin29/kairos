import { describe, expect, it } from "vitest";
import {
  ARMS_LIBRARY,
  CORE_LIBRARY,
  coreDayName,
  libraryCoreWorkout,
  PLANK_TEST,
  cleanCoreDay,
  cleanCoreMoves,
  coreDayMoves,
  coreMoveLabel,
  coreScheme,
  libraryKeyFor,
  stepCoreDay,
  type CoreDay,
} from "@/lib/workouts/core-library";
import { LIBRARY } from "@/lib/workouts/library";
import { parseScheme, schemeLabel, targetsFor } from "@/lib/workouts/programs";

const base: CoreDay = {
  rotation: ["lib:strength", "lib:rotation", "lib:hanging"],
  test: true,
  at: 0,
  since: "2026-11-07",
  testedMonth: "2026-11",
  withTest: false,
};

describe("core library", () => {
  it("uses only movements from the movement library, each logged the way the library says", () => {
    const kindOf = { W: "WEIGHT", R: "REPS", T: "DURATION" } as const;
    for (const w of CORE_LIBRARY) {
      for (const m of w.moves) {
        const key = libraryKeyFor(m.name);
        expect(key, `${w.name}: ${m.name}`).not.toBeNull();
        const entry = LIBRARY.find((e) => e.key === key)!;
        const want = m.kind === "TIME" ? "DURATION" : m.kind;
        expect(entry.metric, `${w.name}: ${m.name}`).toBe(want);
        void kindOf;
      }
    }
  });

  it("keeps the plank for the monthly test only", () => {
    for (const w of CORE_LIBRARY) expect(w.moves.some((m) => m.name === "Plank")).toBe(false);
  });

  it("writes reps as a range and holds as timed sets", () => {
    expect(coreScheme({ name: "V-up", kind: "REPS", sets: 3, min: 8, max: 12 })).toBe("range:3x8-12");
    expect(coreScheme({ name: "Hollow hold", kind: "TIME", sets: 3, min: 30, max: 45 })).toBe("hold:3x30-45");
    expect(coreMoveLabel(PLANK_TEST)).toBe("1 × 1:10–3:45");
    expect(coreMoveLabel({ name: "Suitcase carry", kind: "WEIGHT", sets: 3, min: 40, max: 40 })).toBe("3 × 40 yd");
    expect(schemeLabel(parseScheme("hold:3x30-45")!)).toBe("3 × 0:30–0:45");
  });

  it("aims a hold five seconds past last time, within the range", () => {
    const scheme = parseScheme("hold:3x30-45")!;
    const program = { key: "", name: "", blurb: "", weeks: 1, lightWeeks: [], testWeeks: [], defaultDays: [], days: [] };
    const t = targetsFor({ program, week: 1, scheme, unit: "lb", last: [{ weight: null, reps: null, seconds: 35 }] });
    expect(t).toHaveLength(3);
    expect(t[0]).toMatchObject({ weight: null, seconds: 40 });
    const first = targetsFor({ program, week: 1, scheme, unit: "lb", last: [] });
    expect(first[0].seconds).toBe(30);
  });

  it("cleans moves from an editor", () => {
    const m = cleanCoreMoves([
      { name: "Plank", kind: "TIME", sets: 3, min: 2, max: 60, poolExerciseId: "p1" },
      { name: "Crunch", kind: "REPS", sets: 0, min: 10, max: 20 },
      { name: "Sit-up", kind: "NOPE", sets: 3, min: 10, max: 20 },
      { name: "Sit-up", kind: "REPS", sets: 3, min: 20, max: 10 },
    ]);
    expect(m).toEqual([
      { name: "Plank", kind: "TIME", sets: 3, min: 5, max: 60, poolExerciseId: "p1" },
      { name: "Sit-up", kind: "REPS", sets: 3, min: 20, max: 20, poolExerciseId: null },
    ]);
  });
});

describe("core day rotation", () => {
  it("moves on when the logged day's weekday comes round again", () => {
    expect(stepCoreDay(base, ["2026-11-07"], "2026-11-07").at).toBe(0);
    // The day after, the logged day still shows what was done.
    expect(stepCoreDay(base, ["2026-11-07"], "2026-11-08").at).toBe(0);
    expect(stepCoreDay(base, ["2026-11-07"], "2026-11-13").at).toBe(0);
    const next = stepCoreDay(base, ["2026-11-07"], "2026-11-14");
    expect(next).toMatchObject({ at: 1, since: "2026-11-14" });
  });

  it("repeats a missed week instead of skipping it", () => {
    expect(stepCoreDay(base, [], "2026-11-21").at).toBe(0);
  });

  it("wraps around", () => {
    expect(stepCoreDay({ ...base, at: 2 }, ["2026-11-07"], "2026-11-14").at).toBe(0);
  });

  it("puts the plank test in on the month's first core day and keeps the workout", () => {
    const dec = stepCoreDay({ ...base, since: "2026-11-30" }, [], "2026-12-05");
    expect(dec.withTest).toBe(true);
    const moves = coreDayMoves(CORE_LIBRARY[0], dec.withTest);
    expect(moves[0]).toBe(PLANK_TEST);
    expect(moves.length).toBe(CORE_LIBRARY[0].moves.length + 1);
    // Done that day: the test is off for the rest of the month.
    const after = stepCoreDay({ ...dec, since: "2026-12-05" }, ["2026-12-05"], "2026-12-12");
    expect(after.since).toBe("2026-12-12");
    expect(after).toMatchObject({ testedMonth: "2026-12", withTest: false, at: 1 });
  });

  it("can leave the test out", () => {
    expect(stepCoreDay({ ...base, test: false, testedMonth: null }, [], "2026-12-05").withTest).toBe(false);
  });

  it("reads a stored rotation safely", () => {
    expect(cleanCoreDay({ rotation: [] }, "2026-11-04")).toBeNull();
    expect(cleanCoreDay({ rotation: ["a", "a", "b"], at: 5 }, "2026-11-04")).toMatchObject({
      rotation: ["a", "b"],
      at: 1,
      since: "2026-11-04",
      test: true,
    });
  });
});

describe("sides and clock entry (v0.642)", () => {
  it("pairs the sets of a movement done a side at a time", async () => {
    const { switchesSides } = await import("@/lib/workouts/core-library");
    expect(switchesSides("Side plank")).toBe(true);
    expect(switchesSides("Suitcase carry")).toBe(true);
    expect(switchesSides("Plank")).toBe(false);
    expect(switchesSides("Farmer carry")).toBe(false);
    for (const w of CORE_LIBRARY) for (const m of w.moves) if (switchesSides(m.name)) expect(m.sets % 2, `${w.name}: ${m.name}`).toBe(0);
    expect(cleanCoreMoves([{ name: "Side plank", kind: "TIME", sets: 3, min: 30, max: 45 }])[0].sets).toBe(4);
  });

  it("reads a typed time like a microwave and shows it as m:ss", async () => {
    const { clockText, secondsFromTyped } = await import("@/lib/workouts/clock-entry");
    expect(secondsFromTyped("126")).toBe("86");
    expect(secondsFromTyped("2:06")).toBe("126");
    expect(secondsFromTyped("2:065")).toBe("1265");
    expect(secondsFromTyped("2:0")).toBe("20");
    expect(secondsFromTyped("")).toBe("");
    expect(clockText(126)).toBe("2:06");
    expect(clockText("")).toBe("");
  });
});

describe("arms library (v0.651)", () => {
  it("uses only library movements, logged the way the library says", () => {
    for (const w of ARMS_LIBRARY) {
      expect(w.kind).toBe("arms");
      for (const m of w.moves) {
        const key = libraryKeyFor(m.name);
        expect(key, `${w.name}: ${m.name}`).not.toBeNull();
        const entry = LIBRARY.find((e) => e.key === key)!;
        expect(entry.metric, `${w.name}: ${m.name}`).toBe(m.kind === "TIME" ? "DURATION" : m.kind);
      }
    }
  });
  it("has its own ids, found like Core's, and names the day Arms", () => {
    const ids = [...CORE_LIBRARY, ...ARMS_LIBRARY].map((w) => w.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(libraryCoreWorkout("lib:arms-ez")?.name).toBe("EZ bar classic");
    expect(coreDayName(ARMS_LIBRARY[0], "arms")).toBe("Arms · EZ bar classic");
    expect(coreDayName(CORE_LIBRARY[0])).toBe("Core · Core strength");
  });
  it("keeps an Arms day's kind through cleaning", () => {
    expect(cleanCoreDay({ ...base, kind: "arms" }, "2026-11-09")?.kind).toBe("arms");
    expect(cleanCoreDay(base, "2026-11-09")?.kind).toBeUndefined();
  });
});
