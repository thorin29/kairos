import { describe, expect, it } from "vitest";
import {
  adjustAnswer,
  adjustKeep,
  adjustLabel,
  cleanAdjust,
  loadsArea,
  parseAdjust,
  pickStandIns,
  perSetFrom,
  planShort,
  type LiftIn,
} from "@/lib/workouts/adjust";

const entries = [
  { category: "WARMUP", exercises: [] },
  { category: "WEIGHTS", muscleGroup: "LEGS", exercises: [{ poolExerciseId: "squat", name: "Back squat" }, { poolExerciseId: "lunge", name: "Sandbag lunge" }] },
  { category: "WEIGHTS", muscleGroup: "CHEST", exercises: [{ poolExerciseId: "bench", name: "Bench press" }, { poolExerciseId: "curl", name: "Dumbbell curl" }] },
  { category: "WEIGHTS", core: true, exercises: [{ poolExerciseId: "plank", name: "Plank" }] },
  { category: "HIIT", parts: ["Burpee", "Kettlebell swing"], exercises: [{ poolExerciseId: "" }] },
  { category: "CARDIO", exercises: [] },
];
const kept = (k: { keep: string[]; stays: boolean }[]) => k.map((x) => (x.stays ? x.keep : null));

describe("adjust today (v0.658)", () => {
  it("low energy keeps everything", () => {
    expect(kept(adjustKeep({ mode: "low" }, entries))).toEqual([[], ["squat", "lunge"], ["bench", "curl"], ["plank"], [""], []]);
  });
  it("sick: lighter keeps main lifts; easy keeps no lifting", () => {
    expect(kept(adjustKeep({ mode: "sick", how: "light" }, entries))).toEqual([[], ["squat"], ["bench"], null, null, []]);
    expect(kept(adjustKeep({ mode: "sick", how: "easy" }, entries))).toEqual([[], null, null, null, null, []]);
  });
  it("hurt drops what loads the area", () => {
    expect(loadsArea("KNEE", "Back squat")).toBe(true);
    expect(loadsArea("KNEE", "Bench press", "CHEST")).toBe(false);
    expect(kept(adjustKeep({ mode: "hurt", area: "KNEE" }, entries))).toEqual([[], null, ["bench", "curl"], ["plank"], null, []]);
    // A stand-in keeps the movement it replaces (done as its swap, v0.675).
    expect(kept(adjustKeep({ mode: "hurt", area: "KNEE", swaps: [{ from: "squat", to: "rdl", name: "Romanian deadlift" }] }, entries))[1]).toEqual(["squat"]);
    expect(loadsArea("NECK", "Barbell shrug")).toBe(true);
  });
  it("picks stand-ins from recent lifts: same group, then same half, never one that loads the area", () => {
    const cands = [
      { id: "lp", name: "Leg press", group: "LEGS", times: 9 },
      { id: "rdl", name: "Romanian deadlift", group: "DEADLIFT", times: 4 },
      { id: "ht", name: "Hip thrust", group: "LEGS", times: 2 },
      { id: "bench", name: "Bench press", group: "CHEST", times: 12 },
      { id: "plank", name: "Plank", group: "CORE", times: 6 },
    ];
    const swaps = pickStandIns("KNEE", [{ id: "squat", group: "LEGS" }, { id: "lunge", group: "LEGS" }, { id: "ext", group: "LEGS" }], cands, ["squat", "lunge", "ext", "plank"]);
    // Leg press loads the knee; the hip thrust is LEGS and doesn't by name, but
    // LEGS as a group loads the knee, so the deadlift-group RDL goes first.
    expect(swaps.map((s) => s.to)).toEqual(["rdl", "bench"]);
  });
  it("short on time keeps what fitted and the picked kinds", () => {
    const a = cleanAdjust({ mode: "time", minutes: 30, picks: ["weights", "conditioning"], keep: ["bench"] }, true)!;
    expect(kept(adjustKeep(a, entries))).toEqual([[], null, ["bench"], null, [""], null]);
    // A request never carries what's kept.
    expect(cleanAdjust({ mode: "time", minutes: 30, picks: ["weights"], keep: ["bench"] })).toMatchObject({ keep: [] });
    expect(cleanAdjust({ mode: "time", minutes: 20, picks: ["weights"] })).toBeNull();
  });
  it("stores and reads it back, and reads old Go light answers", () => {
    expect(parseAdjust(adjustAnswer({ mode: "hurt", area: "LOWER_BACK" }))).toEqual({ mode: "hurt", area: "LOWER_BACK", replace: true });
    // Areas stored before v0.675 read as the new ones.
    expect(parseAdjust('adj:{"mode":"hurt","area":"back"}')).toEqual({ mode: "hurt", area: "LOWER_BACK", replace: true });
    expect(parseAdjust("go:lighter:20")).toEqual({ mode: "low" });
    expect(parseAdjust("go:recovery:0")).toEqual({ mode: "sick", how: "easy" });
    expect(parseAdjust("light")).toBeNull();
    expect(adjustLabel({ mode: "time", minutes: 30, picks: ["weights"], cardioMin: 0, keep: [], supp: false, total: 26 })).toBe(
      "Short on time · 30 min",
    );
  });
});

const lifts: LiftIn[] = [
  { id: "bench", name: "Bench press", main: true, warmSets: 3, workSets: 3, suppSets: 5 },
  { id: "fly", name: "Dumbbell fly", main: false, warmSets: 0, workSets: 3, suppSets: 0 },
];
const base = { lifts, perSet: 3, perWarm: 1, cardioMin: 0, conditioning: { name: "EMOM 8", minutes: 8 } };

describe("short on time", () => {
  it("never cuts the warm-up or the main lift's warm-up sets; extras go first", () => {
    const p = planShort({ ...base, minutes: 30, picks: ["weights", "conditioning"] });
    expect(p.fits).toBe(true);
    expect(p.keep).toEqual(["bench"]);
    expect(p.supp).toBe(false);
    expect(p.items[0].label).toBe("Quick warm-up + Shoulder prep");
    expect(p.items.map((i) => i.label)).toContain("Bench press · 3 warm-up sets");
    expect(p.total).toBe(6 + 3 + 9 + 8);
  });
  it("says when it can't fit and how to fix it", () => {
    const p = planShort({ ...base, perSet: 2, perWarm: 0.75, minutes: 15, picks: ["weights", "conditioning"] });
    expect(p.fits).toBe(false);
    expect(p.need).toBe(22);
    expect(p.fixes.map((f) => f.label)).toEqual(["Drop conditioning", "Make it 30 min"]);
  });
  it("fits more with more time", () => {
    const p = planShort({ ...base, minutes: 45, picks: ["weights"] });
    expect(p.keep).toEqual(["bench", "fly"]);
  });
  it("learns the time per set", () => {
    expect(perSetFrom([60, 70])).toEqual({ perSet: 2.5, perWarm: 1 });
    expect(perSetFrom(Array(20).fill(120)).perSet).toBe(2);
  });
});
