import "server-only";
import { prisma } from "@/lib/prisma";
import {
  addDays,
  fromDateColumn,
  toDateColumn,
  todayISO,
  formatLong,
} from "@/lib/dates";
import { dayLabel } from "@/lib/bible/plan-edit";

export type PersonalPlanDay = {
  iso: string;
  label: string;
  passage: string;
  read: boolean;
};

export type PersonalPlan = {
  id: string;
  name: string;
  /** "DONE": ends when its readings are done, so added readings push it back. */
  endKind: string;
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
      select: { day: true, passage: true, extra: true },
    }),
    prisma.bibleRead.findMany({
      where: { scope: userId, sourceKey: { startsWith: `${plan.id}|` } },
      distinct: ["sourceKey"],
      select: { sourceKey: true },
    }),
    // Extras never count toward what's left of the plan.
    prisma.readingDay.count({
      where: { planId: plan.id, isExtra: false, day: { gte: toDateColumn(today) } },
    }),
  ]);

  const ticked = new Set(reads.map((r) => r.sourceKey));
  const days: PersonalPlanDay[] = window.map((d) => {
    const iso = fromDateColumn(d.day);
    return {
      iso,
      label: formatLong(iso),
      passage: dayLabel(d.passage, d.extra),
      read: ticked.has(`${plan.id}|${iso}`),
    };
  });

  return {
    id: plan.id,
    name: plan.name,
    endKind: plan.endKind,
    startISO: plan.startDate ? fromDateColumn(plan.startDate) : null,
    endISO: plan.endDate ? fromDateColumn(plan.endDate) : null,
    remaining,
    days,
  };
}
