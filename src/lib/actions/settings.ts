"use server";

import { revalidatePath } from "next/cache";
import { TaskStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { SCORING_START, SEASON_MODE, SEASON_WEEKS, SEASON_ANCHOR, SEASON_WEEKS_MAX, setSetting } from "@/lib/settings";
import { toDateColumn, todayISO } from "@/lib/dates";
import { isAdmin } from "@/lib/session";

/**
 * A family reset: start scoring fresh from today and clear the overdue-chore
 * backlog, without touching schedules, assignments, workouts or the money
 * ledger. Meant for after a testing period, or after an unplanned break when
 * the past-due list needs wiping so the boards read clean.
 *
 * It does two things and only two things:
 *   1. Moves the scoring-start pointer to today. Everything derived from that
 *      window — the fairness scores, and the character levels, stats, streaks,
 *      badges and season that read from the same line — starts over from now,
 *      so a testing period is wiped along with the progression it produced.
 *      Nothing is deleted: the task history stays, it just stops counting.
 *   2. Excuses every still-pending chore dated before today. They become
 *      "skipped" — out of the score and off the overdue/up-for-grabs lists —
 *      exactly as a paused day's chores are. Future and today's chores, and
 *      everything already done, are left alone.
 *
 * The money ledger is real data, not derived from this window, so rewards and
 * balances are entirely unaffected.
 */
export async function resetScoring(): Promise<{ error: string | null }> {
  if (!(await isAdmin())) {
    return { error: "Only a parent can do that. Switch profiles first." };
  }

  const today = todayISO();

  await prisma.$transaction([
    // Start scores from today.
    prisma.appSetting.upsert({
      where: { key: SCORING_START },
      update: { value: today },
      create: { key: SCORING_START, value: today },
    }),
    // Excuse the overdue chore backlog (chores only — workouts keep their own
    // overdue window). Includes released ones so the up-for-grabs list clears
    // too. Anything complete stays complete; nothing dated today or later is
    // touched.
    prisma.task.updateMany({
      where: {
        status: TaskStatus.PENDING,
        choreId: { not: null },
        dueDate: { lt: toDateColumn(today) },
      },
      data: { status: TaskStatus.SKIPPED, isOpen: false },
    }),
  ]);

  revalidatePath("/");
  revalidatePath("/setup");
  revalidatePath("/summary");
  revalidatePath("/chores");
  return { error: null };
}

/**
 * Set how long a season runs. "month" follows the calendar; "weeks" runs fixed
 * N-week seasons anchored to today, so a lighter workload can run a longer
 * season and still reach a fuller ladder. Only the season tier ladder is
 * affected — character levels and stats are untouched.
 */
export async function setSeasonLength(
  mode: "month" | "weeks",
  weeks: number,
): Promise<{ error: string | null }> {
  if (!(await isAdmin())) {
    return { error: "Only a parent can change this. Switch profiles first." };
  }

  if (mode === "weeks") {
    const n = Math.min(SEASON_WEEKS_MAX, Math.max(1, Math.round(weeks)));
    await Promise.all([
      setSetting(SEASON_MODE, "weeks"),
      setSetting(SEASON_WEEKS, String(n)),
      // Anchor the season to today so the new length takes effect from now.
      setSetting(SEASON_ANCHOR, todayISO()),
    ]);
  } else {
    await setSetting(SEASON_MODE, "month");
  }

  revalidatePath("/summary");
  revalidatePath("/admin/season");
  return { error: null };
}
