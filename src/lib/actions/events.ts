"use server";

import { revalidatePath } from "next/cache";
import { EventKind } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { householdTz, toDateColumn, zonedToUtc } from "@/lib/dates";
import { canActFor } from "@/lib/session";

export type EventState = { error: string | null; saved: boolean };

const KINDS = ["CLASS", "WORK", "APPOINTMENT", "OTHER"] as const;

/**
 * Times are entered as wall-clock in the household timezone and stored as
 * real instants, so a 4pm shift stays 4pm across a DST change.
 */
export async function addEvent(
  _prev: EventState,
  formData: FormData,
): Promise<EventState> {
  const userId = String(formData.get("userId") ?? "");
  const title = String(formData.get("title") ?? "").trim().slice(0, 120);
  const rawKind = String(formData.get("kind") ?? "");
  const date = String(formData.get("date") ?? "");
  const start = String(formData.get("start") ?? "");
  const end = String(formData.get("end") ?? "");
  const allDay = formData.get("allDay") === "on";
  const location = String(formData.get("location") ?? "").trim().slice(0, 200);

  if (!userId) return { error: "Pick whose event this is.", saved: false };
  if (!(await canActFor(userId))) {
    return {
      error: "You can only add events to your own calendar.",
      saved: false,
    };
  }
  if (title.length < 2) return { error: "Give the event a name.", saved: false };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { error: "Pick a date.", saved: false };
  }

  const kind = (KINDS as readonly string[]).includes(rawKind)
    ? (rawKind as EventKind)
    : EventKind.OTHER;

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

  await prisma.event.create({
    data: {
      userId,
      kind,
      title,
      location: location || null,
      startsAt,
      endsAt,
      allDay,
    },
  });

  revalidatePath("/calendar");
  revalidatePath("/");
  revalidatePath(`/person/${userId}`);
  return { error: null, saved: true };
}

export async function deleteEvent(id: string): Promise<void> {
  const event = await prisma.event.findUnique({ where: { id } });
  if (!event) return;
  if (!(await canActFor(event.userId))) return;

  // Subscribed events are owned by their feed — removing one here would
  // just bring it back on the next sync. Unsubscribe instead.
  if (event.externalCalendarId) return;

  await prisma.event.delete({ where: { id } });

  revalidatePath("/calendar");
  revalidatePath("/");
  revalidatePath(`/person/${event.userId}`);
}
