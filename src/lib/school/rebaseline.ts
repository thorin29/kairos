// Re-baseline a class plan that has fallen behind (v0.701): restart every
// undone unit, oldest first, from the next school day, as long as the class
// still finishes by its deadline. Pure — the database side is in
// rebaseline-core.ts, which feeds this and writes the dates it returns.
//
// The rules (agreed 13 Nov):
// - Only a class with overdue work (an undone unit dated before today) is a
//   candidate. Today's and future undone units move too, behind the overdue
//   ones, so the order stays oldest first. It's meant to run after school is
//   done for the day.
// - The deadline is the end of the class's own window: the last term's end for
//   a whole-year plan, its term's end for a one-term plan.
// - "Fit to term" plans re-fit to the deadline (they can carry extra items a
//   day) and are never skipped. Other plans keep their own per-day rate and
//   are skipped when that would finish past the deadline.
// - Skipped (excused) units stay where they are; they're not owed.

import { spreadUnits, spreadUnitsFit, type PlanUnit, type Term } from "@/lib/school/plan-builder";

export type RebaselineUnit = {
  id: string;
  seq: number;
  type: PlanUnit["type"];
  load: number;
  /** Done by either signal: the unit's own flag or a completed task. */
  done: boolean;
  /** An excused (SKIPPED) task: not owed, never moved. */
  skipped: boolean;
  scheduledDate: string | null;
};

export type RebaselineStatus =
  | "ready" // behind, and restarting it still finishes by the deadline
  | "pastDeadline" // behind, but restarting it would finish after the deadline
  | "onSchedule" // nothing overdue
  | "noTerm"; // no term dates to schedule against

export type RebaselineResult = {
  status: RebaselineStatus;
  overdue: number;
  deadline: string | null;
  /** The latest date among the undone units as scheduled now. */
  currentFinish: string | null;
  /** The last date after restarting (also set when it's past the deadline). */
  newFinish: string | null;
  /** The first restarted date (the next school day for this class). */
  firstDate: string | null;
  /** New dates for every undone unit, oldest first. Empty unless ready. */
  moves: { id: string; date: string }[];
};

function addDay(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function rebaselinePlan(
  units: RebaselineUnit[],
  opts: {
    today: string;
    weekdays: number[];
    perDay: number;
    fitToTerm: boolean;
    terms: Term[]; // the plan's own windows
    holidays: Set<string>;
  },
): RebaselineResult {
  const live = units.filter((u) => !u.done && !u.skipped).sort((a, b) => a.seq - b.seq);
  const overdue = live.filter((u) => u.scheduledDate != null && u.scheduledDate < opts.today).length;
  const dated = live.map((u) => u.scheduledDate).filter((d): d is string => d != null).sort();
  const currentFinish = dated.length ? dated[dated.length - 1] : null;
  const deadline = opts.terms.length
    ? opts.terms.reduce((m, t) => (t.end > m ? t.end : m), opts.terms[0].end)
    : null;
  const base = { overdue, deadline, currentFinish, newFinish: null, firstDate: null, moves: [] };

  if (overdue === 0) return { ...base, status: "onSchedule" };
  if (!deadline) return { ...base, status: "noTerm" };

  const asPlan: PlanUnit[] = live.map((u) => ({ label: u.id, type: u.type, load: u.load }));
  const startDate = addDay(opts.today);
  const sched = opts.fitToTerm
    ? spreadUnitsFit(asPlan, { startDate, weekdays: opts.weekdays, holidays: opts.holidays, terms: opts.terms })
    : spreadUnits(asPlan, {
        startDate,
        weekdays: opts.weekdays,
        holidays: opts.holidays,
        terms: opts.terms,
        perDay: opts.perDay,
      });

  const dates = sched.map((s) => s.date);
  const firstDate = dates[0] ?? null;
  // spreadUnitsFit leaves a date null only when no school day is left before
  // the deadline at all; spreadUnits never does (it runs past the deadline).
  if (dates.some((d) => d == null)) return { ...base, firstDate, status: "pastDeadline" };
  const newFinish = dates[dates.length - 1] as string;
  if (newFinish > deadline) return { ...base, firstDate, newFinish, status: "pastDeadline" };

  return {
    ...base,
    status: "ready",
    firstDate,
    newFinish,
    moves: live.map((u, i) => ({ id: u.id, date: dates[i] as string })),
  };
}
