import { prisma } from "@/lib/prisma";
import { todayISO } from "@/lib/dates";
import { noSchoolDaysFor } from "@/lib/school/school-days";
import { spreadUnits, spreadUnitsFit } from "@/lib/school/plan-builder";

function dISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function addDayISO(iso: string): string {
  const x = new Date(`${iso}T00:00:00Z`);
  x.setUTCDate(x.getUTCDate() + 1);
  return x.toISOString().slice(0, 10);
}
function isoDow(iso: string): number {
  const wd = new Date(`${iso}T00:00:00Z`).getUTCDay();
  return wd === 0 ? 7 : wd;
}
type Win = { start: string; end: string };
function isSchoolDay(day: string, weekdays: Set<number>, skip: Set<string>, wins: Win[]): boolean {
  return weekdays.has(isoDow(day)) && !skip.has(day) && wins.some((w) => day >= w.start && day <= w.end);
}
/** School days (in the plan's weekdays, within its terms, minus no-school days)
 *  in [fromISO, toISO] inclusive. */
function countSchoolDays(
  fromISO: string,
  toISO: string,
  weekdays: Set<number>,
  skip: Set<string>,
  wins: Win[],
): number {
  if (!fromISO || !toISO || toISO < fromISO) return 0;
  let n = 0;
  let d = fromISO;
  while (d <= toISO) {
    if (isSchoolDay(d, weekdays, skip, wins)) n += 1;
    d = addDayISO(d);
  }
  return n;
}

export type SchoolProgress = {
  className: string;
  subject: string | null;
  color: string | null;
  finishISO: string | null; // projected finish for the remaining work, from today
  remaining: number;
  onTrack: boolean; // projected to finish on or before the target
  pace: "ahead" | "behind" | null; // vs where the plan expects them by today
  catchUp: { rate: number; days: number | null } | null; // suggested pace if behind
};
export type SchoolProgressData = {
  targetISO: string | null; // the finish-by date (end of Spring)
  progress: SchoolProgress[];
};

/** Per published class for a student: a dynamic projected finish (the remaining
 *  units spread from today at the plan's rate, overflow projected past the term
 *  end), whether they're ahead/behind the plan's expected pace, and — if behind
 *  — how hard they'd have to push to finish on time. Drives the School card. */
export async function loadSchoolProgress(userId: string): Promise<SchoolProgressData> {
  const today = todayISO();
  const [plans, allTerms] = await Promise.all([
    prisma.classPlan.findMany({
      where: { status: "PUBLISHED", class: { userId } },
      orderBy: { createdAt: "asc" },
      select: {
        perDay: true,
        weekdays: true,
        startDate: true,
        fitToTerm: true,
        bothTerms: true,
        class: {
          select: { name: true, color: true, termId: true, subject: { select: { name: true } } },
        },
        units: { select: { seq: true, type: true, load: true, scheduledDate: true, done: true } },
      },
    }),
    prisma.term.findMany({
      orderBy: { startDate: "asc" },
      select: { id: true, name: true, startDate: true, endDate: true },
    }),
  ]);

  const spring = allTerms.find((t) => t.name.toLowerCase().includes("spring"));
  const lastTerm = allTerms.length
    ? allTerms.reduce((m, t) => (t.endDate > m.endDate ? t : m))
    : null;
  const targetISO = spring ? dISO(spring.endDate) : lastTerm ? dISO(lastTerm.endDate) : null;

  // No-school days across the whole year (a superset — the spread only checks
  // the days it actually visits, all inside a plan's own windows).
  const allWins: Win[] = allTerms.map((t) => ({ start: dISO(t.startDate), end: dISO(t.endDate) }));
  const skip = allWins.length ? await noSchoolDaysFor(allWins) : new Set<string>();

  const progress: SchoolProgress[] = plans
    .map((p) => {
      const weekdays = new Set<number>(p.weekdays.split("").map(Number));
      const perDay = Math.max(1, p.perDay);
      const wins: Win[] = p.bothTerms
        ? allWins
        : allTerms
            .filter((t) => t.id === p.class.termId)
            .map((t) => ({ start: dISO(t.startDate), end: dISO(t.endDate) }));
      const winsEnd = wins.length ? wins.reduce((m, w) => (w.end > m ? w.end : m), wins[0].end) : today;

      const undone = p.units.filter((u) => !u.done).sort((a, b) => a.seq - b.seq);
      const remaining = undone.length;
      const doneCount = p.units.length - remaining;

      // Dynamic projected finish: spread the remaining units from today at the
      // plan's rate; anything that doesn't fit the term is projected past its end.
      let finishISO: string | null = null;
      if (remaining > 0 && wins.length) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const dummy = undone as any;
        const sched = p.fitToTerm
          ? spreadUnitsFit(dummy, { startDate: today, weekdays: [...weekdays], holidays: skip, terms: wins })
          : spreadUnits(dummy, { startDate: today, weekdays: [...weekdays], holidays: skip, terms: wins, perDay });
        const placed = sched.filter((s) => s.date).map((s) => s.date as string);
        finishISO = placed.length ? placed[placed.length - 1] : null;
        let overflow = sched.filter((s) => !s.date).length;
        if (overflow > 0) {
          let d = finishISO ?? winsEnd;
          while (overflow > 0) {
            d = addDayISO(d);
            if (weekdays.has(isoDow(d)) && !skip.has(d)) {
              finishISO = d;
              overflow -= 1;
            }
          }
        }
      }
      const onTrack = finishISO && targetISO ? finishISO <= targetISO : true;

      // Pace: done so far vs what the plan expected done by today (its starting
      // offset of pre-completed units, plus elapsed school days at the rate).
      const scheduledDates = p.units
        .filter((u) => u.scheduledDate)
        .map((u) => dISO(u.scheduledDate as Date))
        .sort();
      const effectiveStart = p.startDate ? dISO(p.startDate) : scheduledDates[0] ?? null;
      const preDone = p.units.filter((u) => u.done && !u.scheduledDate).length;
      let pace: "ahead" | "behind" | null = null;
      const scheduled = p.units.filter((u) => u.scheduledDate);
      if (scheduled.length) {
        // Precise pace from the plan's real schedule: behind only if a unit
        // dated BEFORE today is still undone (today's work isn't due yet, so
        // pending/just-done today is on schedule), and ahead if a unit dated
        // AFTER today is already done. Otherwise on schedule (no tag).
        const behindCount = scheduled.filter(
          (u) => !u.done && dISO(u.scheduledDate as Date) < today,
        ).length;
        const aheadCount = scheduled.filter(
          (u) => u.done && dISO(u.scheduledDate as Date) > today,
        ).length;
        if (behindCount > 0) pace = "behind";
        else if (aheadCount > 0) pace = "ahead";
      } else if (effectiveStart && effectiveStart <= today && wins.length) {
        // Fallback for a plan whose units aren't date-scheduled: rate-based,
        // measured against the END OF YESTERDAY (today isn't due yet).
        const elapsed = countSchoolDays(effectiveStart, today, weekdays, skip, wins);
        const isSchoolToday = isSchoolDay(today, weekdays, skip, wins);
        const elapsedPrior = Math.max(0, elapsed - (isSchoolToday ? 1 : 0));
        const expectedPrior = Math.min(
          preDone + elapsedPrior * perDay,
          p.units.length,
        );
        const expectedToday = Math.min(
          preDone + elapsed * perDay,
          p.units.length,
        );
        if (doneCount < expectedPrior) pace = "behind";
        else if (doneCount > expectedToday) pace = "ahead";
      }

      // Catch-up: if it won't finish by the target, the pace that would.
      let catchUp: { rate: number; days: number | null } | null = null;
      if (!onTrack && targetISO && today < targetISO && wins.length) {
        const available = countSchoolDays(addDayISO(today), targetISO, weekdays, skip, wins);
        if (remaining > available && available > 0) {
          const deficit = remaining - available;
          catchUp =
            deficit <= available
              ? { rate: perDay + 1, days: deficit }
              : { rate: Math.ceil(remaining / available), days: null };
        }
      }

      return {
        className: p.class.name,
        subject: p.class.subject?.name ?? null,
        color: p.class.color,
        finishISO,
        remaining,
        onTrack,
        pace,
        catchUp,
      };
    })
    .sort((a, b) => a.className.localeCompare(b.className));

  return { targetISO, progress };
}
