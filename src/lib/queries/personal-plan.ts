import "server-only";
import { prisma } from "@/lib/prisma";
import {
  addDays,
  fromDateColumn,
  toDateColumn,
  todayISO,
  formatLong,
} from "@/lib/dates";
import { parsePassage } from "@/lib/bible/books";

export type PersonalPlanDay = {
  iso: string;
  label: string;
  passage: string;
  read: boolean;
};

export type PersonalPlan = {
  id: string;
  name: string;
  startISO: string | null;
  endISO: string | null;
  remaining: number;
  days: PersonalPlanDay[];
};

const WINDOW_BACK = 7;
const WINDOW_FORWARD = 14;

export async function loadPersonalPlan(
  userId: string,
): Promise<PersonalPlan | null> {
  const today = todayISO();
  const plan = await prisma.readingPlan.findFirst({
    where: { ownerId: userId },
    orderBy: { createdAt: "desc" },
  });
  if (!plan) return null;

  const [window, reads, remaining] = await Promise.all([
    prisma.readingDay.findMany({
      where: {
        planId: plan.id,
        day: {
          gte: toDateColumn(addDays(today, -WINDOW_BACK)),
          lte: toDateColumn(addDays(today, WINDOW_FORWARD)),
        },
      },
      orderBy: { day: "asc" },
      select: { day: true, passage: true },
    }),
    prisma.userChapterRead.findMany({
      where: { userId },
      select: { bookName: true, chapter: true },
    }),
    prisma.readingDay.count({
      where: { planId: plan.id, day: { gte: toDateColumn(today) } },
    }),
  ]);

  const readSet = new Set(reads.map((r) => `${r.bookName}|${r.chapter}`));
  const days: PersonalPlanDay[] = window.map((d) => {
    const iso = fromDateColumn(d.day);
    const refs = parsePassage(d.passage);
    const read =
      refs.length > 0 &&
      refs.every((r) => readSet.has(`${r.book}|${r.chapter}`));
    return { iso, label: formatLong(iso), passage: d.passage, read };
  });

  return {
    id: plan.id,
    name: plan.name,
    startISO: plan.startDate ? fromDateColumn(plan.startDate) : null,
    endISO: plan.endDate ? fromDateColumn(plan.endDate) : null,
    remaining,
    days,
  };
}
