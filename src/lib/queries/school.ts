import "server-only";
import { prisma } from "@/lib/prisma";
import { fromDateColumn, localParts, toDateColumn, todayISO } from "@/lib/dates";
import type { SchoolWorkType } from "@/generated/prisma/client";

export type SchoolItem = {
  id: string;
  title: string;
  type: SchoolWorkType;
  subject: string | null;
  className: string | null;
  classColor: string | null;
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
        schoolWork: {
          select: {
            type: true,
            subject: true,
            class: { select: { name: true, color: true } },
          },
        },
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
      className: t.schoolWork.class?.name ?? null,
      classColor: t.schoolWork.class?.color ?? null,
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

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function parseMeeting(
  rrule: string | null,
  startsAt: Date,
  endsAt: Date,
): {
  summary: string | null;
  days: string[];
  start: string;
  end: string;
} {
  const m = rrule ? /BYDAY=([A-Z,]+)/.exec(rrule) : null;
  const days = m
    ? m[1]
        .split(",")
        .filter((d) => d in DAY_LABEL)
        .sort((a, b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b))
    : [];
  const sMin = localParts(startsAt).minutes;
  const eMin = localParts(endsAt).minutes;
  const start = `${pad2(Math.floor(sMin / 60))}:${pad2(sMin % 60)}`;
  const end = `${pad2(Math.floor(eMin / 60))}:${pad2(eMin % 60)}`;
  const summary = rrule
    ? days.length > 0
      ? `${days.map((d) => DAY_LABEL[d]).join(", ")} \u00b7 ${clock(sMin)}\u2013${clock(eMin)}`
      : `${clock(sMin)}\u2013${clock(eMin)}`
    : null;
  return { summary, days, start, end };
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
  subjectId: string | null;
  classTypeId: string | null;
  classTypeName: string | null;
  meeting: string | null;
  meetingDays: string[];
  meetingStart: string;
  meetingEnd: string;
  sharedWith: string[];
};

export type PersonClasses = {
  id: string;
  name: string;
  color: string;
  avatarPath: string | null;
  classes: ClassRow[];
};

export type SubjectRow = { id: string; name: string };
export type ClassTypeRow = { id: string; name: string };

export async function loadSchoolStructure(): Promise<{
  terms: TermRow[];
  people: PersonClasses[];
  subjects: SubjectRow[];
  classTypes: ClassTypeRow[];
}> {
  const [terms, people, classes, subjects, classTypes] = await Promise.all([
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
        subjectId: true,
        classTypeId: true,
        classType: { select: { name: true } },
        event: {
          select: {
            rrule: true,
            startsAt: true,
            endsAt: true,
            participants: { select: { userId: true } },
          },
        },
      },
    }),
    prisma.subject.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
    prisma.classType.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
  ]);

  const byUser = new Map<string, ClassRow[]>();
  for (const c of classes) {
    const parsed = c.event
      ? parseMeeting(c.event.rrule, c.event.startsAt, c.event.endsAt)
      : { summary: null, days: [] as string[], start: "", end: "" };
    const row: ClassRow = {
      id: c.id,
      name: c.name,
      color: c.color,
      termId: c.termId,
      subjectId: c.subjectId ?? null,
      classTypeId: c.classTypeId ?? null,
      classTypeName: c.classType?.name ?? null,
      meeting: parsed.summary,
      meetingDays: parsed.days,
      meetingStart: parsed.start,
      meetingEnd: parsed.end,
      sharedWith: c.event?.participants.map((p) => p.userId) ?? [],
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
    subjects,
    classTypes,
  };
}

export type ClassOption = { id: string; name: string; color: string | null };

/** Class options per student, for the assignment "class" picker. */
export async function loadClassOptions(): Promise<
  Record<string, ClassOption[]>
> {
  const classes = await prisma.schoolClass.findMany({
    orderBy: [{ sortOrder: "asc" }],
    select: { id: true, name: true, color: true, userId: true },
  });
  const map: Record<string, ClassOption[]> = {};
  for (const c of classes) {
    (map[c.userId] ??= []).push({ id: c.id, name: c.name, color: c.color });
  }
  return map;
}

// --- metrics (Phase 3) ---------------------------------------------------

export type SchoolClassStat = {
  key: string;
  color: string | null;
  total: number;
  completed: number;
};

export type SchoolMetrics = {
  userId: string;
  total: number;
  completed: number;
  onTime: number;
  overdue: number;
  byClass: SchoolClassStat[];
};

/**
 * Read-only completion stats for school work, optionally scoped to a term's
 * date range (by due date). Tracked, not scored — this is the honest picture
 * of what got done, per student and per class.
 */
export async function loadSchoolMetrics(
  range: { startISO: string; endISO: string } | null,
): Promise<SchoolMetrics[]> {
  const today = todayISO();
  const rows = await prisma.task.findMany({
    where: {
      category: "SCHOOL",
      schoolWork: { isNot: null },
      ...(range
        ? {
            dueDate: {
              gte: toDateColumn(range.startISO),
              lte: toDateColumn(range.endISO),
            },
          }
        : {}),
    },
    select: {
      userId: true,
      status: true,
      dueDate: true,
      completedAt: true,
      schoolWork: {
        select: {
          subject: true,
          class: { select: { name: true, color: true } },
        },
      },
    },
  });

  const byUser = new Map<string, SchoolMetrics>();
  const classes = new Map<string, Map<string, SchoolClassStat>>();

  const get = (userId: string) => {
    let row = byUser.get(userId);
    if (!row) {
      row = { userId, total: 0, completed: 0, onTime: 0, overdue: 0, byClass: [] };
      byUser.set(userId, row);
      classes.set(userId, new Map());
    }
    return row;
  };

  for (const t of rows) {
    if (!t.schoolWork) continue;
    const row = get(t.userId);
    const dueISO = fromDateColumn(t.dueDate);
    const done = t.status === "COMPLETE";
    row.total += 1;
    if (done) {
      row.completed += 1;
      const doneISO = t.completedAt
        ? localParts(t.completedAt).iso
        : dueISO;
      if (doneISO <= dueISO) row.onTime += 1;
    } else if (dueISO < today) {
      row.overdue += 1;
    }

    const label = t.schoolWork.class?.name ?? t.schoolWork.subject ?? "Other";
    const color = t.schoolWork.class?.color ?? null;
    const cmap = classes.get(t.userId)!;
    const c = cmap.get(label) ?? { key: label, color, total: 0, completed: 0 };
    c.total += 1;
    if (done) c.completed += 1;
    cmap.set(label, c);
  }

  for (const [userId, cmap] of classes) {
    byUser.get(userId)!.byClass = [...cmap.values()].sort((a, b) =>
      a.key.localeCompare(b.key),
    );
  }

  return [...byUser.values()];
}
