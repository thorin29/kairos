import "server-only";
import { prisma } from "@/lib/prisma";
import { addDays, fromDateColumn, toDateColumn } from "@/lib/dates";
import { loadPersonalEvents, type CalEvent } from "@/lib/queries/calendar-page";

/** How many days the home-screen widget looks ahead, today included. */
export const WIDGET_DAYS = 7;

export type WidgetTask = { id: string; title: string };
export type WidgetDay = { date: string; tasks: WidgetTask[]; events: CalEvent[] };
export type WidgetPayload = {
  today: string;
  /** "family": everyone's events; "mine": only the person's own. */
  scope: "family" | "mine";
  /** The person's open tasks from before today. One line on the widget. */
  overdueTasks: number;
  /** Only days that have something on them, in order. */
  days: WidgetDay[];
};

/**
 * The Android home-screen widget: the next week of a person's events and their
 * own tasks. Events are filtered and colored exactly as their Calendar shows
 * them (loadPersonalEvents) — with "family", everyone's events are included and
 * other people's take the person's "others" color (grey under Custom colors).
 * Tasks are always only the person's own: the widget can tick them off.
 */
export async function loadWidgetPayload(
  userId: string,
  today: string,
  scope: "family" | "mine",
): Promise<WidgetPayload> {
  const days = Array.from({ length: WIDGET_DAYS }, (_, i) => addDays(today, i));
  const people =
    scope === "family"
      ? ((await prisma.user.findMany({
          where: { isActive: true },
          select: { id: true },
        })) as { id: string }[]).map((u) => u.id)
      : [userId];

  const [events, tasks, overdueTasks] = await Promise.all([
    loadPersonalEvents(userId, days, people),
    prisma.task.findMany({
      where: {
        userId,
        category: "OTHER",
        status: "PENDING",
        dueDate: {
          gte: toDateColumn(today),
          lte: toDateColumn(days[days.length - 1]),
        },
      },
      orderBy: [{ dueDate: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
      select: { id: true, title: true, dueDate: true },
    }) as Promise<{ id: string; title: string; dueDate: Date }[]>,
    prisma.task.count({
      where: {
        userId,
        category: "OTHER",
        status: "PENDING",
        dueDate: { lt: toDateColumn(today) },
      },
    }) as Promise<number>,
  ]);

  const out: WidgetDay[] = days.map((date) => ({ date, tasks: [], events: [] }));
  const byDate = new Map(out.map((d) => [d.date, d]));
  for (const t of tasks) {
    byDate.get(fromDateColumn(t.dueDate))?.tasks.push({ id: t.id, title: t.title });
  }
  for (const e of events) byDate.get(e.dayISO)?.events.push(e);

  return {
    today,
    scope,
    overdueTasks,
    days: out.filter((d) => d.tasks.length > 0 || d.events.length > 0),
  };
}
