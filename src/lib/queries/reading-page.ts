import "server-only";
import { prisma } from "@/lib/prisma";
import {
  addDays,
  formatLong,
  fromDateColumn,
  toDateColumn,
} from "@/lib/dates";
import {
  loadReadingStats,
  loadPersonalReadingStats,
  loadPersonalReadKeys,
  type ReadingStats,
} from "@/lib/queries/reading-stats";
import { loadPersonalPlan, type PersonalPlan } from "@/lib/queries/personal-plan";

/**
 * One aggregated read that paints the whole Bible screen in a single round trip,
 * mirroring what src/app/bible/page.tsx renders: the family reading deck +
 * coverage, and (for a signed-in personal device) the person's own coverage,
 * plan, and hand-marked chapters. The app is inherently single-person, so the
 * personal block is always included.
 *
 * Read-only; completion writes go through personal-core. The family reading has
 * no completion here — like the web page, family completion is a BIBLE task on
 * the dashboard, not this screen.
 */

const WINDOW_BACK = 7;
const WINDOW_FORWARD = 14;

export type ReadingCardPayload = {
  iso: string;
  passage: string;
  label: string;
};

export type ReadingPagePayload = {
  today: string;
  family: {
    havePlan: boolean;
    cards: ReadingCardPayload[];
    todayIndex: number;
    remaining: number;
    lastDayISO: string | null;
    stats: ReadingStats;
  };
  personal: {
    color: string;
    stats: ReadingStats;
    plan: PersonalPlan | null;
    readKeys: string[];
  };
};

export async function loadReadingPagePayload(
  userId: string,
  todayISO: string,
): Promise<ReadingPagePayload> {
  const [publishedCount, stats] = await Promise.all([
    prisma.readingPlan.count({
      where: { isPublished: true, ownerId: null },
    }),
    loadReadingStats(todayISO),
  ]);

  const havePlan = publishedCount > 0;

  // Daily cards come from every published family plan in the window, so the
  // reading flows seamlessly across a plan boundary. Dedupe by day (later plan
  // wins), matching the page.
  const window = havePlan
    ? await prisma.readingDay.findMany({
        where: {
          plan: { isPublished: true, ownerId: null },
          day: {
            gte: toDateColumn(addDays(todayISO, -WINDOW_BACK)),
            lte: toDateColumn(addDays(todayISO, WINDOW_FORWARD)),
          },
        },
        orderBy: [{ plan: { startDate: "asc" } }, { day: "asc" }],
        select: { day: true, passage: true },
      })
    : [];

  const byDay = new Map<string, string>();
  for (const d of window) byDay.set(fromDateColumn(d.day), d.passage);

  const cards: ReadingCardPayload[] = [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([iso, passage]) => ({ iso, passage, label: formatLong(iso) }));

  const todayIndex = Math.max(
    0,
    cards.findIndex((c) => c.iso === todayISO),
  );

  const [remaining, last, personalStats, personalPlan, readKeys, user] =
    await Promise.all([
      havePlan
        ? prisma.readingDay.count({
            where: {
              plan: { isPublished: true, ownerId: null },
              day: { gte: toDateColumn(todayISO) },
            },
          })
        : Promise.resolve(0),
      havePlan
        ? prisma.readingDay.findFirst({
            where: { plan: { isPublished: true, ownerId: null } },
            orderBy: { day: "desc" },
            select: { day: true },
          })
        : Promise.resolve(null),
      loadPersonalReadingStats(userId, todayISO),
      loadPersonalPlan(userId),
      loadPersonalReadKeys(userId),
      prisma.user.findUnique({
        where: { id: userId },
        select: { color: true },
      }),
    ]);

  return {
    today: todayISO,
    family: {
      havePlan,
      cards,
      todayIndex,
      remaining,
      lastDayISO: last ? fromDateColumn(last.day) : null,
      stats,
    },
    personal: {
      color: user?.color ?? "#64748b",
      stats: personalStats,
      plan: personalPlan,
      readKeys,
    },
  };
}
