"use server";

import { revalidatePath } from "next/cache";
import { isAdmin, currentAdmin } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { parseAmountToCents } from "@/lib/money";
import {
  setSetting,
  BIBLE_BONUS_CENTS,
  BIBLE_GRACE_DAYS,
  BIBLE_GRACE_MAX,
} from "@/lib/settings";
import {
  approveBibleBaseCore,
  approveBibleMonthAllCore,
} from "@/lib/bible-rewards";

export type RewardActionState = { error: string | null; ok?: boolean };

function refresh() {
  revalidatePath("/admin/money");
  revalidatePath("/money");
  revalidatePath("/");
}

/**
 * Save the reward setup: each person's opt-in and amount, plus the household
 * bonus and grace period. Amounts arrive as dollar strings and are stored as
 * whole cents.
 */
export async function saveBibleRewardConfig(
  _prev: RewardActionState,
  fd: FormData,
): Promise<RewardActionState> {
  if (!(await isAdmin())) {
    return { error: "Only an admin can change reward settings." };
  }

  const ids = fd.getAll("userId").map(String);
  for (const id of ids) {
    const enabled = fd.get(`enabled:${id}`) != null;
    const amountRaw = String(fd.get(`amount:${id}`) ?? "").trim();
    const cents = amountRaw ? parseAmountToCents(amountRaw) : 0;
    if (cents === null || cents < 0) {
      return { error: "One of the reward amounts isn't a valid dollar value." };
    }
    await prisma.user.update({
      where: { id },
      data: { bibleRewardEnabled: enabled, bibleRewardCents: cents },
    });
  }

  const bonusRaw = String(fd.get("bonusAmount") ?? "").trim();
  const bonusCents = bonusRaw ? parseAmountToCents(bonusRaw) : 0;
  if (bonusCents === null || bonusCents < 0) {
    return { error: "The bonus amount isn't a valid dollar value." };
  }
  await setSetting(BIBLE_BONUS_CENTS, String(bonusCents));

  const graceRaw = String(fd.get("graceDays") ?? "").trim();
  let grace = Number.parseInt(graceRaw, 10);
  if (!Number.isFinite(grace)) grace = 0;
  grace = Math.min(BIBLE_GRACE_MAX, Math.max(0, grace));
  await setSetting(BIBLE_GRACE_DAYS, String(grace));

  refresh();
  return { error: null, ok: true };
}

/** Approve one person's base reward for a month. Admin only. The eligibility
 *  re-check lives in the shared core; this adds the web session gate + refresh. */
export async function approveBibleBase(
  userId: string,
  periodKey: string,
): Promise<void> {
  if (!(await isAdmin())) throw new Error("Admin only.");
  const admin = await currentAdmin();
  await approveBibleBaseCore(userId, periodKey, admin?.id ?? null);
  refresh();
}

/**
 * Approve a whole month at once: base for every finisher who hasn't been paid,
 * and — when everyone finished within grace — the group bonus on top for each.
 * This is the single "approve all + bonus" action; it's idempotent, so it can
 * also top up a month whose bases were approved individually earlier. Admin only.
 */
export async function approveBibleMonthAll(periodKey: string): Promise<void> {
  if (!(await isAdmin())) throw new Error("Admin only.");
  const admin = await currentAdmin();
  await approveBibleMonthAllCore(periodKey, admin?.id ?? null);
  refresh();
}
