import { prisma } from "@/lib/prisma";
import { startOfWeek, startOfMonth, addDays } from "@/lib/dates";

export type GameMonitorRow = {
  userId: string;
  name: string;
  color: string;
  avatarPath: string | null;
  avatarPosition: string;
  today: number;
  week: number;
  month: number;
  games: { game: string; minutes: number }[];
  gamerscore: number | null;
  gamerpic: string | null;
  hasGamePass: boolean | null;
  msBalance: string | null;
  weekDaily: { label: string; minutes: number }[];
};

const asDate = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

/** Per-person game-time monitoring for the /games page: today / this week /
 *  this month totals, the week's top games, and current profile status —
 *  all from the collector-fed GameDay / GameDayTitle / PlayerCard tables. */
export async function loadGameMonitor(todayIso: string): Promise<GameMonitorRow[]> {
  const monthStartIso = startOfMonth(todayIso);
  const weekStartIso = startOfWeek(todayIso);
  const rangeStartIso = weekStartIso < monthStartIso ? weekStartIso : monthStartIso;
  const monthStart = asDate(monthStartIso);
  const weekStart = asDate(weekStartIso);
  const rangeStart = asDate(rangeStartIso);
  const today = asDate(todayIso);
  const weekDayIsos = Array.from({ length: 7 }, (_, i) => addDays(weekStartIso, i));
  const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const users = await prisma.user.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      name: true,
      displayName: true,
      color: true,
      avatarPath: true,
      avatarPosition: true,
      playerCard: {
        select: { gamerscore: true, gamerpic: true, hasGamePass: true, msBalance: true },
      },
      gameDays: {
        where: { date: { gte: rangeStart, lte: today } },
        select: { date: true, minutes: true },
      },
      gameDayTitles: {
        where: { date: { gte: weekStart, lte: today } },
        select: { game: true, minutes: true },
      },
    },
  });

  const todayT = today.getTime();
  const weekT = weekStart.getTime();

  const rows = users.map((u) => {
    let todayMin = 0;
    let weekMin = 0;
    let monthMin = 0;
    const monthT = monthStart.getTime();
    const perDay = new Map<string, number>();
    for (const g of u.gameDays) {
      const t = g.date.getTime();
      if (t >= monthT) monthMin += g.minutes;
      if (t >= weekT) weekMin += g.minutes;
      if (t === todayT) todayMin += g.minutes;
      const iso = g.date.toISOString().slice(0, 10);
      perDay.set(iso, (perDay.get(iso) ?? 0) + g.minutes);
    }
    const weekDaily = weekDayIsos.map((iso) => ({
      label: DOW[new Date(`${iso}T12:00:00.000Z`).getUTCDay()],
      minutes: perDay.get(iso) ?? 0,
    }));
    const map = new Map<string, number>();
    for (const t of u.gameDayTitles) map.set(t.game, (map.get(t.game) ?? 0) + t.minutes);
    const games = [...map.entries()]
      .map(([game, minutes]) => ({ game, minutes }))
      .sort((a, b) => b.minutes - a.minutes)
      .slice(0, 6);
    const pc = u.playerCard;
    return {
      userId: u.id,
      name: u.displayName || u.name,
      color: u.color,
      avatarPath: u.avatarPath,
      avatarPosition: u.avatarPosition,
      today: todayMin,
      week: weekMin,
      month: monthMin,
      games,
      gamerscore: pc?.gamerscore ?? null,
      gamerpic: pc?.gamerpic ?? null,
      hasGamePass: pc?.hasGamePass ?? null,
      msBalance: pc?.msBalance ?? null,
      weekDaily,
    };
  });

  // Only people with game activity or a synced profile card.
  return rows.filter(
    (r) =>
      r.month > 0 ||
      r.games.length > 0 ||
      r.gamerscore != null ||
      r.hasGamePass != null ||
      r.msBalance != null,
  );
}
