import "server-only";
import { prisma } from "@/lib/prisma";
import { fromDateColumn, todayISO } from "@/lib/dates";

export type BookProgress = {
  id: string;
  title: string;
  unit: "PAGES" | "CHAPTERS";
  length: number;
  read: number; // capped at length
  rawRead: number; // uncapped total
  todayAmount: number;
  finished: boolean;
};

export type PersonBooks = {
  id: string;
  name: string;
  color: string;
  avatarPath: string | null;
  avatarPosition: string | null;
  current: BookProgress[];
  finished: BookProgress[];
};

export async function loadReading(): Promise<PersonBooks[]> {
  const today = todayISO();
  const [people, books] = await Promise.all([
    prisma.user.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        name: true,
        displayName: true,
        color: true,
        avatarPath: true, avatarPosition: true,
      },
    }),
    prisma.book.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        userId: true,
        title: true,
        unit: true,
        length: true,
        finishedAt: true,
        logs: { select: { day: true, amount: true } },
      },
    }),
  ]);

  const byUser = new Map<
    string,
    { current: BookProgress[]; finished: BookProgress[] }
  >();
  for (const p of people) byUser.set(p.id, { current: [], finished: [] });

  for (const b of books as {
    id: string;
    userId: string;
    title: string;
    unit: "PAGES" | "CHAPTERS";
    length: number;
    finishedAt: Date | null;
    logs: { day: Date; amount: number }[];
  }[]) {
    const bucket = byUser.get(b.userId);
    if (!bucket) continue;
    const rawRead = b.logs.reduce((n, l) => n + l.amount, 0);
    const todayAmount =
      b.logs.find((l) => fromDateColumn(l.day) === today)?.amount ?? 0;
    const prog: BookProgress = {
      id: b.id,
      title: b.title,
      unit: b.unit,
      length: b.length,
      read: Math.min(rawRead, b.length),
      rawRead,
      todayAmount,
      finished: b.finishedAt != null,
    };
    (prog.finished ? bucket.finished : bucket.current).push(prog);
  }

  return people.map((p) => ({
    id: p.id,
    name: p.displayName ?? p.name,
    color: p.color,
    avatarPath: p.avatarPath,
    avatarPosition: p.avatarPosition,
    current: byUser.get(p.id)!.current,
    finished: byUser.get(p.id)!.finished,
  }));
}
