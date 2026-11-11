import { describe, expect, it } from "vitest";
import { topSet, setsSummary, fmtSet } from "@/lib/workouts/sets";
import { platesFor, PLATE_BY_ID } from "@/lib/workouts/plates";
import { isHoldName, poolMetricFor } from "@/lib/workouts/catalog";
import { repRecords, recordChips, isNewBest, bandPoints, REP_BANDS, weeksInARow } from "@/lib/workouts/records";
import { PROGRAMS, programByKey, parseScheme, schemeKey, programWeek, blocksDone, targetsFor, weekLabel, raisedMaxes, defaultMovement } from "@/lib/workouts/programs";
import { daySuggestion, movementSuggestion, bigJump, recentHurt, lightFactor } from "@/lib/workouts/suggest";
import { cleanOrder, withCardio, isSimpleCategory, blockKind } from "@/lib/workouts/blocks";
import { parseClock, cardioActivity } from "@/lib/workouts/cardio";
import { cleanPlanScheme, schemeChoiceKey, HAND_WAVE } from "@/lib/workouts/programs";
import { timerPlanFor, timerAt, cuesAt, clockText, resultFromTimer } from "@/lib/workouts/timer";
import { mapResult, rowSummary, rowNotes, syncFrom, syncDue, cleanToken, fmtClock } from "@/lib/workouts/concept2";
import { LIBRARY, DEFAULT_EQUIPMENT, nameKey, planLibraryMerge, watchUrl } from "@/lib/workouts/library";
import { WOD_LIBRARY, planWodMerge, versionMoves, hasScaled, defaultVersion, benchmarkForMonth, wodEquipment } from "@/lib/workouts/wod-library";
import { readWorkoutsFile, planImport, planSummary, fileNameFor, FILE_KIND } from "@/lib/workouts/plan-file";
import { buildFinisher, cleanBuilt, nearestSize, FINISHER_FORMATS, FINISHER_FOCUSES } from "@/lib/workouts/finisher";
import {
  daySections,
  dayTitle,
  dayProgress,
  stripState,
  type DayWorkoutIn,
} from "@/lib/workouts/blocks";

describe("topSet", () => {
  it("is the heaviest set, more reps breaking a tie", () => {
    const sets = [
      { weight: 135, reps: 5 },
      { weight: 185, reps: 1 },
      { weight: 175, reps: 3 },
      { weight: 185, reps: 2 },
    ];
    expect(topSet(sets)).toEqual({ weight: 185, reps: 2 });
  });
  it("uses the biggest number for movements without weight", () => {
    expect(topSet([{ reps: 10 }, { reps: 14 }, { reps: 12 }])).toEqual({ reps: 14 });
    expect(topSet([{ seconds: 45 }, { seconds: 60 }])).toEqual({ seconds: 60 });
  });
  it("prefers any weighted set over an unweighted one", () => {
    expect(topSet([{ reps: 20 }, { weight: 10, reps: 5 }])).toEqual({ weight: 10, reps: 5 });
  });
  it("is null for no sets", () => {
    expect(topSet([])).toBeNull();
  });
});

describe("setsSummary", () => {
  it("names a single set as itself", () => {
    expect(setsSummary([{ weight: 185, reps: 5 }], "lb")).toBe("185 × 5");
    expect(setsSummary([{ weight: 185 }], "lb")).toBe("185 lb");
  });
  it("counts several sets and names the top one", () => {
    const sets = [
      { weight: 135, reps: 5 },
      { weight: 155, reps: 5 },
      { weight: 165, reps: 5 },
      { weight: 175, reps: 3 },
      { weight: 185, reps: 1 },
    ];
    expect(setsSummary(sets, "lb")).toBe("5 sets · top 185 × 1");
  });
  it("formats time and reps", () => {
    expect(fmtSet({ seconds: 90 })).toBe("1:30");
    expect(fmtSet({ seconds: 45 })).toBe("45s");
    expect(fmtSet({ reps: 12 })).toBe("12 reps");
    expect(setsSummary([], "lb")).toBe("");
  });
});

describe("platesFor", () => {
  const perSide = (ids: string[]) => ids.reduce((s, id) => s + PLATE_BY_ID[id].weight, 0);
  it("loads the bar to the total, heaviest plates first", () => {
    expect(platesFor(185, 45)).toEqual(["b45", "b25"]);
    expect(platesFor(225, 45)).toEqual(["b45", "b45"]);
    expect(perSide(platesFor(167.5, 45)) * 2 + 45).toBe(167.5);
  });
  it("is empty at or below the bar", () => {
    expect(platesFor(45, 45)).toEqual([]);
    expect(platesFor(30, 45)).toEqual([]);
  });
  it("never goes over the total", () => {
    for (let t = 45; t <= 405; t += 2.5) {
      expect(perSide(platesFor(t, 45)) * 2 + 45).toBeLessThanOrEqual(t + 1e-9);
    }
  });
});

const w = (o: Partial<DayWorkoutIn> & { id: string }): DayWorkoutIn => ({
  name: "Workout",
  category: "WEIGHTS",
  muscleGroup: null,
  isRest: false,
  hasHiit: false,
  movements: [],
  ...o,
});
const mv = (id: string, metric: "WEIGHT" | "REPS" | "DURATION" | "METERS" | null = "WEIGHT", tracked = true) => ({
  poolExerciseId: id,
  name: id,
  tracked,
  metric,
});

describe("daySections", () => {
  it("orders warm-up, cardio, muscle groups, conditioning", () => {
    const s = daySections([
      w({ id: "hiit", category: "HIIT", hasHiit: true }),
      w({ id: "chest", muscleGroup: "CHEST", movements: [mv("bench")] }),
      w({ id: "row", category: "ROWING" }),
      w({ id: "stretch", category: "STRETCHING", movements: [mv("9090", null, false)] }),
      w({ id: "legs", muscleGroup: "LEGS", movements: [mv("squat")] }),
    ]);
    // Stretching is its own section since v0.615 (Warm-up is a plan of its own).
    expect(s.map((x) => x.title)).toEqual(["Cardio", "Chest", "Legs", "Conditioning", "Stretching"]);
    expect(s[4].items).toEqual([{ type: "card", workoutId: "stretch" }]);
    expect(s[1].items[0]).toMatchObject({ type: "movement", poolExerciseId: "bench", metric: "WEIGHT" });
  });

  it("puts two plans for the same muscle group in one section", () => {
    const s = daySections([
      w({ id: "a1", muscleGroup: "ARMS", movements: [mv("cgbp")] }),
      w({ id: "b1", muscleGroup: "BACK", movements: [mv("row")] }),
      w({ id: "a2", muscleGroup: "ARMS", movements: [mv("curl")] }),
    ]);
    expect(s.map((x) => x.title)).toEqual(["Arms", "Back"]);
    expect(s[0].items.map((i) => (i.type === "movement" ? `${i.workoutId}/${i.poolExerciseId}` : ""))).toEqual([
      "a1/cgbp",
      "a2/curl",
    ]);
  });

  it("keeps a workout as one card when a movement can't be logged by sets", () => {
    const s = daySections([w({ id: "x", muscleGroup: "LEGS", movements: [mv("squat"), mv("sled", "METERS")] })]);
    expect(s[0].items).toEqual([{ type: "card", workoutId: "x" }]);
  });

  it("keeps a workout with nothing tracked as one card (it's marked complete)", () => {
    const s = daySections([w({ id: "x", muscleGroup: "CORE", movements: [mv("plank", "DURATION", false)] })]);
    expect(s[0].items).toEqual([{ type: "card", workoutId: "x" }]);
  });

  it("lists untracked movements beside tracked ones", () => {
    const s = daySections([w({ id: "x", muscleGroup: "CORE", movements: [mv("dl"), mv("stretch", null, false)] })]);
    expect(s[0].items.map((i) => i.type)).toEqual(["movement", "untracked"]);
  });

  it("uses the category's metric when the plan didn't set one", () => {
    const s = daySections([w({ id: "x", category: "ISOMETRIC", movements: [mv("plank", null)] })]);
    expect(s[0].items[0]).toMatchObject({ type: "movement", metric: "DURATION" });
  });

  it("drops rest plans", () => {
    expect(daySections([w({ id: "r", isRest: true })])).toEqual([]);
  });
});

describe("dayTitle", () => {
  const sec = (title: string, kind: "STRENGTH" | "CARDIO" = "STRENGTH") => ({ key: title, kind, title, items: [] });
  it("names one, two or several muscle groups", () => {
    expect(dayTitle([sec("Chest")])).toBe("Chest");
    expect(dayTitle([sec("Chest"), sec("Legs")])).toBe("Chest & legs");
    expect(dayTitle([sec("Chest"), sec("Legs"), sec("Arms")])).toBe("Chest · Legs · Arms");
  });
  it("ignores warm-up and cardio when there's strength work", () => {
    expect(dayTitle([sec("Cardio", "CARDIO"), sec("Back")])).toBe("Back");
  });
  it("falls back to the blocks on a day without strength work", () => {
    expect(dayTitle([sec("Cardio", "CARDIO")])).toBe("Cardio");
    expect(dayTitle([])).toBe("");
  });
});

describe("dayProgress", () => {
  it("counts movements and cards, not untracked movements", () => {
    const s = daySections([
      w({ id: "c", muscleGroup: "CHEST", movements: [mv("bench"), mv("db"), mv("fly", null, false)] }),
      w({ id: "r", category: "ROWING" }),
    ]);
    const p = dayProgress(s, (i) => (i.type === "movement" ? i.poolExerciseId === "bench" : true));
    expect(p).toEqual({ done: 2, total: 3 });
  });
});

describe("stripState", () => {
  const today = "2026-10-30";
  const open = new Set(["2026-10-29"]);
  const d = (date: string, task: "PENDING" | "COMPLETE" | "SKIPPED" | null, logged = false, rested = false) => ({
    date,
    task,
    logged,
    rested,
  });
  it("reads each kind of day", () => {
    expect(stripState(d("2026-10-28", "COMPLETE"), today, open)).toBe("done");
    expect(stripState(d("2026-10-28", "SKIPPED"), today, open)).toBe("rest");
    expect(stripState(d("2026-10-28", null, false, true), today, open)).toBe("rest");
    expect(stripState(d("2026-10-29", "PENDING"), today, open)).toBe("open");
    expect(stripState(d("2026-10-29", "PENDING", true), today, open)).toBe("partial");
    expect(stripState(d("2026-10-27", "PENDING"), today, open)).toBe("expired");
    expect(stripState(d(today, "PENDING"), today, open)).toBe("today");
    expect(stripState(d(today, "PENDING", true), today, open)).toBe("partial");
    expect(stripState(d("2026-10-26", null), today, open)).toBe("none");
    expect(stripState(d("2026-10-26", null, true), today, open)).toBe("done");
  });
  it("rest days: rested or planned, unless something else got done (v0.650)", () => {
    expect(stripState(d("2026-10-28", "SKIPPED", true, true), today, open)).toBe("done");
    expect(stripState({ ...d("2026-10-25", null), restPlanned: true }, today, open)).toBe("rest");
    expect(stripState({ ...d("2026-10-25", null, true), restPlanned: true }, today, open)).toBe("done");
  });
});

describe("pool movement metric (v0.609)", () => {
  it("knows a hold by its name", () => {
    expect(["Planks", "Side plank", "Wall sit", "Dead hang", "Hollow hold", "L-sit", "Farmer hold"].every(isHoldName)).toBe(true);
    expect(["Bench press", "Threshold run", "Holder squat", "Pull-ups"].some(isHoldName)).toBe(false);
  });
  it("uses the movement's own setting only when the category allows it", () => {
    expect(poolMetricFor("WEIGHTS", "DURATION")).toBe("DURATION");
    expect(poolMetricFor("WEIGHTS", null)).toBe("WEIGHT");
    expect(poolMetricFor("ROWING", "DURATION")).toBe("METERS");
  });
});

describe("records by rep count (v0.610)", () => {
  const hist = [
    { weight: 185, reps: 1, date: "2026-10-05" },
    { weight: 175, reps: 3, date: "2026-10-05" },
    { weight: 165, reps: 5, date: "2026-10-12" },
    { weight: 165, reps: 5, date: "2026-10-01" },
    { weight: 135, reps: 10, date: "2026-09-20" },
    { weight: null, reps: 5, date: "2026-09-01" },
  ];
  it("keeps the heaviest per exact rep count, first day it was done", () => {
    expect(repRecords(hist)).toEqual([
      { reps: 1, weight: 185, date: "2026-10-05" },
      { reps: 3, weight: 175, date: "2026-10-05" },
      { reps: 5, weight: 165, date: "2026-10-01" },
      { reps: 10, weight: 135, date: "2026-09-20" },
    ]);
  });
  it("chips favour the usual counts", () => {
    const recs = repRecords([...hist, { weight: 150, reps: 7, date: "2026-10-02" }, { weight: 120, reps: 12, date: "2026-10-02" }]);
    expect(recordChips(recs).map((r) => r.reps)).toEqual([1, 3, 5, 10]);
  });
  it("a new best is something never matched for as many reps or more", () => {
    const recs = repRecords(hist);
    expect(isNewBest({ weight: 170, reps: 5 }, recs)).toBe(true);
    expect(isNewBest({ weight: 175, reps: 2 }, recs)).toBe(false); // 175 × 3 already
    expect(isNewBest({ weight: 180, reps: 2 }, recs)).toBe(true);
    expect(isNewBest({ weight: 100, reps: 12 }, recs)).toBe(true); // never 12 reps
    expect(isNewBest({ weight: 200, reps: 1 }, [])).toBe(false); // first session ever
  });
  it("rep-range lines take the heaviest set in range per day", () => {
    const band = REP_BANDS.find((b) => b.key === "4-6")!;
    expect(
      bandPoints(
        [
          { weight: 185, reps: 1, date: "2026-10-05" },
          { weight: 165, reps: 5, date: "2026-10-05" },
          { weight: 165, reps: 6, date: "2026-10-05" },
          { weight: 155, reps: 4, date: "2026-10-01" },
        ],
        band,
      ),
    ).toEqual([
      { date: "2026-10-01", value: 155, reps: 4 },
      { date: "2026-10-05", value: 165, reps: 6 },
    ]);
  });
});

describe("weeks in a row (v0.610)", () => {
  const w = (due: number, open: number, logged: boolean, current = false) => ({ start: "", due, open, logged, current });
  it("counts done or excused weeks, newest first, until one wasn't", () => {
    expect(weeksInARow([w(3, 1, true, true), w(5, 0, true), w(5, 0, false), w(5, 2, true), w(5, 0, true)])).toBe(2);
  });
  it("the current week adds once it qualifies and never breaks the run", () => {
    expect(weeksInARow([w(2, 0, true, true), w(5, 0, true)])).toBe(2);
    expect(weeksInARow([w(0, 0, false, true), w(5, 0, true)])).toBe(1);
  });
  it("a week with nothing due and nothing logged ends it", () => {
    expect(weeksInARow([w(0, 0, false), w(5, 0, true)])).toBe(0);
  });
});

describe("programs (v0.611)", () => {
  const waves = programByKey("wendler-531")!;
  const tens = programByKey("sets-of-ten")!;
  const full = programByKey("full-body-3")!;
  it("every program's days and defaults line up", () => {
    for (const p of PROGRAMS) {
      expect(p.defaultDays.length).toBe(p.days.length);
      if (p.days.some((d) => d.roles.some((r) => r.scheme.kind === "WAVE"))) expect(p.wave?.length).toBe(p.weeks);
    }
  });
  it("schemes round-trip", () => {
    for (const k of ["wave", "range:3x8-12", "same:3x5"]) expect(schemeKey(parseScheme(k)!)).toBe(k);
    expect(parseScheme("nonsense")).toBeNull();
  });
  it("weeks cycle from the block start", () => {
    expect(programWeek(waves, "2026-10-25", "2026-10-30")).toBe(1);
    expect(programWeek(waves, "2026-10-25", "2026-11-15")).toBe(4);
    expect(programWeek(waves, "2026-10-25", "2026-11-22")).toBe(1);
    expect(blocksDone(waves, "2026-10-25", "2026-11-21")).toBe(0);
    expect(blocksDone(waves, "2026-10-25", "2026-11-22")).toBe(1);
    expect(weekLabel(waves, 4)).toBe("Week 4 of 4 · light");
  });
  it("waves: the week's sets from the training max, or last time without one", () => {
    expect(targetsFor({ program: waves, week: 3, scheme: { kind: "WAVE" }, unit: "lb", trainingMax: 170, last: [] })).toEqual([
      { weight: 70, reps: 5, top: undefined, pct: 0.4, warmup: true },
      { weight: 85, reps: 5, top: undefined, pct: 0.5, warmup: true },
      { weight: 100, reps: 3, top: undefined, pct: 0.6, warmup: true },
      { weight: 130, reps: 5, top: undefined, pct: 0.75 },
      { weight: 145, reps: 3, top: undefined, pct: 0.85 },
      { weight: 160, reps: 1, top: true, pct: 0.95, plus: true },
    ]);
    const t = targetsFor({ program: waves, week: 1, scheme: { kind: "WAVE" }, unit: "lb", trainingMax: null, last: [{ weight: 135, reps: 5 }] });
    expect(t.map((x) => x.weight)).toEqual([135, null, null, null, null, null]);
  });
  it("5/3/1 templates (v0.620): + sets, BBB 5 × 10 at 50%, FSL 5 × 5, wave loading, renamed key", () => {
    const bbb = programByKey("wendler-bbb")!;
    const t1 = targetsFor({ program: bbb, week: 1, scheme: { kind: "WAVE" }, unit: "lb", trainingMax: 200, last: [] });
    expect(t1.map((x) => [x.weight, x.reps, !!x.plus])).toEqual([
      [80, 5, false], [100, 5, false], [120, 3, false],
      [130, 5, false], [150, 5, false], [170, 5, true],
      ...Array.from({ length: 5 }, () => [100, 10, false]),
    ]);
    const deload = targetsFor({ program: bbb, week: 4, scheme: { kind: "WAVE" }, unit: "lb", trainingMax: 200, last: [] });
    expect(deload.map((x) => x.weight)).toEqual([80, 100, 120]);
    const beg = programByKey("wendler-beginners")!;
    expect(beg.weeks).toBe(3);
    expect(beg.lightWeeks).toEqual([]);
    const t2 = targetsFor({ program: beg, week: 2, scheme: { kind: "WAVE" }, unit: "lb", trainingMax: 200, last: [] });
    expect(t2.length).toBe(11);
    expect(t2.slice(0, 3).every((x) => x.warmup)).toBe(true);
    expect(t2.slice(6).every((x) => x.weight === 140 && x.reps === 5 && x.pct === 0.7)).toBe(true);
    const wl = programByKey("wave-loading")!;
    const t3 = targetsFor({ program: wl, week: 1, scheme: { kind: "WAVE" }, unit: "lb", trainingMax: 200, last: [] });
    expect(t3.map((x) => x.reps)).toEqual([5, 5, 3, 3, 2, 1, 3, 2, 1]);
    expect(t3.some((x) => x.plus)).toBe(false);
    expect(programByKey("strength-waves")?.key).toBe("wendler-531");
    // Beginners runs both lifts twice a week; every main role has a training-max lift.
    expect(beg.days.flatMap((d) => d.roles.filter((r) => r.main).map((r) => r.key))).toEqual(["squat", "bench", "deadlift", "press", "bench", "squat"]);
    const hand = targetsFor({ program: HAND_WAVE, week: 1, scheme: { kind: "WAVE", start: "2026-11-02" }, unit: "lb", trainingMax: 200, last: [] });
    expect(hand.some((x) => x.plus)).toBe(false);
  });
  it("rep range: each set one more rep, up to the top, then heavier (v0.665)", () => {
    const scheme = parseScheme("range:3x8-12")!;
    const top = targetsFor({ program: tens, week: 1, scheme, unit: "lb", lower: true, last: [12, 12, 12].map((r) => ({ weight: 100, reps: r })) });
    expect(top).toEqual([1, 2, 3].map(() => ({ weight: 110, reps: 8 })));
    const main = targetsFor({ program: tens, week: 1, scheme, unit: "lb", lower: true, progress: true, last: [12, 12, 12].map((r) => ({ weight: 100, reps: r })) });
    expect(main).toEqual([1, 2, 3].map(() => ({ weight: 110, reps: 8 })));
    const more = targetsFor({ program: tens, week: 1, scheme, unit: "lb", last: [{ weight: 50, reps: 10 }, { weight: 50, reps: 9 }, { weight: 50, reps: 8 }] });
    expect(more).toEqual([{ weight: 50, reps: 11 }, { weight: 50, reps: 10 }, { weight: 50, reps: 9 }]);
  });
  it("same weight: steps up once every rep was done; light week drops a set at 80%", () => {
    const scheme = parseScheme("same:3x5")!;
    const done = [5, 5, 5].map((r) => ({ weight: 135, reps: r }));
    expect(targetsFor({ program: full, week: 1, scheme, unit: "lb", last: done })[0]).toEqual({ weight: 140, reps: 5 });
    const light = targetsFor({ program: full, week: 4, scheme, unit: "lb", last: done });
    expect(light).toEqual([{ weight: 110, reps: 5 }, { weight: 110, reps: 5 }]);
  });
  it("test week works up to a heavy 3 at the best for 3+", () => {
    const t = targetsFor({ program: tens, week: 6, scheme: parseScheme("range:3x8-12")!, unit: "lb", last: [], bestForThree: 150 });
    expect(t.at(-1)).toEqual({ weight: 150, reps: 3, top: true });
    expect(t[0].weight).toBe(75);
  });
  it("raising maxes steps lower lifts further", () => {
    expect(raisedMaxes({ a: 170, b: 120 }, new Set(["a"]), "lb")).toEqual({ a: 180, b: 125 });
  });
  it("finds a default movement by name, ignoring case and plurals", () => {
    const role = waves.days[3].roles[0];
    expect(defaultMovement(role, [{ id: "x", name: "Back Squats" }])?.id).toBe("x");
  });
});

describe("suggestions (v0.612)", () => {
  const none = new Set<string>();
  const base = { today: "2026-10-30", lastTrained: "2026-10-29", feedback: [], light: false, programIntent: null, answered: none };
  it("welcome back after two weeks off, before anything else", () => {
    const s = daySuggestion({ ...base, lastTrained: "2026-10-10", feedback: [{ date: "2026-10-29", effort: null, hurt: "KNEE" }] });
    expect(s?.key).toBe("back");
    expect(s?.actions[0].answer).toBe("ease");
  });
  it("asks about a recent hurt, then hard days; quiet once answered or already light", () => {
    const hurt = daySuggestion({ ...base, feedback: [{ date: "2026-10-27", effort: null, hurt: "SHOULDER" }] });
    expect(hurt?.title).toBe("Your shoulder hurt on Tuesday. Go lighter today?");
    expect(daySuggestion({ ...base, feedback: [{ date: "2026-10-27", effort: null, hurt: "SHOULDER" }], answered: new Set(["hurt"]) })).toBeNull();
    const hard = [
      { date: "2026-10-29", effort: "TOO_HARD", hurt: null, group: "ARMS" },
      { date: "2026-10-27", effort: "TOO_HARD", hurt: null, group: "ARMS" },
      { date: "2026-10-28", effort: "SOLID", hurt: null, group: "CHEST" },
    ];
    expect(daySuggestion({ ...base, feedback: hard })?.key).toBe("hard");
    expect(daySuggestion({ ...base, feedback: hard })?.why).toBe("Arms felt too hard the last 2 times.");
    // Hard (not too hard), or two groups on one day, never ask (v0.619).
    const sameDay = [
      { date: "2026-10-29", effort: "HARD", hurt: null, group: "ARMS" },
      { date: "2026-10-29", effort: "HARD", hurt: null, group: "ARMS" },
      { date: "2026-10-28", effort: "HARD", hurt: null, group: "CHEST" },
    ];
    expect(daySuggestion({ ...base, feedback: sameDay })).toBeNull();
    const oneDayTwoMoves = [
      { date: "2026-10-29", effort: "TOO_HARD", hurt: null, group: "ARMS" },
      { date: "2026-10-29", effort: "TOO_HARD", hurt: null, group: "ARMS" },
    ];
    expect(daySuggestion({ ...base, feedback: oneDayTwoMoves })).toBeNull();
    const threeDays = [
      { date: "2026-10-29", effort: "TOO_HARD", hurt: null, group: "ARMS" },
      { date: "2026-10-28", effort: "TOO_HARD", hurt: null, group: "LEGS" },
      { date: "2026-10-27", effort: "TOO_HARD", hurt: null, group: "CHEST" },
    ];
    expect(daySuggestion({ ...base, feedback: threeDays })?.key).toBe("hard");
    // Not while a new program or plan settles in.
    expect(daySuggestion({ ...base, feedback: hard, planChangedOn: "2026-10-25" })).toBeNull();
    expect(daySuggestion({ ...base, feedback: hard, planChangedOn: "2026-10-01" })?.key).toBe("hard");
    expect(daySuggestion({ ...base, feedback: hard, light: true })).toBeNull();
    expect(daySuggestion({ ...base, feedback: hard, programIntent: "LIGHT" })).toBeNull();
    expect(recentHurt([{ date: "2026-10-01", effort: null, hurt: "KNEE" }], "2026-10-30")).toBeNull();
  });
  const mv = {
    today: "2026-10-30",
    name: "bench press",
    muscleGroup: "CHEST" as const,
    hasTarget: false,
    lower: false,
    unit: "lb",
    feedback: [],
    lastBestOn: "2026-10-20",
    answered: none,
  };
  const s185 = [{ weight: 135, reps: 5 }, { weight: 185, reps: 3 }];
  it("next weight after the same top set twice that felt fine", () => {
    const s = movementSuggestion({ ...mv, history: [{ date: "2026-10-27", sets: s185, effort: "SOLID" }, { date: "2026-10-20", sets: s185, effort: null }] });
    expect(s?.title).toBe("Try 190 for your top set?");
    expect(s?.weight).toBe(190);
    expect(movementSuggestion({ ...mv, hasTarget: true, history: [{ date: "2026-10-27", sets: s185, effort: "SOLID" }, { date: "2026-10-20", sets: s185, effort: null }] })).toBeNull();
    expect(movementSuggestion({ ...mv, history: [{ date: "2026-10-27", sets: s185, effort: "HARD" }, { date: "2026-10-20", sets: s185, effort: null }] })).toBeNull();
  });
  it("a hurt area that works this movement offers a swap", () => {
    const s = movementSuggestion({ ...mv, history: [], feedback: [{ date: "2026-10-29", effort: null, hurt: "ELBOW" }] });
    expect(s?.key).toBe("hurt-swap");
    expect(movementSuggestion({ ...mv, history: [], feedback: [{ date: "2026-10-29", effort: null, hurt: "KNEE" }] })).toBeNull();
  });
  it("a stalled lift: no new best in 6 weeks over 4+ sessions", () => {
    const h = ["2026-10-27", "2026-10-20", "2026-10-13", "2026-10-06"].map((date) => ({ date, sets: [{ weight: 180, reps: 3 }], effort: null }));
    expect(movementSuggestion({ ...mv, history: h, lastBestOn: "2026-09-01" })?.key).toBe("stall");
    expect(movementSuggestion({ ...mv, history: h, lastBestOn: "2026-10-13" })).toBeNull();
  });
  it("big jumps and lighter days", () => {
    expect(bigJump(205, 175)).toBe(17);
    expect(bigJump(190, 185)).toBeNull();
    expect(lightFactor("light")).toBe(0.8);
    expect(lightFactor("ease")).toBe(0.9);
    expect(lightFactor("dismiss")).toBeNull();
  });
});

describe("movement library", () => {
  it("has unique keys, a how-to on every movement and known equipment", () => {
    expect(new Set(LIBRARY.map((m) => m.key)).size).toBe(LIBRARY.length);
    const known = new Set(DEFAULT_EQUIPMENT.map((e) => e.key));
    for (const m of LIBRARY) {
      expect(m.about.length).toBeGreaterThan(10);
      for (const e of m.equipment) expect(known.has(e)).toBe(true);
    }
  });

  it("logs holds by time", () => {
    for (const m of LIBRARY) if (isHoldName(m.name)) expect(m.metric).toBe("DURATION");
  });

  it("matches names ignoring case, plurals and hyphens", () => {
    expect(nameKey("Push-ups")).toBe(nameKey("push up"));
    expect(nameKey("Kettlebell Swings")).toBe(nameKey("Kettlebell swing"));
    expect(nameKey("Arm circles")).toBe(nameKey("arm circle"));
    expect(nameKey("Press")).toBe("press");
  });

  it("tags shared movements with the same name in any category, and adds the rest", () => {
    const lib = LIBRARY.filter((m) => ["plank", "push-up", "burpee"].includes(m.key));
    const pool = [
      { id: "a", name: "Planks", category: "ISOMETRIC", libraryKey: null, ownerId: null },
      { id: "b", name: "Push ups", category: "WEIGHTS", libraryKey: null, ownerId: null },
      { id: "c", name: "Burpee", category: "HIIT", libraryKey: null, ownerId: "someone" },
    ];
    const plan = planLibraryMerge(pool, lib);
    expect(plan.tag.map((t) => `${t.id}:${t.entry.key}`).sort()).toEqual(["a:plank", "b:push-up"]);
    expect(plan.add.map((m) => m.key)).toEqual(["burpee"]);
  });

  it("does nothing new the second time, even after a rename", () => {
    const lib = LIBRARY.filter((m) => m.key === "goblet-squat");
    const pool = [{ id: "a", name: "KB goblet squat", category: "WEIGHTS", libraryKey: "goblet-squat", ownerId: null }];
    expect(planLibraryMerge(pool, lib)).toEqual({ add: [], tag: [] });
  });

  it("links to a video search", () => {
    expect(watchUrl("Turkish get-up")).toContain("Turkish%20get-up");
  });
});

describe("concept2", () => {
  it("maps a rower result", () => {
    const r = mapResult({ id: 12345, type: "rower", date: "2026-10-31 07:12:00", distance: 2000, time: 4653, stroke_rate: 24 });
    expect(r).toEqual({ resultId: "12345", dateISO: "2026-10-31", meters: 2000, seconds: 465, pace: 116.3, strokeRate: 24 });
    expect(rowSummary(r!)).toBe("2,000 m · 7:45 · 1:56.3 /500m");
    expect(rowNotes(r!)).toBe("Concept2 · 1:56.3 /500m · 24 spm");
  });

  it("skips other machines and empty results", () => {
    expect(mapResult({ id: 1, type: "skierg", date: "2026-10-31 07:00:00", distance: 1000, time: 2400 })).toBeNull();
    expect(mapResult({ id: 1, type: "rower", date: "2026-10-31", distance: 0, time: 0 })).toBeNull();
    expect(mapResult({ type: "rower", date: "2026-10-31", distance: 500, time: 900 })).toBeNull();
  });

  it("formats clocks", () => {
    expect(fmtClock(3725)).toBe("1:02:05");
    expect(fmtClock(116.3, true)).toBe("1:56.3");
  });

  it("asks from a day before the last sync, or two weeks back the first time", () => {
    expect(syncFrom(null, "2026-10-31")).toBe("2026-10-17");
    expect(syncFrom("2026-10-30T12:00:00.000Z", "2026-10-31")).toBe("2026-10-29");
    expect(syncFrom("2026-01-01T00:00:00.000Z", "2026-10-31")).toBe("2026-08-02");
  });

  it("checks at most every five minutes unless asked", () => {
    const now = new Date("2026-10-31T12:00:00Z");
    expect(syncDue(null, now)).toBe(true);
    expect(syncDue("2026-10-31T11:58:00Z", now)).toBe(false);
    expect(syncDue("2026-10-31T11:58:00Z", now, true)).toBe(true);
    expect(syncDue("2026-10-31T11:50:00Z", now)).toBe(true);
  });

  it("cleans a pasted token", () => {
    expect(cleanToken("  Bearer abcdefghijklmnop0123 ")).toBe("abcdefghijklmnop0123");
    expect(cleanToken("short")).toBeNull();
    expect(cleanToken("has spaces in the middle of it")).toBeNull();
  });
});

describe("section order", () => {
  it("keeps known kinds once and fills in the rest where the default has them", () => {
    expect(cleanOrder(["CARDIO", "WARMUP", "BOGUS", "CARDIO"])).toEqual([
      "CARDIO",
      "WARMUP",
      "STRENGTH",
      "CONDITIONING",
      "MOBILITY",
      "STRETCH",
      "SPORT",
    ]);
    expect(cleanOrder(["SPORT", "STRENGTH"])).toEqual(["WARMUP", "CARDIO", "SPORT", "STRENGTH", "CONDITIONING", "MOBILITY", "STRETCH"]);
    expect(cleanOrder(["STRENGTH", "CARDIO"])).toEqual(["WARMUP", "STRENGTH", "CARDIO", "CONDITIONING", "MOBILITY", "STRETCH", "SPORT"]);
    expect(cleanOrder(null)[0]).toBe("WARMUP");
  });

  it("lays the day out in the person's order", () => {
    const w = (id: string, category: string | null, mg: string | null = null): DayWorkoutIn => ({
      id,
      name: id,
      category: category as never,
      muscleGroup: mg as never,
      isRest: false,
      hasHiit: false,
      movements: [],
    });
    const day = [w("lift", "WEIGHTS", "CHEST"), w("cardio", "CARDIO"), w("warm", "WARMUP"), w("stretch", "STRETCHING")];
    expect(daySections(day).map((s) => s.kind)).toEqual(["WARMUP", "CARDIO", "STRENGTH", "STRETCH"]);
    expect(daySections(day, ["WARMUP", "STRENGTH", "CARDIO", "CONDITIONING", "STRETCH", "SPORT"]).map((s) => s.kind)).toEqual([
      "WARMUP",
      "STRENGTH",
      "CARDIO",
      "STRETCH",
    ]);
  });

  it("puts a Cardio section where the order says when cardio was done but not planned", () => {
    const lift: DayWorkoutIn = { id: "a", name: "Chest", category: "WEIGHTS", muscleGroup: "CHEST", isRest: false, hasHiit: false, movements: [] };
    const warm: DayWorkoutIn = { ...lift, id: "w", name: "Warm-up", category: "WARMUP" as never, muscleGroup: null };
    const s = daySections([lift, warm]);
    expect(withCardio(s, true).map((x) => x.kind)).toEqual(["WARMUP", "CARDIO", "STRENGTH"]);
    expect(withCardio(s, true, ["WARMUP", "STRENGTH", "CARDIO"] as never).map((x) => x.kind)).toEqual(["WARMUP", "STRENGTH", "CARDIO"]);
    expect(withCardio(s, false)).toBe(s);
  });

  it("files the new categories", () => {
    expect(blockKind("CARDIO" as never, false)).toBe("CARDIO");
    expect(blockKind("ROWING", false)).toBe("CARDIO");
    expect(blockKind("WARMUP" as never, false)).toBe("WARMUP");
    expect(blockKind("STRETCHING", false)).toBe("STRETCH");
    expect(isSimpleCategory("CARDIO")).toBe(true);
    expect(isSimpleCategory("ROWING")).toBe(false);
  });
});

describe("cardio", () => {
  it("reads times", () => {
    expect(parseClock("7:45")).toBe(465);
    expect(parseClock("1:02:05")).toBe(3725);
    expect(parseClock("20")).toBe(1200);
    expect(parseClock("7:75")).toBeNull();
    expect(parseClock("abc")).toBeNull();
    expect(parseClock("")).toBeNull();
  });
  it("knows what each activity asks for", () => {
    expect(cardioActivity("ruck")).toMatchObject({ category: "RUCKING", distance: true, load: true });
    expect(cardioActivity("jump_rope")).toMatchObject({ category: "CARDIO", name: "Jump rope" });
    expect(cardioActivity("swim")).toBeNull();
  });
});

describe("set structure in a hand-built plan", () => {
  it("stores known structures and starts a wave today", () => {
    expect(cleanPlanScheme("same:3x5", "2026-11-02")).toBe("same:3x5");
    expect(cleanPlanScheme("range:3x8-12", "2026-11-02")).toBe("range:3x8-12");
    expect(cleanPlanScheme("wave", "2026-11-02")).toBe("wave:2026-11-02");
    expect(cleanPlanScheme("wave", "2026-11-09", "wave:2026-11-02")).toBe("wave:2026-11-02");
    expect(cleanPlanScheme("", "2026-11-02")).toBeNull();
    expect(cleanPlanScheme("same:99x5", "2026-11-02")).toBeNull();
    expect(cleanPlanScheme("junk", "2026-11-02")).toBeNull();
  });
  it("shows a stored wave as the wave choice", () => {
    expect(schemeChoiceKey("wave:2026-11-02")).toBe("wave");
    expect(schemeChoiceKey("same:5x5")).toBe("same:5x5");
    expect(schemeChoiceKey(null)).toBe("");
    expect(parseScheme("wave:2026-11-02")).toEqual({ kind: "WAVE", start: "2026-11-02" });
  });
  it("runs the 5/3/1 wave from the day it was chosen", () => {
    expect(programWeek(HAND_WAVE, "2026-11-02", "2026-11-02")).toBe(1);
    expect(programWeek(HAND_WAVE, "2026-11-02", "2026-11-16")).toBe(3);
    expect(programWeek(HAND_WAVE, "2026-11-02", "2026-11-30")).toBe(1);
    const sets = targetsFor({ program: HAND_WAVE, week: 3, scheme: { kind: "WAVE", start: "2026-11-02" }, unit: "lb", trainingMax: 200, last: [] });
    expect(sets.map((s) => [s.weight, s.reps, !!s.top])).toEqual([
      [150, 5, false],
      [170, 3, false],
      [190, 1, true],
    ]);
  });
});

describe("conditioning timer", () => {
  it("counts an AMRAP down, ticking the last three seconds, with a halfway cue", () => {
    const p = timerPlanFor("AMRAP", 600, ["a", "b"]);
    expect([p.kind, p.totalSec, p.result, p.rounds, p.title]).toEqual(["COUNTDOWN", 600, "ROUNDS", true, "AMRAP · 10 min"]);
    expect(timerAt(p, 0).clock).toBe(600);
    expect(timerAt(p, 61).clock).toBe(539);
    expect(cuesAt(p, 300)).toEqual(["HALF"]);
    expect(cuesAt(p, 597)).toEqual(["TICK"]);
    expect(cuesAt(p, 599)).toEqual(["TICK"]);
    expect(cuesAt(p, 600)).toEqual(["END"]);
    expect(timerAt(p, 600).done).toBe(true);
    expect(timerPlanFor("AMRAP", null, []).totalSec).toBe(720);
  });

  it("runs an EMOM a minute at a time, cycling the movements", () => {
    const p = timerPlanFor("EMOM", 300, ["Swing", "Burpee"]);
    expect(p.segments.map((s) => s.label)).toEqual([
      "Minute 1 of 5 · Swing",
      "Minute 2 of 5 · Burpee",
      "Minute 3 of 5 · Swing",
      "Minute 4 of 5 · Burpee",
      "Minute 5 of 5 · Swing",
    ]);
    expect(timerAt(p, 65)).toMatchObject({ clock: 55, index: 1 });
    expect(cuesAt(p, 60)).toEqual(["CHANGE"]);
    expect(cuesAt(p, 58)).toEqual(["TICK"]);
    expect(cuesAt(p, 300)).toEqual(["END"]);
    expect(resultFromTimer(p, 300, 0)).toBe(5);
    expect(timerPlanFor("EMOM", null, []).totalSec).toBe(600);
  });

  it("runs Tabata 20 on / 10 off × 8 for each movement", () => {
    const p = timerPlanFor("TABATA", null, ["Squat", "Push-up"]);
    expect(p.totalSec).toBe(480);
    expect(p.segments.length).toBe(32);
    expect(timerAt(p, 20)).toMatchObject({ label: "Rest", work: false, clock: 10 });
    expect(timerAt(p, 245)).toMatchObject({ label: "Push-up · round 1 of 8", work: true });
    expect(cuesAt(p, 20)).toEqual(["CHANGE"]);
  });

  it("times for-time workouts on a stopwatch, and stations by station", () => {
    const f = timerPlanFor("FOR_TIME", null, ["a"]);
    expect([f.kind, f.totalSec, f.result]).toEqual(["STOPWATCH", null, "TIME"]);
    expect(timerAt(f, 845).clock).toBe(845);
    expect(cuesAt(f, 30)).toEqual([]);
    expect(resultFromTimer(f, 845, 0)).toBe(845);
    const t = timerPlanFor("TIMED_STATIONS", 45, ["a", "b", "c"]);
    expect([t.totalSec, t.segments[2].label]).toEqual([135, "Station 3 of 3 · c"]);
  });

  it("formats the clock", () => {
    expect(clockText(720)).toBe("12:00");
    expect(clockText(7)).toBe("0:07");
    expect(clockText(3725)).toBe("1:02:05");
  });
});

describe("workouts library", () => {
  it("uses library movements (or a run), unique keys, a how-to and Scaled for each", () => {
    const names = new Set(LIBRARY.map((l) => nameKey(l.name)));
    expect(new Set(WOD_LIBRARY.map((w) => w.key)).size).toBe(WOD_LIBRARY.length);
    for (const w of WOD_LIBRARY) {
      expect(w.about.length).toBeGreaterThan(10);
      expect(w.scaled.length).toBe(w.moves.length);
      for (const m of w.moves) expect(m.name === "Run" || names.has(nameKey(m.name))).toBe(true);
    }
    expect(WOD_LIBRARY.filter((w) => w.kind === "BENCHMARK").length).toBeGreaterThanOrEqual(5);
  });
  it("Scaled changes only what it says", () => {
    const cindy = WOD_LIBRARY.find((w) => w.key === "cindy")!;
    expect(versionMoves(cindy.moves, cindy.scaled, "SCALED").map((m) => m.reps)).toEqual([3, 6, 15]);
    expect(versionMoves(cindy.moves, cindy.scaled, "RX").map((m) => m.reps)).toEqual([5, 10, 15]);
    expect(hasScaled(cindy.moves, cindy.scaled)).toBe(true);
    const tabata = WOD_LIBRARY.find((w) => w.key === "tabata-squat-push")!;
    expect(hasScaled(tabata.moves, tabata.scaled)).toBe(false);
    const helen = WOD_LIBRARY.find((w) => w.key === "helen")!;
    expect(versionMoves(helen.moves, helen.scaled, "SCALED")[0]).toMatchObject({ name: "Run", distance: 0.5 });
  });
  it("needs the right equipment", () => {
    expect(wodEquipment(WOD_LIBRARY.find((w) => w.key === "bodyweight-fifteen")!)).toEqual([]);
    expect(wodEquipment(WOD_LIBRARY.find((w) => w.key === "swing-and-push")!)).toEqual(["kettlebells"]);
  });
  it("adds only what isn't there, by key or by a shared workout's name", () => {
    const all = planWodMerge([]);
    expect(all.length).toBe(WOD_LIBRARY.length);
    const some = planWodMerge([
      { name: "x", libraryKey: "cindy", ownerId: null },
      { name: "Karen", libraryKey: null, ownerId: null },
      { name: "Annie", libraryKey: null, ownerId: "u1" },
    ]);
    expect(some.map((w) => w.key)).not.toContain("cindy");
    expect(some.map((w) => w.key)).not.toContain("karen");
    expect(some.map((w) => w.key)).toContain("annie");
  });
  it("starts younger people on Scaled", () => {
    expect(defaultVersion(null, "2026-11-02")).toBe("RX");
    expect(defaultVersion("2012-05-01", "2026-11-02")).toBe("SCALED");
    expect(defaultVersion("2010-11-02", "2026-11-02")).toBe("RX");
    expect(defaultVersion("2010-11-03", "2026-11-02")).toBe("SCALED");
  });
  it("turns the benchmarks month by month", () => {
    const list = [1, 2, 3];
    const a = benchmarkForMonth("2026-11-02", list);
    expect(benchmarkForMonth("2026-12-01", list)).toBe((a + 1) % 3);
    expect(benchmarkForMonth("2027-01-01", list)).toBe((a + 2) % 3);
    expect(benchmarkForMonth("2026-11-02", [])).toBe(-1);
  });
});

describe("build one", () => {
  it("is the same for the same seed, different for the next", () => {
    const a = buildFinisher({ minutes: 12, format: "AMRAP", focus: "ANY", equipment: DEFAULT_EQUIPMENT, seed: 5 });
    const b = buildFinisher({ minutes: 12, format: "AMRAP", focus: "ANY", equipment: DEFAULT_EQUIPMENT, seed: 5 });
    expect(a).toEqual(b);
    const names = new Set([5, 6, 7, 8].map((s) => JSON.stringify(buildFinisher({ minutes: 12, format: "AMRAP", focus: "ANY", equipment: DEFAULT_EQUIPMENT, seed: s })!.moves)));
    expect(names.size).toBeGreaterThan(1);
  });
  it("builds every format and focus from the household's kit", () => {
    for (const format of FINISHER_FORMATS)
      for (const focus of FINISHER_FOCUSES)
        for (const minutes of [8, 12, 15, 20]) {
          const w = buildFinisher({ minutes, format, focus, equipment: DEFAULT_EQUIPMENT, seed: 1 })!;
          expect(w).not.toBeNull();
          expect(w.moves.length).toBeGreaterThanOrEqual(2);
          if (format === "AMRAP" || format === "EMOM") expect(w.capSec).toBe(minutes * 60);
          if (format === "TABATA") expect(w.moves.every((m) => m.reps == null)).toBe(true);
          if (format === "CHIPPER") expect(w.moves.length).toBe(5);
          if (focus === "BODYWEIGHT") expect(w.moves.every((m) => m.weight == null)).toBe(true);
          // Weights are sizes on hand.
          for (const m of w.moves) if (m.weight != null) expect(DEFAULT_EQUIPMENT.some((e) => e.sizes.includes(m.weight!))).toBe(true);
        }
  });
  it("keeps to bodyweight with no equipment", () => {
    const w = buildFinisher({ minutes: 12, format: "AMRAP", focus: "KETTLEBELL", equipment: [], seed: 2 })!;
    expect(w.moves.every((m) => m.weight == null)).toBe(true);
  });
  it("Scaled is lighter and trims the hard reps", () => {
    const w = buildFinisher({ minutes: 12, format: "AMRAP", focus: "KETTLEBELL", equipment: DEFAULT_EQUIPMENT, seed: 3 })!;
    const s = versionMoves(w.moves, w.scaled, "SCALED");
    w.moves.forEach((m, i) => {
      if (m.weight != null) expect(s[i].weight!).toBeLessThanOrEqual(m.weight);
      if (m.reps != null) expect(s[i].reps!).toBeLessThanOrEqual(m.reps);
    });
  });
  it("picks the nearest size", () => {
    expect(nearestSize([15, 18, 26, 35], 20)).toBe(18);
    expect(nearestSize([10, 30], 20)).toBe(10);
    expect(nearestSize([], 20)).toBe(20);
    expect(nearestSize([10], null)).toBe(null);
  });
  it("checks a built workout from a client", () => {
    const w = buildFinisher({ minutes: 8, format: "EMOM", focus: "ANY", equipment: DEFAULT_EQUIPMENT, seed: 9 })!;
    expect(cleanBuilt(JSON.parse(JSON.stringify(w)))).toEqual(w);
    expect(cleanBuilt({ name: "x", type: "AMRAP", moves: [] })).toBeNull();
    expect(cleanBuilt({ name: "Okay", type: "DROP TABLE", moves: [{ name: "Burpee" }] })).toBeNull();
  });
});

describe("workouts file", () => {
  const good = {
    kind: FILE_KIND,
    format: 1,
    exportedAt: "2026-11-02T12:00:00Z",
    name: "Three-day",
    plan: [
      { day: 1, name: "Chest", category: "WEIGHTS", muscleGroup: "CHEST", rest: false, workout: null,
        movements: [{ name: "Bench press", category: "WEIGHTS", muscleGroup: "CHEST", metric: "WEIGHT", tracked: true, scheme: "wave:2026-10-01" },
                    { name: "Svend press", category: "WEIGHTS", muscleGroup: "CHEST", metric: "BOGUS", tracked: true, scheme: "drop table" }] },
      { day: 3, name: "Conditioning", category: "HIIT", muscleGroup: null, rest: false, workout: "Garage grinder", movements: [] },
      { day: 0, name: "", category: null, muscleGroup: null, rest: true, workout: null, movements: [] },
      { day: 9, name: "Nope", category: "WEIGHTS", rest: false, movements: [] },
    ],
    order: { everyDay: ["WARMUP", "STRENGTH", "NOPE"], days: { "1": ["CARDIO"], "8": ["CARDIO"] } },
    workouts: [
      { name: "Garage grinder", type: "AMRAP", capSec: 600, movements: [{ name: "Kettlebell swing", category: "WEIGHTS", reps: 15, weight: 35 }, { name: "Bear crawl", reps: 10 }] },
      { name: "Bad", type: "WHATEVER", movements: [{ name: "x" }] },
    ],
    history: [{ date: "2026-10-01", sets: [] }],
  };
  it("reads a file and leaves out what it doesn't know", () => {
    const r = readWorkoutsFile(JSON.stringify(good));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.file.plan.map((e) => [e.day, e.name])).toEqual([[1, "Chest"], [3, "Conditioning"], [0, "Rest day"]]);
    expect(r.file.plan[0].movements.map((m) => [m.metric, m.scheme])).toEqual([["WEIGHT", "wave"], [null, null]]);
    expect(r.file.workouts.map((w) => w.name)).toEqual(["Garage grinder"]);
    expect(r.file.workouts[0].movements[1].category).toBe("HIIT");
    expect(r.file.order).toEqual({ everyDay: ["WARMUP", "STRENGTH"], days: { "1": ["CARDIO"] } });
    expect("history" in r.file).toBe(false);
  });
  it("refuses what isn't a workouts file", () => {
    expect(readWorkoutsFile("not json").ok).toBe(false);
    expect(readWorkoutsFile({ kind: "other" }).ok).toBe(false);
    expect(readWorkoutsFile({ ...good, format: 99 }).ok).toBe(false);
    expect(readWorkoutsFile({ kind: FILE_KIND, format: 1, plan: [], workouts: [] }).ok).toBe(false);
  });
  it("works out what an import adds", () => {
    const r = readWorkoutsFile(good);
    if (!r.ok) throw new Error("bad");
    const pool = [
      { id: "1", name: "Bench Press", category: "WEIGHTS", ownerId: null },
      { id: "2", name: "Kettlebell swings", category: "WEIGHTS", ownerId: null },
      { id: "3", name: "Svend press", category: "WEIGHTS", ownerId: "someone-else" },
    ];
    const p = planImport(r.file, pool, [{ id: "w", name: "garage grinder", ownerId: "someone-else", approved: false }], "me");
    expect(p.newMovements.map((m) => m.name)).toEqual(["Svend press", "Bear crawl"]);
    expect(p.newWorkouts).toEqual(["Garage grinder"]);
    expect([p.entries, p.days]).toEqual([3, 2]);
    const q = planImport(r.file, pool, [{ id: "w", name: "Garage grinder", ownerId: null, approved: true }], "me");
    expect(q.newWorkouts).toEqual([]);
  });
  it("sums a plan up and names the file", () => {
    const r = readWorkoutsFile(good);
    if (!r.ok) throw new Error("bad");
    expect(planSummary(r.file.plan)).toBe("Mon Chest · Wed Conditioning");
    expect(fileNameFor("2026-11-02")).toBe("kairos-workouts-2026-11-02.json");
    expect(fileNameFor("2026-11-02", "Three-Day Plan!")).toBe("kairos-workouts-three-day-plan-2026-11-02.json");
  });
});

describe("warm-up routines (v0.622)", () => {
  it("library ids are unique and every step reads", async () => {
    const { WARMUP_LIBRARY, LIBRARY_ROUTINES, stepAmount } = await import("@/lib/workouts/warmup-library");
    expect(new Set(WARMUP_LIBRARY.map((r) => r.key)).size).toBe(WARMUP_LIBRARY.length);
    for (const r of LIBRARY_ROUTINES) for (const s of r.steps) expect(stepAmount(s).length).toBeGreaterThan(0);
  });
  it("cleans steps from a client and says their amount", async () => {
    const { cleanSteps, stepAmount } = await import("@/lib/workouts/warmup-library");
    const s = cleanSteps([
      { name: " Lunge stretch ", kind: "TIME", seconds: 2, sides: true },
      { name: "Squats", kind: "REPS", amount: "10–15" },
      { name: "", kind: "REPS" },
      "junk",
    ]);
    expect(s).toEqual([
      { name: "Lunge stretch", kind: "TIME", seconds: 5, sides: true },
      { name: "Squats", kind: "REPS", amount: "10–15" },
    ]);
    expect(s.map(stepAmount)).toEqual(["5 s each side", "10–15"]);
    expect(stepAmount({ name: "Row", kind: "TIME", seconds: 180 })).toBe("3:00");
  });
});
