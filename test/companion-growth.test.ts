import { describe, expect, it } from "vitest";
import {
  growthSince,
  growthMix,
  dayCredit,
  creditBetween,
  emptyDay,
  recentCompletion,
  luckFromCompletion,
  fmtGrowth,
  type DayBucket,
  type WeekBucket,
  type StatKey,
} from "@/lib/companions-growth";
import { companionPhase, CLEAN_DAY_STAGES } from "@/lib/companions";
import { growthRow } from "@/lib/scoring/growth-cells";

// Made-up histories only; no household data. The rules: docs/SCORING.md.

const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const START = "2026-08-03"; // a Monday

function rng(seed: number) {
  let s = seed;
  return () => ((s = (s * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
}

/** One day: `n` tasks of the given efforts, `done` of them finished. */
function day(efforts: number[], doneFlags: boolean[], stats: StatKey[]): DayBucket {
  const b = emptyDay();
  efforts.forEach((e, i) => {
    b.assigned += 1;
    b.effort += e;
    if (doneFlags[i]) {
      b.complete += 1;
      b.effortDone += e;
      b.doneByStat[stats[i]] += e;
    } else b.missed += 1;
  });
  return b;
}

/** 70 days of a kid-sized list (chores 1-5, Bible, school), finished at `rate`. */
function history(rand: () => number, rate: number) {
  const days = new Map<string, DayBucket>();
  const weeks = new Map<string, WeekBucket>();
  const stats: StatKey[] = ["CHORE", "CHORE", "CHORE", "BIBLE", "SCHOOL", "SCHOOL", "EXERCISE"];
  for (let i = 0; i < 70; i++) {
    const iso = addDays(START, i);
    const efforts = [1 + Math.floor(rand() * 5), 2, 1, 1, 1, 1, 1];
    const done = efforts.map(() => rand() < rate);
    const b = day(efforts, done, stats);
    days.set(iso, b);
    const wk = addDays(START, i - (i % 7));
    const w = weeks.get(wk) ?? { assigned: 0, complete: 0 };
    w.assigned += b.effort;
    w.complete += b.effortDone;
    weeks.set(wk, w);
  }
  return { days, weeks };
}

/** The rule before 0.603: a day counted 1 only if everything was finished. */
function oldGrowth(days: Map<string, DayBucket>, weeks: Map<string, WeekBucket>, from: string, today: string) {
  let g = 0;
  for (const [iso, b] of days)
    if (iso >= from && iso < today && b.missed === 0 && b.complete === b.assigned && b.assigned > 0) g += 1;
  for (const [wk, b] of weeks) {
    const end = addDays(wk, 6);
    if (end >= from && end < today && b.assigned > 0 && b.complete === b.assigned) g += 2;
  }
  return g;
}

describe("what a day is worth", () => {
  it("is the share of the day's effort finished", () => {
    expect(dayCredit(day([5, 1, 1, 1], [true, true, true, true], ["CHORE", "BIBLE", "SCHOOL", "TASK"]))).toBe(1);
    expect(dayCredit(day([5, 1, 1, 1], [true, false, true, true], ["CHORE", "BIBLE", "SCHOOL", "TASK"]))).toBe(0.875);
    expect(dayCredit(emptyDay())).toBe(0);
  });

  it("today counts live in what's shown, and never in what's banked", () => {
    const today = "2026-08-10";
    const days = new Map([
      ["2026-08-09", day([1, 1], [true, true], ["CHORE", "BIBLE"])],
      [today, day([1, 1], [true, false], ["CHORE", "BIBLE"])],
    ]);
    expect(growthSince(days, new Map(), "2026-08-01", today, true)).toBe(1.5);
    expect(growthSince(days, new Map(), "2026-08-01", today, false)).toBe(1);
  });

  it("never gives anyone less than the old all-or-nothing rule (no character shrinks on update)", () => {
    for (let seed = 1; seed <= 300; seed++) {
      const r = rng(seed);
      const { days, weeks } = history(r, 0.5 + r() * 0.5);
      const today = addDays(START, 70);
      for (const from of [START, addDays(START, 9), addDays(START, 33)]) {
        expect(growthSince(days, weeks, from, today)).toBeGreaterThanOrEqual(oldGrowth(days, weeks, from, today) - 1e-9);
      }
    }
  });
});

describe("switching characters", () => {
  it("never loses or double-counts growth, even mid-day with today live", () => {
    for (let seed = 1; seed <= 300; seed++) {
      const r = rng(seed);
      const { days, weeks } = history(r, 0.6 + r() * 0.4);
      const shown = (from: string, today: string) => growthSince(days, weeks, from, today, true);
      const settled = (from: string, today: string) => growthSince(days, weeks, from, today, false);
      const comps = [
        { banked: 0, tenure: START as string | null },
        { banked: 0, tenure: null as string | null },
        { banked: 0, tenure: null as string | null },
      ];
      let active = 0;
      for (let i = 1; i < 69; i++) {
        const today = addDays(START, i);
        // Sometimes two or three switches in one day.
        const switches = r() < 0.3 ? 1 + Math.floor(r() * 3) : 0;
        for (let k = 0; k < switches; k++) {
          const next = (active + 1 + Math.floor(r() * 2)) % 3;
          const cur = comps[active];
          cur.banked += settled(cur.tenure!, today); // retire: settled only
          cur.tenure = null;
          comps[next].tenure = today;
          active = next;
        }
      }
      const today = addDays(START, 69);
      const live = comps[active].banked + shown(comps[active].tenure!, today);
      const shelved = comps.reduce((n, c, i) => (i === active ? n : n + c.banked), 0);
      expect(live + shelved).toBeCloseTo(shown(START, today), 9);
    }
  });
});

describe("eggs come after growing, never during", () => {
  it("no egg while growing, at any growth below adult", () => {
    for (let g = 0; g < CLEAN_DAY_STAGES[2]; g += 0.1) {
      const ph = companionPhase({ growth: g, deepenGrowth: 0, deepening: false, shiny: false });
      expect(ph.phase).toBe("growing");
      expect(ph.eggReady).toBe(false);
    }
    const adult = companionPhase({ growth: CLEAN_DAY_STAGES[2], deepenGrowth: 0, deepening: false, shiny: false });
    expect(adult.eggReady).toBe(true);
  });
  it("no egg while deepening until the glow", () => {
    const mid = companionPhase({ growth: 20, deepenGrowth: 3, deepening: true, shiny: false });
    expect(mid.eggReady).toBe(false);
    const done = companionPhase({ growth: 20, deepenGrowth: 6, deepening: true, shiny: false });
    expect(done.eggReady).toBe(true);
  });
});

describe("the row of squares", () => {
  const mix = { CHORE: 0.5, EXERCISE: 0, BIBLE: 0.25, SCHOOL: 0.25, TASK: 0 };
  it("fills toward adult, coloured by what earned it, today lighter", () => {
    const row = growthRow({ active: true, phase: "growing", growth: 6, pendingGrowth: 0.6, phaseGoal: 12, phaseProgress: 6, growthMix: mix });
    const filled = row.cells.filter(Boolean);
    expect(filled).toHaveLength(10);
    expect(filled.filter((c) => c === "#22c55e")).toHaveLength(5);
    expect(row.pendingFrom).toBe(9);
    expect(row.label).toBe("6 / 12");
    expect(row.gaps).toEqual([10]);
  });
  it("is full and unlabelled once adult", () => {
    const row = growthRow({ active: true, phase: "adult", growth: 15, pendingGrowth: 1, phaseGoal: null, phaseProgress: 0, growthMix: mix });
    expect(row.cells.filter(Boolean)).toHaveLength(20);
    expect(row.pendingFrom).toBe(20);
    expect(row.label).toBeNull();
  });
});

describe("month, mix and luck", () => {
  it("adds up days of work in a month, today included", () => {
    const days = new Map([
      ["2026-07-31", day([1], [true], ["CHORE"])],
      ["2026-08-01", day([1, 1], [true, false], ["CHORE", "BIBLE"])],
      ["2026-08-02", day([2], [true], ["CHORE"])],
      ["2026-08-03", day([1], [true], ["CHORE"])],
    ]);
    expect(creditBetween(days, "2026-08-01", "2026-08-31", "2026-08-02")).toBe(1.5);
  });
  it("mix shares sum to 1", () => {
    const { days } = history(rng(3), 0.8);
    const m = growthMix(days, START, addDays(START, 70));
    expect(Object.values(m).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9);
  });
  it("luck rises with recent completion, not a streak", () => {
    expect(luckFromCompletion(0.5)).toBe(0);
    expect(luckFromCompletion(0.8)).toBeCloseTo(0.6, 9);
    expect(luckFromCompletion(1)).toBe(1);
    const days = new Map([["2026-08-09", day([1, 1], [true, false], ["CHORE", "BIBLE"])]]);
    expect(recentCompletion(days, "2026-08-10")).toBe(0.5);
  });
  it("formats growth with one decimal, rounded down", () => {
    expect(fmtGrowth(7.46)).toBe("7.4");
    expect(fmtGrowth(12)).toBe("12");
    expect(fmtGrowth(0.99)).toBe("0.9");
  });
});
