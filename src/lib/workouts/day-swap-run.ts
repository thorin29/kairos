import "server-only";
import { getSetting, setSetting } from "@/lib/settings";
import { addDays, dayOfWeek, todayISO } from "@/lib/dates";
import { mondayOfWeek, parseSwaps, planWeekday, withSwap, withoutSwap, type DaySwap } from "@/lib/workouts/day-swap";

/** Swapped days (v0.677), kept per person in a setting; past weeks drop off. */
const key = (userId: string) => `workouts.swap.${userId}`;

export async function swapsFor(userId: string): Promise<DaySwap[]> {
  // Kept a few weeks back so history days still read the plan they followed.
  return parseSwaps(await getSetting(key(userId)), addDays(mondayOfWeek(todayISO()), -28));
}

/** The weekday whose plan a person's day follows. */
export async function planDow(userId: string, iso: string): Promise<number> {
  return planWeekday(await swapsFor(userId), iso);
}

/** Trade this day's plan with another weekday's, for this week only. */
export async function swapDays(userId: string, iso: string, withDow: number): Promise<void> {
  const dow = dayOfWeek(iso);
  if (withDow === dow || withDow < 0 || withDow > 6) return;
  const list = withSwap(await swapsFor(userId), { week: mondayOfWeek(iso), a: dow, b: withDow });
  await setSetting(key(userId), JSON.stringify(list));
}

export async function unswapDay(userId: string, iso: string): Promise<void> {
  await setSetting(key(userId), JSON.stringify(withoutSwap(await swapsFor(userId), iso)));
}
