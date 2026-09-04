import "server-only";
import { revalidatePath } from "next/cache";
import { EventKind } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { householdTz, toDateColumn, zonedToUtc } from "@/lib/dates";

/**
 * Create a basic personal calendar event for the app's "+ new event" (Phase 3a).
 * Single occurrence, owned by `userId` — no recurrence, participants, event types
 * or family events yet (those, and editing, are later increments). The chosen
 * timezone (default the household tz) is used only to turn the typed wall-clock
 * into the stored instant, matching the household tz model; once stored the
 * event is a fixed moment.
 */

export type CreateEventInput = {
  title: string;
  allDay: boolean;
  date: string;
  start?: string;
  end?: string;
  endDate?: string;
  location?: string;
  timezone?: string;
};

function validTz(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export async function createPersonalEvent(
  userId: string,
  input: CreateEventInput,
): Promise<{ error: string | null }> {
  const title = input.title.trim().slice(0, 120);
  if (title.length < 2) return { error: "Give the event a name." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) return { error: "Pick a date." };
  const location = (input.location ?? "").trim().slice(0, 200) || null;

  let startsAt: Date;
  let endsAt: Date;

  if (input.allDay) {
    startsAt = toDateColumn(input.date);
    endsAt = new Date(startsAt.getTime() + 86_400_000);
  } else {
    const start = input.start ?? "";
    const end = input.end ?? "";
    if (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end)) {
      return { error: "Set a start and end time." };
    }
    const endDate =
      input.endDate && /^\d{4}-\d{2}-\d{2}$/.test(input.endDate)
        ? input.endDate
        : input.date;
    const tz = input.timezone && validTz(input.timezone) ? input.timezone : householdTz();

    const [y, mo, d] = input.date.split("-").map(Number);
    const [ey, emo, ed] = endDate.split("-").map(Number);
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);

    startsAt = zonedToUtc(y, mo, d, sh, sm, 0, tz);
    endsAt = zonedToUtc(ey, emo, ed, eh, em, 0, tz);
    if (endsAt <= startsAt) return { error: "The end time is before the start." };
  }

  await prisma.event.create({
    data: {
      userId,
      isFamily: false,
      kind: EventKind.APPOINTMENT,
      title,
      location,
      startsAt,
      endsAt,
      allDay: input.allDay,
      shadeDay: input.allDay,
      rrule: null,
    },
    select: { id: true },
  });

  revalidatePath("/calendar");
  revalidatePath("/");
  revalidatePath(`/person/${userId}`);
  return { error: null };
}
