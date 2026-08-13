/**
 * Streak arithmetic, kept pure and dependency-free so it can be unit-reasoned
 * about without a database.
 *
 * A streak is a run of "perfect" days — days where everything assigned got
 * done. The rules that make it humane:
 *
 *   - A day only *breaks* a streak when something assigned that day actually
 *     expired unfinished (a real miss). Being late but still catching up never
 *     breaks it — that day is neutral until the work either lands or expires.
 *   - A day with nothing to do (a rest day, a quiet Sunday) is neutral too: it
 *     can't be a miss, so it bridges a streak rather than ending or padding it.
 *   - Only days where the assigned work was completed count toward the length,
 *     so "a 12-day streak" means twelve days of actually getting everything
 *     done, possibly spanning a rest day or two.
 *
 * This all reads from raw completion history, never the scoring window, which
 * is exactly why a scoring reset leaves streaks untouched.
 */

export const STREAK_MILESTONES = [7, 30, 100] as const;

/** clean = everything done; miss = something expired unfinished; neutral =
 *  nothing due, or work still in flight (bridges without counting). */
export type DayClass = "clean" | "miss" | "neutral";

export type StreakResult = {
  /** Perfect days in the current unbroken run, ending at today. */
  current: number;
  /** The best run ever reached. */
  longest: number;
};

/** `days` ascending, oldest first. */
export function computeStreaks(days: DayClass[]): StreakResult {
  let run = 0;
  let longest = 0;
  for (const d of days) {
    if (d === "miss") run = 0;
    else if (d === "clean") {
      run += 1;
      if (run > longest) longest = run;
    }
    // neutral: bridge, leave the run as-is.
  }

  let current = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    const d = days[i];
    if (d === "miss") break;
    if (d === "clean") current += 1;
    // neutral: keep walking back.
  }

  return { current, longest };
}

/** Milestone thresholds a longest-streak has reached. */
export function earnedMilestones(longest: number): number[] {
  return STREAK_MILESTONES.filter((m) => longest >= m);
}
