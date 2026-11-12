/**
 * Swapped days (v0.677): two weekdays' plans traded for one week — the leg
 * day moved away from a game, say. Every place that finds a day's plan by
 * weekday goes through `planWeekday`, so the swap shows everywhere (the day
 * page, the strip, workout tasks, the dashboard) and ends with the week on its
 * own. Weeks start on Monday. Pure.
 */
import { addDays, dayOfWeek } from "@/lib/dates";

export type DaySwap = {
  /** The Monday of the week it applies to. */
  week: string;
  a: number;
  b: number;
};

export const mondayOfWeek = (iso: string) => addDays(iso, -((dayOfWeek(iso) + 6) % 7));

/** The weekday whose plan this day follows. */
export function planWeekday(swaps: readonly DaySwap[] | null | undefined, iso: string): number {
  const dow = dayOfWeek(iso);
  const week = mondayOfWeek(iso);
  const s = (swaps ?? []).find((x) => x.week === week && (x.a === dow || x.b === dow));
  return s ? (s.a === dow ? s.b : s.a) : dow;
}

/** The weekday this day is swapped with this week, or null. */
export function swappedWith(swaps: readonly DaySwap[] | null | undefined, iso: string): number | null {
  const w = planWeekday(swaps, iso);
  return w === dayOfWeek(iso) ? null : w;
}

const isDow = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= 6;

/** Stored swaps read back; weeks before `fromWeek` are dropped. */
export function parseSwaps(raw: string | null | undefined, fromWeek?: string): DaySwap[] {
  if (!raw) return [];
  try {
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    return list.filter(
      (x): x is DaySwap =>
        !!x &&
        typeof x.week === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(x.week) &&
        isDow(x.a) &&
        isDow(x.b) &&
        x.a !== x.b &&
        (!fromWeek || x.week >= fromWeek),
    );
  } catch {
    return [];
  }
}

/** Swap two days this week; either day's earlier swap that week is replaced. */
export function withSwap(list: readonly DaySwap[], swap: DaySwap): DaySwap[] {
  const keep = list.filter((x) => !(x.week === swap.week && [x.a, x.b].some((d) => d === swap.a || d === swap.b)));
  return [...keep, swap];
}

/** Undo: the day's swap that week is gone (both days go back). */
export function withoutSwap(list: readonly DaySwap[], iso: string): DaySwap[] {
  const week = mondayOfWeek(iso);
  const dow = dayOfWeek(iso);
  return list.filter((x) => !(x.week === week && (x.a === dow || x.b === dow)));
}

const WEEKDAY_NAME = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
/** "Thursday" for a day swapped with Thursday this week, else null. */
export function swapName(swaps: readonly DaySwap[] | null | undefined, iso: string): string | null {
  const w = swappedWith(swaps, iso);
  return w == null ? null : WEEKDAY_NAME[w];
}
