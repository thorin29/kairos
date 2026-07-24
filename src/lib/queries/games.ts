import "server-only";
import { prisma } from "@/lib/prisma";
import { toDateColumn, weekDays } from "@/lib/dates";

export type GameStatus = {
  userId: string;
  name: string;
  color: string;
  avatarPath: string | null;
  enabled: boolean;

  dailyMinutes: number;
  tokenMinutes: number;
  weeklyTokens: number;

  /** Minutes played today, and what today's ceiling actually is. */
  usedToday: number;
  allowanceToday: number;
  remainingToday: number;

  tokensUsedThisWeek: number;
  tokensLeft: number;

  usedThisWeek: number;
};

const DEFAULTS = { dailyMinutes: 60, weeklyTokens: 3, tokenMinutes: 20 };

/**
 * Today's ceiling is the base allowance plus whatever tokens were spent
 * today — so a token doesn't grant time on its own, it raises the limit for
 * the day it's spent on.
 */
export async function loadGameStatus(
  todayISO: string,
  userId?: string,
): Promise<GameStatus[]> {
  const week = weekDays(todayISO);

  const [people, sessions] = await Promise.all([
    prisma.user.findMany({
      where: { isActive: true, ...(userId ? { id: userId } : {}) },
      orderBy: { sortOrder: "asc" },
      include: { gameProfile: true },
    }),
    prisma.gameSession.findMany({
      where: {
        ...(userId ? { userId } : {}),
        day: {
          gte: toDateColumn(week[0]),
          lte: toDateColumn(week[6]),
        },
      },
      select: { userId: true, day: true, minutes: true, usedToken: true },
    }),
  ]);

  const today = toDateColumn(todayISO).getTime();

  return people.map((p) => {
    const profile = p.gameProfile;
    const dailyMinutes = profile?.dailyMinutes ?? DEFAULTS.dailyMinutes;
    const tokenMinutes = profile?.tokenMinutes ?? DEFAULTS.tokenMinutes;
    const weeklyTokens = profile?.weeklyTokens ?? DEFAULTS.weeklyTokens;

    const mine = sessions.filter((s) => s.userId === p.id);
    const todaySessions = mine.filter((s) => s.day.getTime() === today);

    const usedToday = todaySessions.reduce((n, s) => n + s.minutes, 0);
    const tokensToday = todaySessions.filter((s) => s.usedToken).length;
    const tokensUsedThisWeek = mine.filter((s) => s.usedToken).length;

    const allowanceToday = dailyMinutes + tokensToday * tokenMinutes;

    return {
      userId: p.id,
      name: p.displayName ?? p.name,
      color: p.color,
      avatarPath: p.avatarPath,
      enabled: profile?.isActive ?? false,

      dailyMinutes,
      tokenMinutes,
      weeklyTokens,

      usedToday,
      allowanceToday,
      remainingToday: Math.max(0, allowanceToday - usedToday),

      tokensUsedThisWeek,
      tokensLeft: Math.max(0, weeklyTokens - tokensUsedThisWeek),

      usedThisWeek: mine.reduce((n, s) => n + s.minutes, 0),
    };
  });
}

export async function loadRecentSessions(userId: string, limit = 8) {
  return prisma.gameSession.findMany({
    where: { userId },
    orderBy: [{ day: "desc" }, { createdAt: "desc" }],
    take: limit,
  });
}
