import "server-only";
import { prisma } from "@/lib/prisma";
import { fromDateColumn, localParts, todayISO } from "@/lib/dates";
import type { SchoolWorkType } from "@/generated/prisma/client";

export type SchoolItem = {
  id: string;
  title: string;
  type: SchoolWorkType;
  subject: string | null;
  dueISO: string;
  status: string;
  overdue: boolean;
};

export type PersonSchool = {
  id: string;
  name: string;
  color: string;
  avatarPath: string | null;
  pending: number;
  overdue: number;
  items: SchoolItem[];
};

/**
 * Everyone's active (not-yet-done) school work for the admin page, newest due
 * first, so a parent can see and manage assignments and tests across the house.
 */
export async function loadSchoolAdmin(): Promise<PersonSchool[]> {
  const today = todayISO();

  const [people, tasks] = await Promise.all([
    prisma.user.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        name: true,
        displayName: true,
        color: true,
        avatarPath: true,
      },
    }),
    prisma.task.findMany({
      where: {
        category: "SCHOOL",
        status: { not: "COMPLETE" },
        schoolWork: { isNot: null },
      },
      orderBy: [{ dueDate: "asc" }],
      select: {
        id: true,
        userId: true,
        title: true,
        dueDate: true,
        status: true,
        schoolWork: { select: { type: true, subject: true } },
      },
    }),
  ]);

  const byUser = new Map<string, SchoolItem[]>();
  for (const t of tasks) {
    if (!t.schoolWork) continue;
    const dueISO = fromDateColumn(t.dueDate);
    const item: SchoolItem = {
      id: t.id,
      title: t.title,
      type: t.schoolWork.type,
      subject: t.schoolWork.subject,
      dueISO,
      status: t.status as string,
      overdue: dueISO < today,
    };
    const list = byUser.get(t.userId) ?? [];
    list.push(item);
    byUser.set(t.userId, list);
  }

  return people.map((p) => {
    const items = byUser.get(p.id) ?? [];
    return {
      id: p.id,
      name: p.displayName ?? p.name,
      color: p.color,
      avatarPath: p.avatarPath,
      pending: items.length,
      overdue: items.filter((i) => i.overdue).length,
      items,
    };
  });
}

// --- terms & classes (Phase 2a) ------------------------------------------

const DAY_LABEL: Record<string, string> = {
  SU: "Sun",
  MO: "Mon",
  TU: "Tue",
  WE: "Wed",
  TH: "Thu",
  FR: "Fri",
  SA: "Sat",
};
const DAY_ORDER = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

function clock(minutes: number): string {
  const h24 = Math.floor(minutes / 60);
  const m = minutes % 60;
  const ampm = h24 < 12 ? "AM" : "PM";
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h}:${String(m).padStart(2, "0")} ${ampm}`;
}

function meetingSummary(
  rrule: string | null,
  startsAt: Date,
  endsAt: Date,
): string | null {
  if (!rrule) return null;
  const m = /BYDAY=([A-Z,]+)/.exec(rrule);
  const days = m
    ? m[1]
        .split(",")
        .filter((d) => d in DAY_LABEL)
        .sort((a, b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b))
        .map((d) => DAY_LABEL[d])
    : [];
  const s = localParts(startsAt).minutes;
  const e = localParts(endsAt).minutes;
  const when = `${clock(s)}\u2013${clock(e)}`;
  return days.length > 0 ? `${days.join(", ")} \u00b7 ${when}` : when;
}

export type TermRow = {
  id: string;
  name: string;
  startISO: string;
  endISO: string;
};

export type ClassRow = {
  id: string;
  name: string;
  color: string | null;
  termId: string | null;
  meeting: string | null;
};

export type PersonClasses = {
  id: string;
  name: string;
  color: string;
  avatarPath: string | null;
  classes: ClassRow[];
};

export async function loadSchoolStructure(): Promise<{
  terms: TermRow[];
  people: PersonClasses[];
}> {
  const [terms, people, classes] = await Promise.all([
    prisma.term.findMany({ orderBy: [{ startDate: "asc" }] }),
    prisma.user.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        name: true,
        displayName: true,
        color: true,
        avatarPath: true,
      },
    }),
    prisma.schoolClass.findMany({
      orderBy: [{ sortOrder: "asc" }],
      select: {
        id: true,
        name: true,
        color: true,
        termId: true,
        userId: true,
        event: { select: { rrule: true, startsAt: true, endsAt: true } },
      },
    }),
  ]);

  const byUser = new Map<string, ClassRow[]>();
  for (const c of classes) {
    const row: ClassRow = {
      id: c.id,
      name: c.name,
      color: c.color,
      termId: c.termId,
      meeting: c.event
        ? meetingSummary(c.event.rrule, c.event.startsAt, c.event.endsAt)
        : null,
    };
    const list = byUser.get(c.userId) ?? [];
    list.push(row);
    byUser.set(c.userId, list);
  }

  return {
    terms: terms.map((t) => ({
      id: t.id,
      name: t.name,
      startISO: fromDateColumn(t.startDate),
      endISO: fromDateColumn(t.endDate),
    })),
    people: people.map((p) => ({
      id: p.id,
      name: p.displayName ?? p.name,
      color: p.color,
      avatarPath: p.avatarPath,
      classes: byUser.get(p.id) ?? [],
    })),
  };
}
