import "server-only";
import { prisma } from "@/lib/prisma";
import { fromDateColumn } from "@/lib/dates";
import { programByKey } from "@/lib/workouts/programs";
import type { ProgramSpan } from "@/lib/workouts/history";

/** What names past workouts (v0.627): games by their kind, and the programs
 *  a day was part of. Its own module so the plan and day queries can share it. */

/** Short names for games logged from the calendar, by event id: the event's
 *  type ("Hockey game"), else the subscribed calendar it came from (v0.626),
 *  else "Sport". */
export async function sportLabels(ids: readonly (string | null)[]): Promise<Map<string, string>> {
  const eventIds = [...new Set(ids.filter((x): x is string => !!x))];
  if (eventIds.length === 0) return new Map();
  const types = (await prisma.event.findMany({
    where: { id: { in: eventIds } },
    select: { id: true, eventType: { select: { name: true } }, externalCalendar: { select: { name: true } } },
  })) as { id: string; eventType: { name: string } | null; externalCalendar: { name: string } | null }[];
  return new Map(types.map((t) => [t.id, t.eventType?.name?.trim() || t.externalCalendar?.name?.trim() || "Sport"]));
}

/** Every program the person has run and the days it ran (startedOn up to,
 *  not including, endedOn), for naming past workouts (v0.627). */
export async function loadProgramSpans(userId: string): Promise<ProgramSpan[]> {
  const rows = (await prisma.personProgram.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: { programKey: true, startedOn: true, endedOn: true },
  })) as { programKey: string; startedOn: Date; endedOn: Date | null }[];
  return rows.flatMap((r) => {
    const program = programByKey(r.programKey);
    const startedOn = fromDateColumn(r.startedOn);
    const endedOn = r.endedOn ? fromDateColumn(r.endedOn) : null;
    if (!program || (endedOn != null && endedOn <= startedOn)) return [];
    return [{ name: program.name, startedOn, endedOn }];
  });
}
