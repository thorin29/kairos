/**
 * Occurrences of a repeating event that a single-occurrence edit replaced
 * (v0.785): a moved, changed or cancelled practice, class or trip is a child
 * event marked with the date it replaces, and the series must skip that
 * date everywhere it's expanded, not just on the calendar. The child (unless
 * cancelled) stands on its own date.
 */
import { prisma } from "@/lib/prisma";
import { fromDateColumn } from "@/lib/dates";
import { occurrenceOfRow } from "@/lib/calendar/recur";

type SeriesRow = { id: string; startsAt: Date; endsAt: Date; allDay?: boolean; rrule: string | null };

/** Series id → the occurrence days its overrides replace. */
export async function replacedOccurrences(rows: readonly SeriesRow[]): Promise<Map<string, Set<string>>> {
  const series = rows.filter((r) => r.rrule);
  const out = new Map<string, Set<string>>();
  if (series.length === 0) return out;
  const byId = new Map(series.map((r) => [r.id, r] as const));
  const overrides = (await prisma.event.findMany({
    where: { recurrenceId: { in: [...byId.keys()] }, recurrenceDate: { not: null } },
    select: { recurrenceId: true, recurrenceDate: true },
  })) as { recurrenceId: string | null; recurrenceDate: Date | null }[];
  for (const o of overrides) {
    const parent = o.recurrenceId ? byId.get(o.recurrenceId) : undefined;
    if (!parent || !o.recurrenceDate) continue;
    const iso = occurrenceOfRow({ ...parent, allDay: parent.allDay ?? false }, fromDateColumn(o.recurrenceDate));
    const set = out.get(parent.id) ?? new Set<string>();
    set.add(iso);
    out.set(parent.id, set);
  }
  return out;
}
