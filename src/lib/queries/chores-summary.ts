import { prisma } from "@/lib/prisma";

export const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export type AssignmentRow = {
  id: string;
  dayOfWeek: number;
  userId: string;
  userName: string;
  userColor: string;
};

export type ChoreSummary = {
  id: string;
  title: string;
  assignments: AssignmentRow[];
  /** Gaps in days between consecutive occurrences, wrapping the week. */
  gaps: number[];
  unassigned: boolean;
};

/**
 * Because expiry is by succession, the gap between occurrences is exactly
 * how long an unfinished instance stays live. A chore assigned only on
 * Monday gives seven days to catch up; Monday and Wednesday gives two and
 * five. Surfacing the gaps makes that visible before it surprises anyone.
 */
export async function loadChoreSummary(): Promise<ChoreSummary[]> {
  const chores = await prisma.chore.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    include: {
      assignments: {
        where: { isActive: true },
        include: { user: { select: { id: true, name: true, color: true } } },
      },
    },
  });

  return chores.map((c) => {
    const assignments = c.assignments
      .map((a) => ({
        id: a.id,
        dayOfWeek: a.dayOfWeek,
        userId: a.userId,
        userName: a.user.name,
        userColor: a.user.color,
      }))
      .sort((a, b) => a.dayOfWeek - b.dayOfWeek);

    const days = assignments.map((a) => a.dayOfWeek);
    const gaps: number[] = [];
    for (let i = 0; i < days.length; i++) {
      const next = days[(i + 1) % days.length];
      const gap =
        days.length === 1 ? 7 : (next - days[i] + 7) % 7 || 7;
      gaps.push(gap);
    }

    return {
      id: c.id,
      title: c.title,
      assignments,
      gaps,
      unassigned: assignments.length === 0,
    };
  });
}
