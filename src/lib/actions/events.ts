"use server";

import { revalidatePath } from "next/cache";
import { requireInteractive } from "@/lib/gate";
import { EventKind } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { householdTz, localParts, toDateColumn, zonedToUtc } from "@/lib/dates";
import { buildRule } from "@/lib/calendar/recur";
import { isAdmin } from "@/lib/session";
import { isHexColor } from "@/lib/palette";
import {
  setSetting,
  CAL_NOW_COLOR,
  CAL_RESET_SEC,
  CAL_ALLDAY_WASH,
} from "@/lib/settings";

export type EventState = { error: string | null; saved: boolean };

/** Clamp a default-duration input to a sane range, or null to leave it unset. */
function normalizeMinutes(m: number | null): number | null {
  if (m == null || !Number.isFinite(m) || m <= 0) return null;
  return Math.max(5, Math.min(600, Math.round(m)));
}

/** Create a custom event type (admin). */
export async function addEventType(
  name: string,
  color: string,
  sportWorkout = false,
  defaultMinutes: number | null = null,
): Promise<{ error: string | null }> {
  if (!(await isAdmin())) return { error: "Only a parent can do that." };
  const clean = name.trim().slice(0, 40);
  if (clean.length < 2) return { error: "Give the type a name." };
  if (!isHexColor(color)) return { error: "Pick a colour." };
  const mins = normalizeMinutes(defaultMinutes);

  const exists = await prisma.eventType.findUnique({
    where: { name: clean },
    select: { id: true },
  });
  if (exists) return { error: "That type already exists." };

  const count = await prisma.eventType.count();
  await prisma.eventType.create({
    data: {
      name: clean,
      color,
      sportWorkout,
      defaultMinutes: mins,
      sortOrder: count,
    },
  });
  revalidatePath("/calendar");
  revalidatePath("/admin/calendar");
  return { error: null };
}

/** Set the calendar now-line colour and manual-scroll reset (admin). */
export async function setCalendarPrefs(
  nowColor: string,
  scrollResetSec: number,
  allDayWash: boolean,
): Promise<{ error: string | null }> {
  if (!(await isAdmin())) return { error: "Only a parent can do that." };
  if (!isHexColor(nowColor)) return { error: "Pick a colour." };
  const sec = Math.max(0, Math.min(3600, Math.round(scrollResetSec)));
  await setSetting(CAL_NOW_COLOR, nowColor);
  await setSetting(CAL_RESET_SEC, String(sec));
  await setSetting(CAL_ALLDAY_WASH, allDayWash ? "1" : "0");
  revalidatePath("/calendar");
  revalidatePath("/admin/calendar");
  return { error: null };
}

/** Rename / recolour a custom event type (admin). */
export async function updateEventType(
  id: string,
  name: string,
  color: string,
  sportWorkout = false,
  defaultMinutes: number | null = null,
): Promise<{ error: string | null }> {
  if (!(await isAdmin())) return { error: "Only a parent can do that." };
  const clean = name.trim().slice(0, 40);
  if (clean.length < 2) return { error: "Give the type a name." };
  if (!isHexColor(color)) return { error: "Pick a colour." };
  const mins = normalizeMinutes(defaultMinutes);
  const clash = await prisma.eventType.findFirst({
    where: { name: clean, id: { not: id } },
    select: { id: true },
  });
  if (clash) return { error: "That name is taken." };
  await prisma.eventType
    .update({
      where: { id },
      data: { name: clean, color, sportWorkout, defaultMinutes: mins },
    })
    .catch(() => {});
  revalidatePath("/calendar");
  revalidatePath("/admin/calendar");
  return { error: null };
}

/** Delete a custom event type; its events fall back to their kind colour. */
export async function deleteEventType(id: string): Promise<{ error: string | null }> {
  if (!(await isAdmin())) return { error: "Only a parent can do that." };
  await prisma.eventType.delete({ where: { id } }).catch(() => {});
  revalidatePath("/calendar");
  revalidatePath("/admin/calendar");
  return { error: null };
}

const KINDS = [
  "CLASS",
  "WORK",
  "APPOINTMENT",
  "BIRTHDAY",
  "OTHER",
] as const;

const FREQS = ["DAILY", "WEEKLY", "MONTHLY", "YEARLY"] as const;

/**
 * Times are entered as wall-clock in the household timezone and stored as
 * real instants, so a 4pm shift stays 4pm across a DST change.
 */
export async function addEvent(
  _prev: EventState,
  formData: FormData,
): Promise<EventState> {
  await requireInteractive();
  const owner = String(formData.get("userId") ?? "");
  const isFamily = owner === "family";
  const title = String(formData.get("title") ?? "").trim().slice(0, 120);
  const rawKind = String(formData.get("kind") ?? "");
  const date = String(formData.get("date") ?? "");
  const start = String(formData.get("start") ?? "");
  const end = String(formData.get("end") ?? "");
  const allDay = formData.get("allDay") === "on";
  const location = String(formData.get("location") ?? "").trim().slice(0, 200);
  const repeat = String(formData.get("repeat") ?? "NONE");
  const interval = Number(formData.get("interval") ?? 1);
  const until = String(formData.get("until") ?? "").trim();

  if (!owner) return { error: "Pick whose event this is.", saved: false };
  if (title.length < 2) return { error: "Give the event a name.", saved: false };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { error: "Pick a date.", saved: false };
  }

  const kind = (KINDS as readonly string[]).includes(rawKind)
    ? (rawKind as EventKind)
    : EventKind.OTHER;

  const rawTypeId = String(formData.get("eventTypeId") ?? "").trim();
  let eventTypeId: string | null = null;
  if (rawTypeId) {
    const t = await prisma.eventType.findUnique({
      where: { id: rawTypeId },
      select: { id: true },
    });
    eventTypeId = t?.id ?? null;
  }

  let startsAt: Date;
  let endsAt: Date;

  if (allDay) {
    startsAt = toDateColumn(date);
    endsAt = new Date(startsAt.getTime() + 86_400_000);
  } else {
    if (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end)) {
      return { error: "Set a start and end time.", saved: false };
    }

    const tz = householdTz();
    const [y, mo, d] = date.split("-").map(Number);
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);

    startsAt = zonedToUtc(y, mo, d, sh, sm, 0, tz);
    endsAt = zonedToUtc(y, mo, d, eh, em, 0, tz);

    if (endsAt <= startsAt) {
      return { error: "The end time is before the start.", saved: false };
    }
  }

  let rrule: string | null = null;
  if ((FREQS as readonly string[]).includes(repeat)) {
    if (!Number.isInteger(interval) || interval < 1 || interval > 52) {
      return { error: "Repeat every 1 to 52.", saved: false };
    }
    if (until && !/^\d{4}-\d{2}-\d{2}$/.test(until)) {
      return { error: "That end date isn't valid.", saved: false };
    }
    if (until && until < date) {
      return { error: "The repeat ends before it starts.", saved: false };
    }
    rrule = buildRule(
      repeat as "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY",
      interval,
      until || null,
    );
  }

  const created = await prisma.event.create({
    data: {
      userId: isFamily ? null : owner,
      isFamily,
      kind,
      eventTypeId,
      title,
      location: location || null,
      startsAt,
      endsAt,
      allDay,
      rrule,
    },
    select: { id: true },
  });

  // People attending (beyond the owner) — for a sport event these each get a
  // completion prompt. Ignore "family" and the empty owner sentinel.
  const participantIds = [
    ...new Set(
      formData
        .getAll("participants")
        .map(String)
        .filter((id) => id && id !== "family"),
    ),
  ];
  if (participantIds.length) {
    await prisma.eventParticipant.createMany({
      data: participantIds.map((userId) => ({ eventId: created.id, userId })),
      skipDuplicates: true,
    });
  }

  revalidatePath("/calendar");
  revalidatePath("/");
  if (!isFamily) revalidatePath(`/person/${owner}`);
  return { error: null, saved: true };
}

export type EventCopyData = {
  title: string;
  userId: string;
  kind: string;
  location: string;
  allDay: boolean;
  start: string;
  end: string;
  date: string;
};

const hhmm = (min: number): string =>
  `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

/**
 * The fields needed to pre-fill the add-event form as a copy of an existing
 * event. GridEvent doesn't carry the owner id or the event-type id, so a copy
 * reads them off the base row here. Times come back as wall-clock in the
 * household timezone; the caller supplies the day the copy should land on.
 */
export async function eventCopyData(id: string): Promise<EventCopyData | null> {
  await requireInteractive();
  const e = await prisma.event.findUnique({
    where: { id },
    select: {
      title: true,
      userId: true,
      isFamily: true,
      eventTypeId: true,
      kind: true,
      location: true,
      allDay: true,
      startsAt: true,
      endsAt: true,
    },
  });
  if (!e) return null;

  const s = localParts(e.startsAt);
  const en = localParts(e.endsAt);
  return {
    title: e.title,
    userId: e.isFamily ? "family" : (e.userId ?? ""),
    kind: e.eventTypeId ? `type:${e.eventTypeId}` : (e.kind as string),
    location: e.location ?? "",
    allDay: e.allDay,
    start: hhmm(s.minutes),
    end: hhmm(en.minutes),
    date: s.iso,
  };
}

export type DeleteState = { error: string | null };

export async function deleteEvent(id: string): Promise<DeleteState> {
  await requireInteractive();
  const event = await prisma.event.findUnique({ where: { id } });
  if (!event) return { error: null };

  // Subscribed events are owned by their feed — removing one here would
  // just bring it back on the next sync. Unsubscribe instead.
  if (event.externalCalendarId) {
    return { error: "Unsubscribe from the feed to remove its events." };
  }

  // A repeating event and a birthday both affect far more than the day
  // you're looking at, so removing one is a parent decision.
  if (event.rrule || event.kind === "BIRTHDAY") {
    if (!(await isAdmin())) {
      return {
        error: "Only a parent can delete a repeating event or a birthday.",
      };
    }
  }

  await prisma.event.delete({ where: { id } });

  revalidatePath("/calendar");
  revalidatePath("/");
  revalidatePath(`/person/${event.userId}`);
  return { error: null };
}
