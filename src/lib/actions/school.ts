"use server";

import { revalidatePath } from "next/cache";
import { requireInteractive } from "@/lib/gate";
import { requireAdmin } from "@/lib/session";
import { Category, SchoolWorkType } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  fromDateColumn,
  householdTz,
  toDateColumn,
  todayISO,
  zonedToUtc,
} from "@/lib/dates";
import { buildRule } from "@/lib/calendar/recur";

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

  // Only accept a class that belongs to this student.
  let classId: string | null = null;
  if (rawClassId) {
    const cls = await prisma.schoolClass.findFirst({
      where: { id: rawClassId, userId },
      select: { id: true },
    });
    classId = cls?.id ?? null;
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
  const name = String(formData.get("name") ?? "")
    .trim()
    .slice(0, 60);
  const color = String(formData.get("color") ?? "").trim() || null;
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

  if (name.length < 2) return { error: "Give the class a name." };

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

  // Share the meeting with other students by adding them as participants, so it
  // shows as one block on everyone's calendar. Only meaningful with a meeting.
  if (eventId) {
    const shared = sharedRaw.filter((uid) => uid !== userId);
    const valid =
      shared.length > 0
        ? (
            await prisma.user.findMany({
              where: { id: { in: shared }, isActive: true },
              select: { id: true },
            })
          ).map((u) => u.id)
        : [];
    await prisma.eventParticipant.deleteMany({ where: { eventId } });
    if (valid.length > 0) {
      await prisma.eventParticipant.createMany({
        data: valid.map((uid) => ({ eventId, userId: uid })),
        skipDuplicates: true,
      });
    }
  }

  if (id) {
    await prisma.schoolClass.update({
      where: { id },
      data: { name, termId, color, eventId },
    });
  } else {
    const count = await prisma.schoolClass.count({ where: { userId } });
    await prisma.schoolClass.create({
      data: { name, userId, termId, color, eventId, sortOrder: count },
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
