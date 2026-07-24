"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { toDateColumn, todayISO, weekDays } from "@/lib/dates";
import { isAdmin, requireAdmin } from "@/lib/session";

export type PlayState = { error: string | null };

/**
 * Logs time played. Going over the allowance is recorded rather than
 * blocked — the point is an honest picture of the day, and refusing the
 * entry would just teach everyone not to log the last twenty minutes.
 */
export async function logPlay(
  userId: string,
  minutes: number,
  useToken: boolean,
): Promise<PlayState> {
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 600) {
    return { error: "That isn't a sensible number of minutes." };
  }

  const profile = await prisma.gameProfile.findUnique({ where: { userId } });
  if (!profile?.isActive) {
    return { error: "Game time isn't set up for them yet." };
  }

  if (useToken) {
    const week = weekDays(todayISO());
    const spent = await prisma.gameSession.count({
      where: {
        userId,
        usedToken: true,
        day: { gte: toDateColumn(week[0]), lte: toDateColumn(week[6]) },
      },
    });

    if (spent >= profile.weeklyTokens) {
      return { error: "No tokens left this week." };
    }
  }

  await prisma.gameSession.create({
    data: {
      userId,
      day: toDateColumn(todayISO()),
      minutes,
      usedToken: useToken,
    },
  });

  revalidatePath("/");
  revalidatePath("/games");
  revalidatePath(`/person/${userId}`);
  return { error: null };
}

/** Mis-taps happen; undoing one shouldn't need a parent. */
export async function removeSession(id: string): Promise<void> {
  const session = await prisma.gameSession.findUnique({ where: { id } });
  if (!session) return;

  await prisma.gameSession.delete({ where: { id } });

  revalidatePath("/");
  revalidatePath("/games");
  revalidatePath(`/person/${session.userId}`);
}

export type GameSettingsState = { error: string | null; saved: boolean };

export async function saveGameProfile(
  _prev: GameSettingsState,
  formData: FormData,
): Promise<GameSettingsState> {
  if (!(await isAdmin())) {
    return { error: "Only a parent can change this.", saved: false };
  }

  const userId = String(formData.get("userId") ?? "");
  const enabled = formData.get("enabled") === "on";
  const dailyMinutes = Number(formData.get("dailyMinutes"));
  const weeklyTokens = Number(formData.get("weeklyTokens"));
  const tokenMinutes = Number(formData.get("tokenMinutes"));

  const bounds: [number, number, number][] = [
    [dailyMinutes, 0, 600],
    [weeklyTokens, 0, 21],
    [tokenMinutes, 0, 240],
  ];

  if (bounds.some(([v, lo, hi]) => !Number.isInteger(v) || v < lo || v > hi)) {
    return { error: "Check the numbers — one is out of range.", saved: false };
  }

  const data = { dailyMinutes, weeklyTokens, tokenMinutes, isActive: enabled };

  await prisma.gameProfile.upsert({
    where: { userId },
    update: data,
    create: { userId, ...data },
  });

  revalidatePath("/admin/games");
  revalidatePath("/games");
  revalidatePath("/");
  return { error: null, saved: true };
}

/**
 * Hands someone an extra token for the week by refunding one already spent.
 * Crude, but it keeps tokens as a single countable thing rather than
 * introducing a separate balance to reconcile.
 */
export async function grantToken(userId: string): Promise<void> {
  await requireAdmin();

  const week = weekDays(todayISO());
  const spent = await prisma.gameSession.findFirst({
    where: {
      userId,
      usedToken: true,
      day: { gte: toDateColumn(week[0]), lte: toDateColumn(week[6]) },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!spent) return;

  await prisma.gameSession.update({
    where: { id: spent.id },
    data: { usedToken: false },
  });

  revalidatePath("/games");
  revalidatePath("/admin/games");
}
