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
  userFinishedMonth,
  monthBonusAvailable,
  monthEndDate,
  pendingBibleRewards,
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

/** Create one auto-approved reward row, unless one already exists for that
 *  person/month/kind. The unique index is the real guard; this keeps the
 *  action idempotent and quiet on a repeat click. */
async function postReward(
  userId: string,
  periodKey: string,
  kind: "BIBLE_REWARD" | "BIBLE_BONUS",
  amountCents: number,
  detail: string,
  approverId: string | null,
) {
  if (amountCents <= 0) return;
  const exists = await prisma.moneyEntry.findFirst({
    where: { userId, kind, periodKey },
    select: { id: true },
  });
  if (exists) return;
  await prisma.moneyEntry.create({
    data: {
      userId,
      date: monthEndDate(periodKey),
      direction: "DEPOSIT",
      category: "BIBLE",
      detail,
      amountCents,
      kind,
      periodKey,
      status: "APPROVED",
      approvedById: approverId,
      approvedAt: new Date(),
    },
  });
}

/** Approve one person's base reward for a month. Admin only. Re-checks that
 *  the month is actually finished before paying. */
export async function approveBibleBase(
  userId: string,
  periodKey: string,
): Promise<void> {
  if (!(await isAdmin())) throw new Error("Admin only.");
  if (!/^\d{4}-\d{2}$/.test(periodKey)) return;

  const finished = await userFinishedMonth(userId, periodKey);
  if (!finished) return;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { bibleRewardCents: true, bibleRewardEnabled: true },
  });
  if (!user || !user.bibleRewardEnabled) return;

  const admin = await currentAdmin();
  await postReward(
    userId,
    periodKey,
    "BIBLE_REWARD",
    user.bibleRewardCents,
    "Finished the month's Bible reading",
    admin?.id ?? null,
  );
  refresh();
}

/**
 * Approve a whole month at once: base for every finisher who hasn't been paid,
 * and — when everyone finished within grace — the group bonus on top for each.
 * This is the single "approve all + bonus" action; it's idempotent, so it can
 * also top up a month whose bases were approved individually earlier.
 */
export async function approveBibleMonthAll(periodKey: string): Promise<void> {
  if (!(await isAdmin())) throw new Error("Admin only.");
  if (!/^\d{4}-\d{2}$/.test(periodKey)) return;

  const { months } = await pendingBibleRewards();
  const month = months.find((m) => m.periodKey === periodKey);
  // Nothing outstanding for this month.
  if (!month) return;

  const admin = await currentAdmin();
  const bonusOk = month.bonusAvailable && (await monthBonusAvailable(periodKey));

  for (const c of month.completers) {
    await postReward(
      c.userId,
      periodKey,
      "BIBLE_REWARD",
      c.baseCents,
      "Finished the month's Bible reading",
      admin?.id ?? null,
    );
    if (bonusOk) {
      await postReward(
        c.userId,
        periodKey,
        "BIBLE_BONUS",
        month.bonusCents,
        "Everyone finished — group bonus",
        admin?.id ?? null,
      );
    }
  }
  refresh();
}
