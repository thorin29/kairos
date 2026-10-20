"use server";

import { requireInteractive } from "@/lib/gate";
import { prisma } from "@/lib/prisma";
import { eventParts } from "@/lib/dates";

export type EventSearchResult = {
  id: string;
  title: string;
  dateISO: string;
  /** Minutes past midnight, or null for an all-day event. */
  startMin: number | null;
  endMin: number | null;
  repeats: boolean;
  ownerName: string | null;
};

/**
 * Find calendar events by name, across all dates. Matches the event rows (not
 * every occurrence), skipping cancelled tombstones and per-occurrence override
 * children so a series shows once. Useful for "did that event ever exist / is it
 * really gone?" as much as jumping to something.
 */
export async function searchEvents(
  query: string,
): Promise<{ results: EventSearchResult[] }> {
  await requireInteractive();
  const q = query.trim();
  if (q.length < 2) return { results: [] };

  type SearchRow = {
    id: string;
    title: string;
    startsAt: Date;
    endsAt: Date;
    allDay: boolean;
    rrule: string | null;
    isFamily: boolean;
    user: { name: string } | null;
  };
  const rows = await prisma.event.findMany({
    where: {
      title: { contains: q, mode: "insensitive" },
      recurrenceId: null,
      cancelled: false,
    },
    orderBy: [{ startsAt: "asc" }],
    take: 300,
    select: {
      id: true,
      title: true,
      startsAt: true,
      endsAt: true,
      allDay: true,
      rrule: true,
      isFamily: true,
      user: { select: { name: true } },
    },
  });

  return {
    results: (rows as SearchRow[]).map((e) => {
      const s = eventParts(e.startsAt, e.allDay);
      const en = eventParts(e.endsAt, e.allDay);
      return {
        id: e.id,
        title: e.title,
        dateISO: s.iso,
        startMin: e.allDay ? null : s.minutes,
        endMin: e.allDay ? null : en.minutes,
        repeats: Boolean(e.rrule),
        ownerName: e.isFamily ? "Family" : (e.user?.name ?? null),
      };
    }),
  };
}
