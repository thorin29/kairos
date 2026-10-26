import { describe, expect, it } from "vitest";
import {
  growthSince,
  type DayBucket,
  type WeekBucket,
} from "@/lib/companions-growth";

// Pure replay of the shelf model (retire banks, activate resumes) over many
// made-up histories. No household data.

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

/** 70 days of chores: each day clean or not; a week perfect when all 7 are. */
function history(rand: () => number) {
  const days = new Map<string, DayBucket>();
  const weeks = new Map<string, WeekBucket>();
  for (let i = 0; i < 70; i++) {
    const iso = addDays(START, i);
    const clean = rand() < 0.8;
    days.set(iso, { assigned: 3, complete: clean ? 3 : 2, missed: clean ? 0 : 1 });
    const wk = addDays(START, i - (i % 7));
    const w = weeks.get(wk) ?? { assigned: 0, complete: 0 };
    w.assigned += 3;
    w.complete += clean ? 3 : 2;
    weeks.set(wk, w);
  }
  return { days, weeks };
}

type Comp = { banked: number; tenure: string | null };

/** Swap on random days; the live read and retire use `growth(from, today)`. */
function replay(
  rand: () => number,
  days: Map<string, DayBucket>,
  weeks: Map<string, WeekBucket>,
  growth: (from: string, today: string) => number,
  tenureFor: (day: string, evening: boolean) => string,
) {
  const comps: Comp[] = [{ banked: 0, tenure: START }, { banked: 0, tenure: null }, { banked: 0, tenure: null }];
  let active = 0;
  for (let i = 1; i < 69; i++) {
    if (rand() < 0.25) {
      const today = addDays(START, i);
      const next = (active + 1 + Math.floor(rand() * 2)) % 3;
      const cur = comps[active];
      cur.banked += growth(cur.tenure!, today);
      cur.tenure = null;
      comps[next].tenure = tenureFor(today, rand() < 0.5);
      active = next;
    }
  }
  const today = addDays(START, 69);
  const live = comps[active].banked + growth(comps[active].tenure!, today);
  const shelved = comps.reduce((n, c, i) => (i === active ? n : n + c.banked), 0);
  return { live, shelved, earned: growthSince(days, weeks, START, today) };
}

describe("companion growth across gallery swaps", () => {
  it("never loses or invents growth, whatever the swaps", () => {
    for (let seed = 1; seed <= 200; seed++) {
      const r = rng(seed);
      const { days, weeks } = history(r);
      const g = (from: string, today: string) => growthSince(days, weeks, from, today);
      const { live, shelved, earned } = replay(r, days, weeks, g, (day) => day);
      expect(live + shelved).toBe(earned);
    }
  });

  it("the old rules dropped growth", () => {
    // Old: a week counted only if it STARTED in the tenure; an evening swap
    // started the tenure the next (UTC) day.
    let lostSomewhere = false;
    for (let seed = 1; seed <= 200; seed++) {
      const r = rng(seed);
      const { days, weeks } = history(r);
      const old = (from: string, today: string) => {
        let n = 0;
        for (const [iso, b] of days)
          if (iso >= from && iso < today && b.missed === 0 && b.complete === b.assigned) n += 1;
        for (const [wk, b] of weeks)
          if (wk >= from && addDays(wk, 6) < today && b.complete === b.assigned) n += 2;
        return n;
      };
      const { live, shelved, earned } = replay(r, days, weeks, old, (day, evening) =>
        evening ? addDays(day, 1) : day,
      );
      if (live + shelved < earned) lostSomewhere = true;
      expect(live + shelved).toBeLessThanOrEqual(earned);
    }
    expect(lostSomewhere).toBe(true);
  });

  it("an evening swap keeps the day, and a mid-week swap keeps the week", () => {
    const days = new Map<string, DayBucket>();
    const weeks = new Map<string, WeekBucket>([["2026-08-03", { assigned: 21, complete: 21 }]]);
    for (let i = 0; i < 7; i++) days.set(addDays(START, i), { assigned: 3, complete: 3, missed: 0 });
    // Swapped on Thursday: the old one banks Mon–Wed, the new one gets Thu–Sun
    // and the finished week.
    const before = growthSince(days, weeks, START, "2026-08-06");
    const after = growthSince(days, weeks, "2026-08-06", "2026-08-10");
    expect(before).toBe(3);
    expect(after).toBe(4 + 2);
    expect(before + after).toBe(growthSince(days, weeks, START, "2026-08-10"));
  });
});
