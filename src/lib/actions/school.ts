"use server";

import { revalidatePath } from "next/cache";
import { syncPlanUnitDone } from "@/lib/school/plan-unit-sync";
import {
  approveSubjectCore,
  approveTermCore,
  meetingEventData,
  mergeSubjectCore,
  mergeTermCore,
  persistClass,
  schoolStructureRevalidate,
  WEEKDAY_TOKENS,
} from "@/lib/school/structure-core";
import { isHexColor } from "@/lib/palette";
import { requireInteractive, requireCanActFor } from "@/lib/gate";
import { requireAdmin, isAdmin } from "@/lib/session";
import { currentUser } from "@/lib/user-session";
import { getClassFromCalendarMode, SCHOOL_CLASS_FROM_CALENDAR } from "@/lib/settings";
import { Category, SchoolWorkType, TaskStatus } from "@/generated/prisma/client";
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
  await requireCanActFor(userId);
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
  if (!task) return;
  await requireCanActFor(task.userId);
  await prisma.task.delete({ where: { id: taskId } }).catch(() => {});
  revalidatePath("/");
  revalidatePath(`/person/${task.userId}`);
  revalidatePath("/admin/school");
}

/**
 * Edit a school assignment/test: title, type, subject, class, and due date. The
 * class must be one the student is actually in (owner or shared member), same
 * rule as adding. Used by the admin School page.
 */
export async function editSchoolWork(input: {
  id: string;
  title: string;
  type: string;
  subject?: string | null;
  classId?: string | null;
  dueDate: string;
}): Promise<SchoolActionState> {
  await requireInteractive();
  const task = await prisma.task.findUnique({
    where: { id: input.id },
    select: { userId: true, schoolWork: { select: { id: true } } },
  });
  if (!task || !task.schoolWork) {
    return { error: "That assignment no longer exists." };
  }
  await requireCanActFor(task.userId);

  const title = String(input.title ?? "").trim().slice(0, 120);
  if (title.length < 2) return { error: "Give the assignment a name." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.dueDate)) {
    return { error: "That date isn't valid." };
  }

  const type: SchoolWorkType = (TYPES as readonly string[]).includes(input.type)
    ? (input.type as SchoolWorkType)
    : "ASSIGNMENT";

  const subject = String(input.subject ?? "").trim().slice(0, 60) || null;

  // Only accept a class this student is actually in (membership, like add).
  let classId: string | null = null;
  const rawClassId = String(input.classId ?? "").trim() || null;
  if (rawClassId) {
    const member = await prisma.classMember.findFirst({
      where: { classId: rawClassId, userId: task.userId },
      select: { classId: true },
    });
    classId = member?.classId ?? null;
  }

  await prisma.task.update({
    where: { id: input.id },
    data: { title, dueDate: toDateColumn(input.dueDate) },
  });
  await prisma.schoolWork.update({
    where: { id: task.schoolWork.id },
    data: { type, subject, classId },
  });

  revalidatePath("/");
  revalidatePath(`/person/${task.userId}`);
  revalidatePath("/admin/school");
  return { error: null };
}

// --- terms & classes (admin) ---------------------------------------------


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
 * Create or edit a class. When `id` is present it's an edit: name, term, color,
 * and meeting schedule can all change, and the linked CLASS calendar event is
 * created, updated, or removed to match.
 */
export async function saveClass(
  _prev: SchoolActionState,
  formData: FormData,
): Promise<SchoolActionState> {
  await requireAdmin();
  return persistClass(formData);
}

// Toggle-gated entry point for creating or editing a class from the calendar's
// "Class" event type. When the household setting allows "anyone", any
// interactive user may use it — and a non-admin's new class is owned by them,
// and they may only edit a class they're in. Otherwise it stays admin-only,
// exactly like the admin form. The subject/term/type pools stay admin-only
// either way.
export async function saveClassFromCalendar(
  _prev: SchoolActionState,
  formData: FormData,
): Promise<SchoolActionState> {
  const mode = await getClassFromCalendarMode();
  if (mode === "anyone") {
    await requireInteractive();
  } else {
    await requireAdmin();
  }
  const admin = await isAdmin();
  const me = await currentUser();
  const editId = String(formData.get("id") ?? "").trim() || null;
  if (editId && !admin) {
    const member = me
      ? await prisma.classMember.findFirst({
          where: { classId: editId, userId: me.id },
          select: { id: true },
        })
      : null;
    if (!member) return { error: "You can only edit your own classes." };
  }
  const forcedOwnerId = admin ? undefined : me?.id;
  if (!admin && !forcedOwnerId) return { error: "Sign in to add a class." };
  return persistClass(formData, forcedOwnerId);
}

export async function setClassFromCalendarMode(
  mode: "admin" | "anyone",
): Promise<void> {
  await requireAdmin();
  await setSetting(SCHOOL_CLASS_FROM_CALENDAR, mode === "anyone" ? "anyone" : "admin");
  schoolStructureRevalidate();
  revalidatePath("/calendar");
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
  // A new subject starts in its own group (its own colour) — Marco can drag it
  // under another base later.
  const baseCount = await prisma.baseSubject.count();
  const base = await prisma.baseSubject.upsert({
    where: { name },
    update: {},
    create: { name, sortOrder: baseCount },
    select: { id: true },
  });
  await prisma.subject.create({
    data: { name, sortOrder: count, baseSubjectId: base.id },
  });
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

/** Set (or clear) a subject's base-subject group and optional colour override.
 *  Empty base groups the subject on its own; an empty/invalid colour clears the
 *  override so it falls back to the group colour. */
export async function setSubjectMeta(
  id: string,
  baseSubject: string | null,
  color: string | null,
): Promise<void> {
  await requireAdmin();
  const base = (baseSubject ?? "").trim().slice(0, 60) || null;
  const raw = (color ?? "").trim();
  const col = isHexColor(raw) ? raw.toLowerCase() : null;
  await prisma.subject
    .update({ where: { id }, data: { baseSubject: base, color: col } })
    .catch(() => {});
  schoolStructureRevalidate();
}

// --- base subjects (colour groups) --------------------------------------------

export async function createBaseSubject(name: string): Promise<void> {
  await requireAdmin();
  const clean = name.trim().slice(0, 60);
  if (clean.length < 1) return;
  const count = await prisma.baseSubject.count();
  await prisma.baseSubject
    .create({ data: { name: clean, sortOrder: count } })
    .catch(() => {});
  schoolStructureRevalidate();
}

export async function renameBaseSubject(id: string, name: string): Promise<void> {
  await requireAdmin();
  const clean = name.trim().slice(0, 60);
  if (clean.length < 1) return;
  await prisma.baseSubject.update({ where: { id }, data: { name: clean } }).catch(() => {});
  schoolStructureRevalidate();
}

export async function setBaseSubjectColor(id: string, color: string | null): Promise<void> {
  await requireAdmin();
  const raw = (color ?? "").trim();
  const col = isHexColor(raw) ? raw.toLowerCase() : null;
  await prisma.baseSubject.update({ where: { id }, data: { color: col } }).catch(() => {});
  schoolStructureRevalidate();
}

/** Delete a group. Only allowed when empty — move its subjects out first. */
export async function deleteBaseSubject(id: string): Promise<void> {
  await requireAdmin();
  const count = await prisma.subject.count({ where: { baseSubjectId: id } });
  if (count > 0) return;
  await prisma.baseSubject.delete({ where: { id } }).catch(() => {});
  schoolStructureRevalidate();
}

/** Move a subject under a different group (the drag target). */
export async function assignSubjectToBase(
  subjectId: string,
  baseSubjectId: string,
): Promise<void> {
  await requireAdmin();
  await prisma.subject
    .update({ where: { id: subjectId }, data: { baseSubjectId } })
    .catch(() => {});
  schoolStructureRevalidate();
}

/** Give a subject its own group (find or create a base named after it). */
export async function promoteSubject(subjectId: string): Promise<void> {
  await requireAdmin();
  const sub = await prisma.subject.findUnique({
    where: { id: subjectId },
    select: { name: true },
  });
  if (!sub) return;
  const count = await prisma.baseSubject.count();
  const base = await prisma.baseSubject.upsert({
    where: { name: sub.name },
    update: {},
    create: { name: sub.name, sortOrder: count },
    select: { id: true },
  });
  await prisma.subject
    .update({ where: { id: subjectId }, data: { baseSubjectId: base.id } })
    .catch(() => {});
  schoolStructureRevalidate();
}

// --- subject colour groups (subject = group, class = member) -------------------

/** Move every class with this name under a subject (affects all students). */
export async function assignClassToSubject(
  className: string,
  subjectId: string,
): Promise<void> {
  await requireAdmin();
  const name = className.trim();
  if (!name) return;
  await prisma.schoolClass
    .updateMany({ where: { name }, data: { subjectId } })
    .catch(() => {});
  schoolStructureRevalidate();
}

/** Give a class its own colour: find/create a subject named after it, put the
 *  class there. */
export async function promoteClass(className: string): Promise<void> {
  await requireAdmin();
  const name = className.trim();
  if (!name) return;
  const count = await prisma.subject.count();
  const subj = await prisma.subject.upsert({
    where: { name },
    update: {},
    create: { name, sortOrder: count },
    select: { id: true },
  });
  await prisma.schoolClass
    .updateMany({ where: { name }, data: { subjectId: subj.id } })
    .catch(() => {});
  schoolStructureRevalidate();
}

export async function setSubjectColor(id: string, color: string | null): Promise<void> {
  await requireAdmin();
  const raw = (color ?? "").trim();
  const col = isHexColor(raw) ? raw.toLowerCase() : null;
  await prisma.subject.update({ where: { id }, data: { color: col } }).catch(() => {});
  schoolStructureRevalidate();
}

/** Rename a subject GROUP header — does not touch the class display names under it. */
export async function renameSubjectGroup(id: string, name: string): Promise<void> {
  await requireAdmin();
  const clean = name.trim().slice(0, 60);
  if (clean.length < 1) return;
  await prisma.subject.update({ where: { id }, data: { name: clean } }).catch(() => {});
  schoolStructureRevalidate();
}

export async function createSubjectGroup(name: string): Promise<void> {
  await requireAdmin();
  const clean = name.trim().slice(0, 60);
  if (clean.length < 1) return;
  const existing = await prisma.subject.findFirst({
    where: { name: { equals: clean, mode: "insensitive" } },
    select: { id: true },
  });
  if (existing) return;
  const count = await prisma.subject.count();
  await prisma.subject.create({ data: { name: clean, sortOrder: count } }).catch(() => {});
  schoolStructureRevalidate();
}

/** Delete an empty subject group (no classes under it). */
export async function deleteSubjectGroup(id: string): Promise<void> {
  await requireAdmin();
  const count = await prisma.schoolClass.count({ where: { subjectId: id } });
  if (count > 0) return;
  await prisma.subject.delete({ where: { id } }).catch(() => {});
  schoolStructureRevalidate();
}

// --- approval of user-proposed subjects & terms -------------------------------

export async function approveSubject(id: string, name: string): Promise<void> {
  await requireAdmin();
  return approveSubjectCore(id, name);
}

export async function mergeSubject(pendingId: string, targetId: string): Promise<void> {
  await requireAdmin();
  return mergeSubjectCore(pendingId, targetId);
}

export async function approveTerm(
  id: string,
  name: string,
  start: string,
  end: string,
): Promise<void> {
  await requireAdmin();
  return approveTermCore(id, name, start, end);
}

export async function mergeTerm(pendingId: string, targetId: string): Promise<void> {
  await requireAdmin();
  return mergeTermCore(pendingId, targetId);
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
 *  same subject, type, color, owner, members and weekly meeting (re-anchored
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
  await requireCanActFor(userId);
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
  const owner = await prisma.task.findUnique({
    where: { id: input.taskId },
    select: { userId: true },
  });
  if (owner) await requireCanActFor(owner.userId);

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

/** Admin toggle for whether a piece of school work is completed. Sets the task
 *  status and keeps the linked plan unit's done flag in sync (it drives pace and
 *  the plan view). Used by the completion-edit mode on the School work page. */
export async function setSchoolWorkComplete(
  taskId: string,
  complete: boolean,
): Promise<void> {
  await requireAdmin();
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    // Only userId now: the plan unit is resolved by syncPlanUnitDone, which
    // does its own lookup so every completion path gets the same behaviour.
    select: { userId: true },
  });
  if (!task) return;
  await prisma.task.update({
    where: { id: taskId },
    data: {
      status: complete ? TaskStatus.COMPLETE : TaskStatus.PENDING,
      completedAt: complete ? new Date() : null,
    },
  });
  // The parameter, not `task.id` — this `select` does not include `id`, and a
  // field missing from a select is invisible until the real build typechecks it.
  await syncPlanUnitDone(taskId, complete);
  revalidatePath("/admin/school/work");
  revalidatePath("/");
  revalidatePath(`/person/${task.userId}`);
  revalidatePath("/tasks");
}

/** Admin toggle for a pre-completed ("skipped on upload") plan unit that has no
 *  task — flips its done flag so it shows complete or reopens for scheduling. */
export async function setPlanUnitDone(unitId: string, done: boolean): Promise<void> {
  await requireAdmin();
  const unit = await prisma.classPlanUnit.findUnique({
    where: { id: unitId },
    select: { plan: { select: { class: { select: { userId: true } } } } },
  });
  await prisma.classPlanUnit.update({ where: { id: unitId }, data: { done } });
  revalidatePath("/admin/school/work");
  const userId = unit?.plan.class.userId;
  if (userId) revalidatePath(`/person/${userId}`);
  revalidatePath("/");
}
