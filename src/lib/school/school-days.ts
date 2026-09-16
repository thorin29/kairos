import { prisma } from "@/lib/prisma";
import { schoolClosedHolidayEntries } from "@/lib/holidays";
import { localParts } from "@/lib/dates";

function dISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function addDay(iso: string): string {
  const x = new Date(`${iso}T00:00:00Z`);
  x.setUTCDate(x.getUTCDate() + 1);
  return x.toISOString().slice(0, 10);
}

/** Every calendar day inside any of the given windows (inclusive), YYYY-MM-DD. */
function enumerateDays(windows: { start: string; end: string }[]): string[] {
  const days: string[] = [];
  for (const w of windows) {
    let d = w.start;
    while (d <= w.end) {
      days.push(d);
      d = addDay(d);
    }
  }
  return days;
}

/**
 * No-school days for the curriculum builder: household PAUSE events (vacations /
 * breaks) plus every enabled built-in holiday that falls inside the given term
 * windows. Shared by the plan preview, the review screen, and publish so all
 * three schedule against exactly the same set of school days.
 */
export async function noSchoolDaysFor(
  windows: { start: string; end: string }[],
): Promise<Set<string>> {
  const skip = new Set<string>();

  // PAUSE events (vacations) — a no-school block unless the admin chose to keep
  // school running through it. All-day events store an exclusive end, so the last
  // covered day is the household-local day of (end - 1ms).
  const [pauses, keep] = await Promise.all([
    prisma.event.findMany({ where: { kind: "PAUSE" }, select: { id: true, startsAt: true, endsAt: true } }),
    prisma.schoolVacationDecision.findMany({
      where: { schoolContinues: true },
      select: { eventId: true },
    }),
  ]);
  const keepIds = new Set(keep.map((k) => k.eventId));
  for (const e of pauses) {
    if (keepIds.has(e.id)) continue;
    let d = localParts(e.startsAt).iso;
    const end = localParts(new Date(e.endsAt.getTime() - 1)).iso;
    while (d <= end) {
      skip.add(d);
      d = addDay(d);
    }
  }

  // Planned breaks (fall/spring break, estimated vacations) from school-year setup.
  const breaks = await prisma.schoolBreak.findMany({ select: { startDate: true, endDate: true } });
  for (const b of breaks) {
    let d = dISO(b.startDate);
    const end = dISO(b.endDate);
    while (d <= end) {
      skip.add(d);
      d = addDay(d);
    }
  }

  // Enabled built-in holidays that are marked no-school, inside the term windows.
  if (windows.length) {
    const holidays = await schoolClosedHolidayEntries(enumerateDays(windows));
    for (const h of holidays) skip.add(h.iso);
  }

  return skip;
}
