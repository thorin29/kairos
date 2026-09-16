import { prisma } from "@/lib/prisma";
import { schoolClosedHolidayEntries } from "@/lib/holidays";

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

  // PAUSE events — every day the vacation covers is a no-school day.
  const pauses = await prisma.event.findMany({
    where: { kind: "PAUSE" },
    select: { startsAt: true, endsAt: true },
  });
  for (const e of pauses) {
    let d = dISO(e.startsAt);
    const end = dISO(e.endsAt);
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
