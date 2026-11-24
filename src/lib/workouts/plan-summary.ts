import "server-only";
import { prisma } from "@/lib/prisma";
import { getSetting } from "@/lib/settings";
import { CARDIO_CATEGORIES } from "@/lib/workouts/blocks";

/**
 * The plan card on the Workouts page (v0.747): each weekday at a glance, the
 * plan's last day, and what's on the days a program doesn't use ("With Arms
 * and Core"). The same for a program or a plan of your own.
 */

export type StripKind = "lift" | "core" | "iso" | "conditioning" | "cardio" | "other" | "rest" | "none";
export type StripDay = { day: number; label: string; kind: StripKind; program: boolean };
export type PlanSummary = {
  /** Monday first. */
  strip: StripDay[];
  /** The plan's last day, or null for no end. */
  ends: string | null;
  /** Anything planned at all (a rest day counts). */
  hasPlan: boolean;
  /** The other days' workouts when a program runs ("Arms", "Core"). */
  others: string[];
};

type Row = {
  dayOfWeek: number;
  name: string;
  category: string | null;
  muscleGroup: string | null;
  isRest: boolean;
  sortOrder: number;
  /** v0.749: set on a program's own entries. */
  programId?: string | null;
};

// Sunday first, like the charts (v0.786).
const SUNDAY_FIRST = [0, 1, 2, 3, 4, 5, 6];

function kindOf(w: Row): StripKind {
  if (w.isRest) return "rest";
  if (w.category === "HIIT") return "conditioning";
  if (w.category && CARDIO_CATEGORIES.includes(w.category)) return "cardio";
  if (w.category === "MOBILITY" || w.category === "STRETCHING") return "other";
  if (w.category === "ISOMETRIC") return "iso";
  if (w.muscleGroup === "CORE") return "core";
  return "lift";
}

/** "Press day" → "Press", "Core · Rotation and power" → "Core". */
export function shortName(name: string): string {
  return name.split(" · ")[0].replace(/\s+day$/i, "").trim() || name;
}

/** Pure: the strip from plan rows and the program's weekdays. */
export function buildStrip(rows: readonly Row[], programDays: ReadonlySet<number>): { strip: StripDay[]; others: string[] } {
  const others: string[] = [];
  const strip = SUNDAY_FIRST.map((day): StripDay => {
    const on = rows.filter((w) => w.dayOfWeek === day).sort((a, b) => a.sortOrder - b.sortOrder);
    const work = on.filter((w) => !w.isRest && w.category !== "WARMUP");
    // The day's main work: strength or holds before conditioning, cardio last.
    const rank = (w: Row) => ({ lift: 0, core: 1, iso: 1, conditioning: 2, other: 3, cardio: 4, rest: 5, none: 6 })[kindOf(w)];
    const main = [...work].sort((a, b) => rank(a) - rank(b))[0];
    const program = programDays.has(day);
    if (main) {
      const label = shortName(main.name);
      if (programDays.size > 0 && !program && !others.includes(label)) others.push(label);
      return { day, label, kind: kindOf(main), program };
    }
    if (on.some((w) => w.isRest)) return { day, label: "Rest", kind: "rest", program };
    return { day, label: "", kind: "none", program };
  });
  return { strip, others };
}

export async function planSummary(userId: string, programDays: readonly number[] = []): Promise<PlanSummary> {
  const [rows, end] = await Promise.all([
    prisma.plannedWorkout.findMany({
      where: { userId },
      select: { dayOfWeek: true, name: true, category: true, muscleGroup: true, isRest: true, sortOrder: true, programId: true },
    }) as Promise<Row[]>,
    getSetting(`weeklyEnd:${userId}`),
  ]);
  // Every running program's days (v0.749: a program's own entries say so).
  const days = new Set([...programDays, ...(programDays.length ? rows.filter((r) => r.programId).map((r) => r.dayOfWeek) : [])]);
  const { strip, others } = buildStrip(rows, days);
  return { strip, ends: end && /^\d{4}-\d{2}-\d{2}$/.test(end) ? end : null, hasPlan: rows.length > 0, others };
}
