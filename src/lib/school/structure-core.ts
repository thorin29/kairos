import "server-only";
// School structure writes shared by the web admin actions (actions/school.ts,
// which guard them) and the app's device-auth API routes (which authorise the
// device first). Kept out of the "use server" module on purpose (v0.699): every
// export of a "use server" file is a callable server action, and these have no
// guard of their own.
import type { SchoolActionState } from "@/lib/actions/school";

import { revalidatePath } from "next/cache";
import { syncPlanUnitDone } from "@/lib/school/plan-unit-sync";
import { isHexColor } from "@/lib/palette";
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


export const WEEKDAY_TOKENS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

export function schoolStructureRevalidate() {
  revalidatePath("/admin/school");
  revalidatePath("/school");
  revalidatePath("/calendar");
  revalidatePath("/");
}

/**
 * The event fields for a class's meeting: weekly on the chosen weekdays, at the
 * chosen time, until the term ends. Returns null when there's no valid meeting.
 */
export function meetingEventData(input: {
  userId: string;
  name: string;
  byday: string[];
  start: string;
  end: string;
  anchorISO: string;
  untilISO: string | null;
  reminders?: number[];
  reminderUserIds?: string[];
  location?: string | null;
}) {
  const { userId, name, byday, start, end, anchorISO, untilISO, reminders = [], reminderUserIds = [], location = null } = input;
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
    reminders,
    reminderUserIds,
    location: location && location.trim() ? location.trim() : null,
  };
}

export async function persistClass(
  formData: FormData,
  forcedOwnerId?: string,
): Promise<SchoolActionState> {
  const id = String(formData.get("id") ?? "").trim() || null;
  // When an old bare "Class" block is being upgraded into a real class, this is
  // the block's event id, so we can remove it once the real class exists.
  const replaceEventId =
    String(formData.get("replaceEventId") ?? "").trim() || null;
  // A non-admin (forcedOwnerId set) can propose a new subject/term, but it stays
  // pending until an admin approves it, so it's hidden from everyone else's
  // pickers meanwhile. An admin's inline additions are approved immediately.
  const proposerNonAdmin = forcedOwnerId !== undefined;
  const proposedById = proposerNonAdmin ? forcedOwnerId : null;

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
      create: {
        name: newSubject,
        pending: proposerNonAdmin,
        proposedById,
      },
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
  // A brand-new semester can be created inline from the class form (like a new
  // subject). It needs a name and a date range; when valid, it's created and
  // selected for this class.
  const newTermName = String(formData.get("newTermName") ?? "").trim().slice(0, 60);
  const newTermStart = String(formData.get("newTermStart") ?? "");
  const newTermEnd = String(formData.get("newTermEnd") ?? "");
  if (
    newTermName.length >= 2 &&
    /^\d{4}-\d{2}-\d{2}$/.test(newTermStart) &&
    /^\d{4}-\d{2}-\d{2}$/.test(newTermEnd) &&
    newTermEnd >= newTermStart
  ) {
    const termCount = await prisma.term.count();
    const created = await prisma.term.create({
      data: {
        name: newTermName,
        startDate: toDateColumn(newTermStart),
        endDate: toDateColumn(newTermEnd),
        sortOrder: termCount,
        pending: proposerNonAdmin,
        proposedById,
      },
      select: { id: true },
    });
    termId = created.id;
  }
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
  let userId = forcedOwnerId ?? String(formData.get("userId") ?? "");
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

  const reminderMins = formData
    .getAll("reminders")
    .map(Number)
    .filter((m) => Number.isFinite(m) && m > 0);
  const reminderBell = formData
    .getAll("reminderBell")
    .map(String)
    .filter(Boolean);
  const evData = hasMeeting
    ? meetingEventData({
        userId,
        name,
        byday,
        start,
        end,
        anchorISO,
        untilISO,
        reminders: reminderMins,
        reminderUserIds: reminderBell,
        location: String(formData.get("location") ?? ""),
      })
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

  // Upgrading an old bare block: now that the real class (and its own meeting
  // event) exist, remove the original block so it isn't left as a duplicate.
  if (replaceEventId && replaceEventId !== eventId) {
    await prisma.event.delete({ where: { id: replaceEventId } }).catch(() => {});
  }

  schoolStructureRevalidate();
  revalidatePath("/calendar");
  return { error: null };
}

// Auth-free cores so both the web admin actions and the app's device-auth API
// route share one implementation.
export async function approveSubjectCore(id: string, name: string): Promise<void> {
  const clean = name.trim().slice(0, 60);
  if (clean.length < 2) return;
  await prisma
    .$transaction([
      prisma.subject.update({
        where: { id },
        data: { name: clean, pending: false, proposedById: null },
      }),
      prisma.schoolClass.updateMany({
        where: { subjectId: id },
        data: { name: clean },
      }),
    ])
    .catch(() => {});
  schoolStructureRevalidate();
}

export async function mergeSubjectCore(
  pendingId: string,
  targetId: string,
): Promise<void> {
  if (pendingId === targetId) return;
  const target = await prisma.subject.findUnique({
    where: { id: targetId },
    select: { name: true },
  });
  if (!target) return;
  await prisma
    .$transaction([
      prisma.schoolClass.updateMany({
        where: { subjectId: pendingId },
        data: { subjectId: targetId, name: target.name },
      }),
      prisma.subject.delete({ where: { id: pendingId } }),
    ])
    .catch(() => {});
  schoolStructureRevalidate();
}

export async function approveTermCore(
  id: string,
  name: string,
  start: string,
  end: string,
): Promise<void> {
  const clean = name.trim().slice(0, 60);
  if (clean.length < 2) return;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
    return;
  }
  if (end < start) return;
  await prisma.term
    .update({
      where: { id },
      data: {
        name: clean,
        startDate: toDateColumn(start),
        endDate: toDateColumn(end),
        pending: false,
        proposedById: null,
      },
    })
    .catch(() => {});
  schoolStructureRevalidate();
}

export async function mergeTermCore(
  pendingId: string,
  targetId: string,
): Promise<void> {
  if (pendingId === targetId) return;
  const target = await prisma.term.findUnique({
    where: { id: targetId },
    select: { id: true },
  });
  if (!target) return;
  await prisma
    .$transaction([
      prisma.schoolClass.updateMany({
        where: { termId: pendingId },
        data: { termId: targetId },
      }),
      prisma.term.delete({ where: { id: pendingId } }),
    ])
    .catch(() => {});
  schoolStructureRevalidate();
}
