"use server";

import { revalidatePath } from "next/cache";
import { requireInteractive } from "@/lib/gate";
import { requireAdmin } from "@/lib/session";
import { Category, SchoolWorkType } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  addDays,
  fromDateColumn,
  householdTz,
  localParts,
  toDateColumn,
  todayISO,
  zonedToUtc,
} from "@/lib/dates";
import { buildRule } from "@/lib/calendar/recur";
import {
  getRolloverIntervalDays,
  setSetting,
  clearSetting,
  SCHOOL_ROLLOVER_INTERVAL,
  SCHOOL_ROLLOVER_SNOOZE,
  ROLLOVER_INTERVAL_DEFAULT,
  ROLLOVER_INTERVAL_MAX,
} from "@/lib/settings";

export type SchoolActionState = { error: string | null };

const TYPES = ["HOMEWORK", "ASSIGNMENT", "TEST", "PROJECT"] as const;

/**
 * A school assignment/test is a SCHOOL task with a SchoolWork detail row (type +
 * subject). Due date only, no time — timed classes live on the calendar. Added
 * by a student from their day, or by a parent from admin.
 */
export async function addSchoolWork(
  _prev: SchoolActionState,
  formData: FormData,
): Promise<SchoolActionState> {
  await requireInteractive();
  const userId = String(formData.get("userId") ?? "");
  const title = String(formData.get("title") ?? "")
    .trim()
    .slice(0, 120);
  const subject =
    String(formData.get("subject") ?? "")
      .trim()
      .slice(0, 60) || null;
  const rawType = String(formData.get("type") ?? "");
  const dueDate = String(formData.get("dueDate") ?? "") || todayISO();
  const rawClassId = String(formData.get("classId") ?? "").trim() || null;
  const dateSpecific = formData.get("dateSpecific") != null;
  const rawStart = String(formData.get("startDate") ?? "");
  // Optional due time, "HH:MM" → minutes from midnight. Blank leaves it null.
  const rawDueTime = String(formData.get("dueTime") ?? "").trim();
  let dueMinutes: number | null = null;
  if (/^\d{2}:\d{2}$/.test(rawDueTime)) {
    const [dh, dm] = rawDueTime.split(":").map(Number);
    if (dh >= 0 && dh < 24 && dm >= 0 && dm < 60) dueMinutes = dh * 60 + dm;
  }

  if (!userId) return { error: "Pick who this is for." };
  if (title.length < 2) return { error: "Give the assignment a name." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
    return { error: "That date isn't valid." };
  }

  // A window item can be worked from its start date (default today, or a chosen
  // future date) until it's done; a date-specific one has no window.
  let startDate: string | null = null;
  if (!dateSpecific) {
    startDate = /^\d{4}-\d{2}-\d{2}$/.test(rawStart) ? rawStart : todayISO();
    if (startDate > dueDate) {
      return { error: "The start date is after the due date." };
    }
  }

  const type: SchoolWorkType = (TYPES as readonly string[]).includes(rawType)
    ? (rawType as SchoolWorkType)
    : "ASSIGNMENT";

  // Only accept a class this student is actually in — the owner or a shared
  // member (membership, not just ownership, so shared classes work).
  let classId: string | null = null;
  if (rawClassId) {
    const member = await prisma.classMember.findFirst({
      where: { classId: rawClassId, userId },
      select: { classId: true },
    });
    classId = member?.classId ?? null;
  }

  await prisma.task.create({
    data: {
      userId,
      title,
      category: Category.SCHOOL,
      dueDate: toDateColumn(dueDate),
      schoolWork: {
        create: {
          type,
          subject,
          classId,
          dateSpecific,
          startDate: startDate ? toDateColumn(startDate) : null,
          dueMinutes,
        },
      },
    },
  });

  revalidatePath("/");
  revalidatePath(`/person/${userId}`);
  revalidatePath("/admin/school");
  return { error: null };
}

/** Delete a school item (the SchoolWork detail cascades with the task). */
export async function deleteSchoolWork(taskId: string): Promise<void> {
  await requireInteractive();
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { userId: true },
  });
  await prisma.task.delete({ where: { id: taskId } }).catch(() => {});
  revalidatePath("/");
  if (task) revalidatePath(`/person/${task.userId}`);
  revalidatePath("/admin/school");
}

// --- terms & classes (admin) ---------------------------------------------

const WEEKDAY_TOKENS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

function schoolStructureRevalidate() {
  revalidatePath("/admin/school");
  revalidatePath("/school");
  revalidatePath("/calendar");
  revalidatePath("/");
}

export async function addTerm(
  _prev: SchoolActionState,
  formData: FormData,
): Promise<SchoolActionState> {
  await requireAdmin();
  const name = String(formData.get("name") ?? "")
    .trim()
    .slice(0, 60);
  const start = String(formData.get("startDate") ?? "");
  const end = String(formData.get("endDate") ?? "");
  if (name.length < 2) return { error: "Give the term a name." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
    return { error: "Set start and end dates." };
  }
  if (end < start) return { error: "The term ends before it starts." };

  const count = await prisma.term.count();
  await prisma.term.create({
    data: {
      name,
      startDate: toDateColumn(start),
      endDate: toDateColumn(end),
      sortOrder: count,
    },
  });
  schoolStructureRevalidate();
  return { error: null };
}

export async function deleteTerm(id: string): Promise<void> {
  await requireAdmin();
  // Classes keep existing; their termId is set null by the FK.
  await prisma.term.delete({ where: { id } }).catch(() => {});
  schoolStructureRevalidate();
}

/**
 * The event fields for a class's meeting: weekly on the chosen weekdays, at the
 * chosen time, until the term ends. Returns null when there's no valid meeting.
 */
function meetingEventData(input: {
  userId: string;
  name: string;
  byday: string[];
  start: string;
  end: string;
  anchorISO: string;
  untilISO: string | null;
}) {
  const { userId, name, byday, start, end, anchorISO, untilISO } = input;
  if (byday.length === 0) return null;
  if (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end)) return null;

  const rrule = buildRule("WEEKLY", 1, untilISO, null, byday);
  const tz = householdTz();
  const [y, mo, d] = anchorISO.split("-").map(Number);
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const startsAt = zonedToUtc(y, mo, d, sh, sm, 0, tz);
  const endsAt = zonedToUtc(y, mo, d, eh, em, 0, tz);
  if (endsAt <= startsAt) return null;

  return {
    userId,
    kind: "CLASS" as const,
    title: name,
    startsAt,
    endsAt,
    allDay: false,
    rrule,
  };
}

/**
 * Create or edit a class. When `id` is present it's an edit: name, term, colour,
 * and meeting schedule can all change, and the linked CLASS calendar event is
 * created, updated, or removed to match.
 */
export async function saveClass(
  _prev: SchoolActionState,
  formData: FormData,
): Promise<SchoolActionState> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "").trim() || null;

  // The class name comes from the Subject pool now (like chores pick from the
  // master list). Either an existing subject is chosen, or a new one is typed
  // and added to the pool on the fly. A raw `name` is still accepted as a
  // fallback so older callers keep working.
  const subjectIdRaw = String(formData.get("subjectId") ?? "").trim() || null;
  const newSubject = String(formData.get("newSubject") ?? "")
    .trim()
    .slice(0, 60);
  const rawName = String(formData.get("name") ?? "")
    .trim()
    .slice(0, 60);

  let subjectId: string | null = null;
  let name = rawName;
  if (newSubject) {
    const subj = await prisma.subject.upsert({
      where: { name: newSubject },
      update: {},
      create: { name: newSubject },
      select: { id: true, name: true },
    });
    subjectId = subj.id;
    name = subj.name;
  } else if (subjectIdRaw) {
    const subj = await prisma.subject.findUnique({
      where: { id: subjectIdRaw },
      select: { id: true, name: true },
    });
    if (subj) {
      subjectId = subj.id;
      name = subj.name;
    }
  }

  const classTypeIdRaw =
    String(formData.get("classTypeId") ?? "").trim() || null;
  let classTypeId: string | null = null;
  if (classTypeIdRaw) {
    const ct = await prisma.classType.findUnique({
      where: { id: classTypeIdRaw },
      select: { id: true },
    });
    classTypeId = ct?.id ?? null;
  }

  const color = String(formData.get("color") ?? "").trim() || null;
  const promptHomework = formData.get("promptHomework") != null;
  let termId = String(formData.get("termId") ?? "").trim() || null;
  const start = String(formData.get("start") ?? "");
  const end = String(formData.get("end") ?? "");
  const byday = String(formData.get("byday") ?? "")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter((d) => WEEKDAY_TOKENS.includes(d));
  const sharedRaw = String(formData.get("sharedWith") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (name.length < 2) return { error: "Pick a subject for the class." };

  // The owner: from the form on create, from the existing row on edit.
  let userId = String(formData.get("userId") ?? "");
  let existingEventId: string | null = null;
  if (id) {
    const existing = await prisma.schoolClass.findUnique({
      where: { id },
      select: { userId: true, eventId: true },
    });
    if (!existing) return { error: "That class no longer exists." };
    userId = existing.userId;
    existingEventId = existing.eventId;
  }
  if (!userId) return { error: "Pick whose class this is." };

  const hasMeeting = byday.length > 0;
  if (hasMeeting && (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end))) {
    return { error: "Set a meeting start and end time." };
  }
  if (hasMeeting && end <= start) {
    return { error: "The class ends before it starts." };
  }

  let anchorISO = todayISO();
  let untilISO: string | null = null;
  if (termId) {
    const term = await prisma.term.findUnique({
      where: { id: termId },
      select: { startDate: true, endDate: true },
    });
    if (term) {
      anchorISO = fromDateColumn(term.startDate);
      untilISO = fromDateColumn(term.endDate);
    } else {
      termId = null;
    }
  }

  // A class can run a shorter window than its whole term (e.g. the first half of
  // the semester) or any custom span. These optional dates override the term's;
  // blank falls back to the term (or today / no end when there's no term).
  const customStart = String(formData.get("meetingStartDate") ?? "");
  const customEnd = String(formData.get("meetingEndDate") ?? "");
  if (/^\d{4}-\d{2}-\d{2}$/.test(customStart)) anchorISO = customStart;
  if (/^\d{4}-\d{2}-\d{2}$/.test(customEnd)) untilISO = customEnd;
  if (hasMeeting && untilISO && untilISO < anchorISO) {
    return { error: "The class's last day is before its first day." };
  }

  const evData = hasMeeting
    ? meetingEventData({ userId, name, byday, start, end, anchorISO, untilISO })
    : null;

  // Reconcile the meeting event.
  let eventId = existingEventId;
  if (evData && existingEventId) {
    await prisma.event.update({ where: { id: existingEventId }, data: evData });
  } else if (evData && !existingEventId) {
    const ev = await prisma.event.create({ data: evData, select: { id: true } });
    eventId = ev.id;
  } else if (!evData && existingEventId) {
    await prisma.event.delete({ where: { id: existingEventId } }).catch(() => {});
    eventId = null;
  }

  // Students sharing this class, validated against the active roster. Kept
  // independent of whether the class has a meeting time, so a no-time class
  // (a co-op, independent homeschool work) can still have several members.
  const sharedWanted = sharedRaw.filter((uid) => uid !== userId);
  const validShared =
    sharedWanted.length > 0
      ? (
          await prisma.user.findMany({
            where: { id: { in: sharedWanted }, isActive: true },
            select: { id: true },
          })
        ).map((u) => u.id)
      : [];

  // The meeting event's participants only exist to render a shared class as one
  // block on the calendar, so they're set only when there's a meeting event.
  if (eventId) {
    await prisma.eventParticipant.deleteMany({ where: { eventId } });
    if (validShared.length > 0) {
      await prisma.eventParticipant.createMany({
        data: validShared.map((uid) => ({ eventId, userId: uid })),
        skipDuplicates: true,
      });
    }
  }

  let classId = id;
  if (id) {
    await prisma.schoolClass.update({
      where: { id },
      data: { name, termId, subjectId, classTypeId, color, eventId, promptHomework },
    });
  } else {
    const count = await prisma.schoolClass.count({ where: { userId } });
    const created = await prisma.schoolClass.create({
      data: {
        name,
        userId,
        termId,
        subjectId,
        classTypeId,
        color,
        eventId,
        promptHomework,
        sortOrder: count,
      },
      select: { id: true },
    });
    classId = created.id;
  }

  // Reconcile membership: the owner plus any shared students. This is the
  // source of truth for whose work can be filed under the class.
  if (classId) {
    const memberIds = Array.from(new Set([userId, ...validShared]));
    await prisma.classMember.deleteMany({ where: { classId } });
    await prisma.classMember.createMany({
      data: memberIds.map((uid) => ({ classId: classId!, userId: uid })),
      skipDuplicates: true,
    });
  }

  schoolStructureRevalidate();
  return { error: null };
}

export async function deleteClass(id: string): Promise<void> {
  await requireAdmin();
  const cls = await prisma.schoolClass.findUnique({
    where: { id },
    select: { eventId: true },
  });
  await prisma.schoolClass.delete({ where: { id } }).catch(() => {});
  if (cls?.eventId) {
    await prisma.event.delete({ where: { id: cls.eventId } }).catch(() => {});
  }
  schoolStructureRevalidate();
}

// --- subject & class-type pools (admin) ----------------------------------

/**
 * Add a subject to the reusable pool. Names are unique and case-insensitively
 * de-duplicated, so "Math" can't be added twice, mirroring how the chore
 * master list behaves.
 */
export async function addSubject(
  _prev: SchoolActionState,
  formData: FormData,
): Promise<SchoolActionState> {
  await requireAdmin();
  const name = String(formData.get("name") ?? "")
    .trim()
    .slice(0, 60);
  if (name.length < 2) return { error: "Give the subject a name." };

  const existing = await prisma.subject.findFirst({
    where: { name: { equals: name, mode: "insensitive" } },
    select: { id: true },
  });
  if (existing) return { error: "That subject already exists." };

  const count = await prisma.subject.count();
  await prisma.subject.create({ data: { name, sortOrder: count } });
  schoolStructureRevalidate();
  return { error: null };
}

export async function renameSubject(id: string, name: string): Promise<void> {
  await requireAdmin();
  const clean = name.trim().slice(0, 60);
  if (clean.length < 2) return;
  // Renaming the pool entry renames every class currently using it, so the
  // name stays the single source of truth.
  await prisma.$transaction([
    prisma.subject.update({ where: { id }, data: { name: clean } }),
    prisma.schoolClass.updateMany({
      where: { subjectId: id },
      data: { name: clean },
    }),
  ]).catch(() => {});
  schoolStructureRevalidate();
}

export async function deleteSubject(id: string): Promise<void> {
  await requireAdmin();
  // Classes keep their name; only the pool link is cleared by the FK.
  await prisma.subject.delete({ where: { id } }).catch(() => {});
  schoolStructureRevalidate();
}

export async function addClassType(
  _prev: SchoolActionState,
  formData: FormData,
): Promise<SchoolActionState> {
  await requireAdmin();
  const name = String(formData.get("name") ?? "")
    .trim()
    .slice(0, 40);
  if (name.length < 2) return { error: "Give the class type a name." };

  const existing = await prisma.classType.findFirst({
    where: { name: { equals: name, mode: "insensitive" } },
    select: { id: true },
  });
  if (existing) return { error: "That class type already exists." };

  const count = await prisma.classType.count();
  await prisma.classType.create({ data: { name, sortOrder: count } });
  schoolStructureRevalidate();
  return { error: null };
}

export async function renameClassType(id: string, name: string): Promise<void> {
  await requireAdmin();
  const clean = name.trim().slice(0, 40);
  if (clean.length < 2) return;
  await prisma.classType.update({ where: { id }, data: { name: clean } }).catch(
    () => {},
  );
  schoolStructureRevalidate();
}

export async function deleteClassType(id: string): Promise<void> {
  await requireAdmin();
  await prisma.classType.delete({ where: { id } }).catch(() => {});
  schoolStructureRevalidate();
}

// --- semester rollover ----------------------------------------------------

/** Pull a class's weekly meeting back into byday + start/end times, so it can
 *  be rebuilt anchored to a new term. Null if the class has no meeting. */
function meetingFromEvent(
  ev: { rrule: string | null; startsAt: Date; endsAt: Date } | null,
): { byday: string[]; start: string; end: string } | null {
  if (!ev || !ev.rrule) return null;
  const m = /BYDAY=([^;]+)/i.exec(ev.rrule);
  const byday = m
    ? m[1]
        .split(",")
        .map((s) => s.trim().toUpperCase())
        .filter((d) => WEEKDAY_TOKENS.includes(d))
    : [];
  if (byday.length === 0) return null;
  const toHM = (d: Date) => {
    const min = localParts(d).minutes;
    const h = Math.floor(min / 60);
    const mm = min % 60;
    return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
  };
  return { byday, start: toHM(ev.startsAt), end: toHM(ev.endsAt) };
}

/** Create the next term and, for each ticked class, recreate it in that term —
 *  same subject, type, colour, owner, members and weekly meeting (re-anchored
 *  to the new term's dates). */
export async function createNextSemester(
  _prev: SchoolActionState,
  formData: FormData,
): Promise<SchoolActionState> {
  await requireAdmin();
  const name = String(formData.get("name") ?? "")
    .trim()
    .slice(0, 60);
  const start = String(formData.get("startDate") ?? "");
  const end = String(formData.get("endDate") ?? "");
  if (name.length < 2) return { error: "Give the new semester a name." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
    return { error: "Set start and end dates." };
  }
  if (end < start) return { error: "The term ends before it starts." };

  const reuseIds = formData
    .getAll("reuse")
    .map((v) => String(v))
    .filter(Boolean);

  const count = await prisma.term.count();
  const term = await prisma.term.create({
    data: {
      name,
      startDate: toDateColumn(start),
      endDate: toDateColumn(end),
      sortOrder: count,
    },
    select: { id: true },
  });

  if (reuseIds.length > 0) {
    const sources = await prisma.schoolClass.findMany({
      where: { id: { in: reuseIds } },
      select: {
        name: true,
        subjectId: true,
        classTypeId: true,
        color: true,
        userId: true,
        members: { select: { userId: true } },
        event: { select: { rrule: true, startsAt: true, endsAt: true } },
      },
    });

    for (const src of sources) {
      const meeting = meetingFromEvent(src.event);
      const evData = meeting
        ? meetingEventData({
            userId: src.userId,
            name: src.name,
            byday: meeting.byday,
            start: meeting.start,
            end: meeting.end,
            anchorISO: start,
            untilISO: end,
          })
        : null;

      let eventId: string | null = null;
      if (evData) {
        const ev = await prisma.event.create({
          data: evData,
          select: { id: true },
        });
        eventId = ev.id;
      }

      const cnt = await prisma.schoolClass.count({
        where: { userId: src.userId },
      });
      const created = await prisma.schoolClass.create({
        data: {
          name: src.name,
          userId: src.userId,
          termId: term.id,
          subjectId: src.subjectId,
          classTypeId: src.classTypeId,
          color: src.color,
          eventId,
          sortOrder: cnt,
        },
        select: { id: true },
      });

      const memberIds = Array.from(
        new Set([src.userId, ...src.members.map((m) => m.userId)]),
      );
      await prisma.classMember.createMany({
        data: memberIds.map((uid) => ({ classId: created.id, userId: uid })),
        skipDuplicates: true,
      });

      // Non-owner members ride the meeting event so it renders as one block.
      if (eventId) {
        const others = memberIds.filter((uid) => uid !== src.userId);
        if (others.length > 0) {
          await prisma.eventParticipant.createMany({
            data: others.map((uid) => ({ eventId: eventId!, userId: uid })),
            skipDuplicates: true,
          });
        }
      }
    }
  }

  // A newer term now exists, so the reminder condition clears on its own; drop
  // any snooze too.
  await clearSetting(SCHOOL_ROLLOVER_SNOOZE);
  schoolStructureRevalidate();
  return { error: null };
}

/** Push the "start a new semester" reminder out by the reminder interval. */
export async function snoozeRollover(): Promise<void> {
  await requireAdmin();
  const days = await getRolloverIntervalDays();
  await setSetting(SCHOOL_ROLLOVER_SNOOZE, addDays(todayISO(), days));
  schoolStructureRevalidate();
}

/** How often the reminder resurfaces once a term has ended. */
export async function setRolloverInterval(days: number): Promise<void> {
  await requireAdmin();
  const clamped = Math.min(
    ROLLOVER_INTERVAL_MAX,
    Math.max(1, Math.round(days || ROLLOVER_INTERVAL_DEFAULT)),
  );
  await setSetting(SCHOOL_ROLLOVER_INTERVAL, String(clamped));
  schoolStructureRevalidate();
}

/**
 * Record a member's answer to a post-class prompt: whether they attended, and
 * any work they reported. Attendance and work are independent — you can miss a
 * class and still have work, or attend with nothing assigned. The check-in is
 * what stops the prompt asking again; reported work becomes ordinary school
 * work linked to the class.
 */
export async function answerClassPrompt(input: {
  classId: string;
  userId: string;
  dateISO: string;
  attended: boolean;
  work?: { title: string; type: string; dueDate: string } | null;
}): Promise<{ error: string | null }> {
  await requireInteractive();
  const { classId, userId, dateISO, attended } = input;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) return { error: "Bad date." };

  // Guard: only a member of this class can answer its prompt.
  const member = await prisma.classMember.findFirst({
    where: { classId, userId },
    select: { classId: true },
  });
  if (!member) return { error: "Not in this class." };

  const date = toDateColumn(dateISO);
  await prisma.classCheckin.upsert({
    where: { classId_userId_date: { classId, userId, date } },
    update: { attended },
    create: { classId, userId, date, attended },
  });

  const w = input.work;
  if (w) {
    const title = w.title.trim().slice(0, 120);
    if (title.length >= 2 && /^\d{4}-\d{2}-\d{2}$/.test(w.dueDate)) {
      const type: SchoolWorkType = (TYPES as readonly string[]).includes(w.type)
        ? (w.type as SchoolWorkType)
        : "HOMEWORK";
      // A test shows only on its due date; other work runs from the class day
      // (when it was assigned) until done.
      const isTest = type === "TEST";
      await prisma.task.create({
        data: {
          userId,
          title,
          category: Category.SCHOOL,
          dueDate: toDateColumn(w.dueDate),
          schoolWork: {
            create: {
              type,
              classId,
              dateSpecific: isTest,
              startDate: isTest ? null : date,
            },
          },
        },
      });
    }
  }

  revalidatePath("/", "layout");
  revalidatePath(`/person/${userId}`);
  return { error: null };
}

/**
 * The pending work due on a class's meeting day, for the calendar event detail
 * popup: who has something due and what it is. Read-only; keyed on the class's
 * meeting event and the occurrence date.
 */
export async function classDueItems(
  eventId: string,
  dateISO: string,
): Promise<{
  className: string;
  items: { student: string; title: string; type: string }[];
} | null> {
  await requireInteractive();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) return null;
  const cls = await prisma.schoolClass.findFirst({
    where: { eventId },
    select: { id: true, name: true },
  });
  if (!cls) return null;

  const tasks = await prisma.task.findMany({
    where: {
      category: Category.SCHOOL,
      status: "PENDING",
      dueDate: toDateColumn(dateISO),
      schoolWork: { is: { classId: cls.id } },
    },
    orderBy: [{ userId: "asc" }],
    select: {
      title: true,
      user: { select: { name: true, displayName: true } },
      schoolWork: { select: { type: true } },
    },
  });

  return {
    className: cls.name,
    items: tasks.map((t) => ({
      student: t.user.displayName ?? t.user.name,
      title: t.title,
      type: t.schoolWork?.type ?? "",
    })),
  };
}

/**
 * Record (or clear) a test's score. score out of scoreMax; scoreMax defaults to
 * 100 so a plain percentage works. Feeds the Scholar stat — doing well pushes
 * School above the family baseline. Pass score null to clear it.
 */
export async function setTestScore(input: {
  taskId: string;
  score: number | null;
  scoreMax?: number;
}): Promise<{ error: string | null }> {
  await requireInteractive();

  const sw = await prisma.schoolWork.findUnique({
    where: { taskId: input.taskId },
    select: { id: true, type: true },
  });
  if (!sw) return { error: "That school item no longer exists." };
  if (sw.type !== "TEST") return { error: "Only tests take a score." };

  if (input.score == null) {
    await prisma.schoolWork.update({
      where: { id: sw.id },
      data: { score: null, scoreMax: null },
    });
  } else {
    const max = Math.round(input.scoreMax ?? 100);
    const scoreMax = Math.min(1000, Math.max(1, Number.isFinite(max) ? max : 100));
    const score = Math.min(scoreMax, Math.max(0, Math.round(input.score)));
    await prisma.schoolWork.update({
      where: { id: sw.id },
      data: { score, scoreMax },
    });
  }

  revalidatePath("/", "layout");
  return { error: null };
}
