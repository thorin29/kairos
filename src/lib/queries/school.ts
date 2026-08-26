import "server-only";
import { prisma } from "@/lib/prisma";
import {
  addDays,
  daysBetween,
  fromDateColumn,
  householdTz,
  localParts,
  toDateColumn,
  todayISO,
} from "@/lib/dates";
import { occurrencesIn, parseRule } from "@/lib/calendar/recur";
import {
  getSetting,
  getRolloverIntervalDays,
  SCHOOL_ROLLOVER_SNOOZE,
} from "@/lib/settings";
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
  avatarPosition: string | null;
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
        avatarPath: true, avatarPosition: true,
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
      avatarPosition: p.avatarPosition,
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
  promptHomework: boolean;
  // The class owner (the student whose class this is). A class is listed under
  // every member now, so this distinguishes the owner from a student it's
  // shared with.
  ownerId: string;
  ownerName: string;
  eventId: string | null;
  meeting: string | null;
  meetingDays: string[];
  meetingStart: string;
  meetingEnd: string;
  // The meeting's actual first day and last day (rrule anchor + UNTIL). Usually
  // the term's dates, but can be a shorter window (a half-semester class).
  meetingStartDate: string | null;
  meetingEndDate: string | null;
  sharedWith: string[];
};

export type PersonClasses = {
  id: string;
  name: string;
  color: string;
  avatarPath: string | null;
  avatarPosition: string | null;
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
        avatarPath: true, avatarPosition: true,
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
        eventId: true,
        classType: { select: { name: true } },
        promptHomework: true,
        members: { select: { userId: true } },
        event: {
          select: {
            rrule: true,
            startsAt: true,
            endsAt: true,
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

  const nameById = new Map<string, string>(
    people.map((p) => [p.id, (p.displayName ?? p.name) as string] as const),
  );

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
      promptHomework: c.promptHomework,
      ownerId: c.userId,
      ownerName: nameById.get(c.userId) ?? "",
      eventId: c.eventId ?? null,
      meeting: parsed.summary,
      meetingDays: parsed.days,
      meetingStart: parsed.start,
      meetingEnd: parsed.end,
      meetingStartDate: c.event ? localParts(c.event.startsAt).iso : null,
      meetingEndDate: c.event ? (parseRule(c.event.rrule)?.until ?? null) : null,
      sharedWith: c.members
        .map((m) => m.userId)
        .filter((uid) => uid !== c.userId),
    };
    // List the class under every member — the owner and everyone it's shared
    // with — so it appears the same way under each student's name, not just the
    // owner's.
    const memberIds =
      c.members.length > 0
        ? Array.from(new Set(c.members.map((m) => m.userId)))
        : [c.userId];
    for (const uid of memberIds) {
      const list = byUser.get(uid) ?? [];
      list.push(row);
      byUser.set(uid, list);
    }
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
      avatarPosition: p.avatarPosition,
      classes: byUser.get(p.id) ?? [],
    })),
    subjects,
    classTypes,
  };
}

export type ClassOption = { id: string; name: string; color: string | null };

/** Class options per student, for the assignment "class" picker. A shared
 *  class shows up for every member, not just the owner, so anyone in it can
 *  file work under it. */
export async function loadClassOptions(): Promise<
  Record<string, ClassOption[]>
> {
  const classes = await prisma.schoolClass.findMany({
    orderBy: [{ sortOrder: "asc" }],
    select: {
      id: true,
      name: true,
      color: true,
      userId: true,
      members: { select: { userId: true } },
    },
  });
  const map: Record<string, ClassOption[]> = {};
  for (const c of classes) {
    const memberIds =
      c.members.length > 0 ? c.members.map((m) => m.userId) : [c.userId];
    const option = { id: c.id, name: c.name, color: c.color };
    for (const uid of memberIds) {
      (map[uid] ??= []).push(option);
    }
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

// --- semester rollover ----------------------------------------------------

export type RolloverCandidate = {
  id: string;
  name: string;
  ownerName: string;
  memberNames: string[];
  meeting: string | null;
  typeName: string | null;
};

export type RolloverState = {
  needed: boolean;
  intervalDays: number;
  fromTerm: {
    id: string;
    name: string;
    startISO: string;
    endISO: string;
  } | null;
  suggestedStartISO: string;
  suggestedEndISO: string;
  candidates: RolloverCandidate[];
};

/**
 * Whether it's time to start a new semester, plus the material for the prompt.
 * "Time" means the most recently-ending term is already over and nothing newer
 * covers today or the future — and the admin hasn't snoozed the reminder past
 * today. Reuse candidates are the classes from that just-ended term.
 */
export async function loadRolloverState(today: string): Promise<RolloverState> {
  const [terms, intervalDays, snoozeUntil] = await Promise.all([
    prisma.term.findMany({ orderBy: [{ endDate: "desc" }] }),
    getRolloverIntervalDays(),
    getSetting(SCHOOL_ROLLOVER_SNOOZE),
  ]);

  const base: RolloverState = {
    needed: false,
    intervalDays,
    fromTerm: null,
    suggestedStartISO: "",
    suggestedEndISO: "",
    candidates: [],
  };
  if (terms.length === 0) return base;

  const latest = terms[0];
  const latestStartISO = fromDateColumn(latest.startDate);
  const latestEndISO = fromDateColumn(latest.endDate);
  const over = latestEndISO < today;
  const snoozed = !!snoozeUntil && today < snoozeUntil;
  const needed = over && !snoozed;

  // Suggest the next term running the day after the last one ended, for the
  // same length — the admin can adjust before creating it.
  const suggestedStartISO = addDays(latestEndISO, 1);
  const durationDays = Math.max(1, daysBetween(latestStartISO, latestEndISO));
  const suggestedEndISO = addDays(suggestedStartISO, durationDays);

  const classes = await prisma.schoolClass.findMany({
    where: { termId: latest.id },
    orderBy: [{ sortOrder: "asc" }],
    select: {
      id: true,
      name: true,
      userId: true,
      classType: { select: { name: true } },
      user: { select: { name: true, displayName: true } },
      members: {
        select: {
          userId: true,
          user: { select: { name: true, displayName: true } },
        },
      },
      event: { select: { rrule: true, startsAt: true, endsAt: true } },
    },
  });

  const candidates: RolloverCandidate[] = classes.map((c) => {
    const parsed = c.event
      ? parseMeeting(c.event.rrule, c.event.startsAt, c.event.endsAt)
      : null;
    const ownerName = c.user.displayName ?? c.user.name;
    const memberNames = c.members.map((m) => m.user.displayName ?? m.user.name);
    return {
      id: c.id,
      name: c.name,
      ownerName,
      memberNames: memberNames.length > 0 ? memberNames : [ownerName],
      meeting: parsed?.summary ?? null,
      typeName: c.classType?.name ?? null,
    };
  });

  return {
    needed,
    intervalDays,
    fromTerm: {
      id: latest.id,
      name: latest.name,
      startISO: latestStartISO,
      endISO: latestEndISO,
    },
    suggestedStartISO,
    suggestedEndISO,
    candidates,
  };
}

/** Active subject names from the pool, for the assignment form's subject
 *  picker. */
export async function loadSubjectNames(): Promise<string[]> {
  const rows = await prisma.subject.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { name: true },
  });
  return rows.map((r) => r.name);
}

// --- post-class prompt ----------------------------------------------------

export type ClassPrompt = {
  classId: string;
  userId: string;
  className: string;
  dateISO: string;
};

// How far back an unanswered prompt lingers. A safety net for "didn't check
// the tablet for a few days"; beyond this the occasion has passed.
const CLASS_PROMPT_LOOKBACK_DAYS = 14;

/**
 * The pending "after class" prompts: for each class opted in, each member is
 * asked — once per meeting — whether they attended and whether work was
 * assigned. A prompt appears only after that meeting's end time has passed, and
 * lingers until answered (a ClassCheckin). To stay manageable, only the most
 * recent unanswered meeting per class per member surfaces at a time; answering
 * it reveals the next, if any remain in the window.
 */
export async function pendingClassPrompts(
  today: string = todayISO(),
): Promise<ClassPrompt[]> {
  const tz = householdTz();
  const now = Date.now();
  const fromISO = addDays(today, -CLASS_PROMPT_LOOKBACK_DAYS);

  const classes = await prisma.schoolClass.findMany({
    where: { promptHomework: true, eventId: { not: null } },
    select: {
      id: true,
      name: true,
      members: { select: { userId: true } },
      event: { select: { startsAt: true, endsAt: true, rrule: true } },
    },
  });
  if (classes.length === 0) return [];

  // Ended meeting dates per class, newest first.
  const endedByClass = new Map<string, string[]>();
  for (const c of classes) {
    if (!c.event) continue;
    const durationMs =
      c.event.endsAt.getTime() - c.event.startsAt.getTime();
    const starts = c.event.rrule
      ? occurrencesIn(c.event.startsAt, c.event.rrule, fromISO, today, tz)
      : [c.event.startsAt];
    const ended: string[] = [];
    for (const s of starts) {
      const iso = localParts(s).iso;
      if (iso < fromISO || iso > today) continue;
      if (s.getTime() + durationMs <= now) ended.push(iso);
    }
    if (ended.length > 0) {
      ended.sort((a, b) => (a < b ? 1 : -1));
      endedByClass.set(c.id, ended);
    }
  }
  if (endedByClass.size === 0) return [];

  const classIds = [...endedByClass.keys()];
  const checkins = await prisma.classCheckin.findMany({
    where: {
      classId: { in: classIds },
      date: { gte: toDateColumn(fromISO), lte: toDateColumn(today) },
    },
    select: { classId: true, userId: true, date: true },
  });
  const answered = new Set(
    checkins.map((c) => `${c.classId}|${c.userId}|${fromDateColumn(c.date)}`),
  );

  const prompts: ClassPrompt[] = [];
  for (const c of classes) {
    const dates = endedByClass.get(c.id);
    if (!dates) continue;
    for (const m of c.members) {
      const d = dates.find(
        (dt) => !answered.has(`${c.id}|${m.userId}|${dt}`),
      );
      if (d) {
        prompts.push({
          classId: c.id,
          userId: m.userId,
          className: c.name,
          dateISO: d,
        });
      }
    }
  }
  return prompts;
}
