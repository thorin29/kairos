"use server";

import { revalidatePath } from "next/cache";
import { EventKind } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { householdTz, toDateColumn, zonedToUtc } from "@/lib/dates";
import { buildRule } from "@/lib/calendar/recur";
import { isAdmin } from "@/lib/session";

export type EventState = { error: string | null; saved: boolean };

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
  const userId = String(formData.get("userId") ?? "");
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

  if (!userId) return { error: "Pick whose event this is.", saved: false };
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

  await prisma.event.create({
    data: {
      userId,
      kind,
      title,
      location: location || null,
      startsAt,
      endsAt,
      allDay,
      rrule,
    },
  });

  revalidatePath("/calendar");
  revalidatePath("/");
  revalidatePath(`/person/${userId}`);
  return { error: null, saved: true };
}

export type DeleteState = { error: string | null };

export async function deleteEvent(id: string): Promise<DeleteState> {
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
