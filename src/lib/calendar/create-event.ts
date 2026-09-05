import "server-only";
import { revalidatePath } from "next/cache";
import { EventKind } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { householdTz, localParts, toDateColumn, zonedToUtc } from "@/lib/dates";
import { buildRule } from "@/lib/calendar/recur";

/**
 * Create / update a basic personal calendar event for the app (Phase 3a-b).
 * Single occurrence, owned by `userId` — no recurrence, participants, event types
 * or family events yet. The chosen timezone (default the household tz) is used
 * only to turn the typed wall-clock into the stored instant; once stored the
 * event is a fixed moment.
 */

export type EventInput = {
  title: string;
  allDay: boolean;
  date: string;
  start?: string;
  end?: string;
  endDate?: string;
  location?: string;
  timezone?: string;
  /** NONE | DAILY | WEEKLY | MONTHLY | YEARLY (create only, interval 1 for now). */
  repeat?: string;
  /** The home-tz date of the occurrence being edited (for single-scope edits). */
  occurrenceISO?: string;
};

const FREQS = ["DAILY", "WEEKLY", "MONTHLY", "YEARLY"] as const;
type Freq = (typeof FREQS)[number];
const isFreq = (v: string): v is Freq => (FREQS as readonly string[]).includes(v);

function validTz(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Turn the typed date/time(s) into stored instants, or an error message. */
function computeTimes(
  input: EventInput,
): { startsAt: Date; endsAt: Date } | { error: string } {
  if (input.allDay) {
    const startsAt = toDateColumn(input.date);
    return { startsAt, endsAt: new Date(startsAt.getTime() + 86_400_000) };
  }
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
  const startsAt = zonedToUtc(y, mo, d, sh, sm, 0, tz);
  const endsAt = zonedToUtc(ey, emo, ed, eh, em, 0, tz);
  if (endsAt <= startsAt) return { error: "The end time is before the start." };
  return { startsAt, endsAt };
}

export async function createPersonalEvent(
  userId: string,
  input: EventInput,
): Promise<{ error: string | null }> {
  const title = input.title.trim().slice(0, 120);
  if (title.length < 2) return { error: "Give the event a name." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) return { error: "Pick a date." };
  const location = (input.location ?? "").trim().slice(0, 200) || null;

  const t = computeTimes(input);
  if ("error" in t) return { error: t.error };

  const rrule =
    input.repeat && isFreq(input.repeat) ? buildRule(input.repeat, 1, null) : null;

  await prisma.event.create({
    data: {
      userId,
      isFamily: false,
      kind: EventKind.APPOINTMENT,
      title,
      location,
      startsAt: t.startsAt,
      endsAt: t.endsAt,
      allDay: input.allDay,
      shadeDay: input.allDay,
      rrule,
    },
    select: { id: true },
  });

  revalidatePath("/calendar");
  revalidatePath("/");
  revalidatePath(`/person/${userId}`);
  return { error: null };
}

/** Update a personal event. For a repeating event, `scope` is "single" (edit
 *  just this occurrence as a detached override) or "series" (edit the parent,
 *  admin-only). Non-recurring events ignore scope. Changing the repeat *pattern*
 *  isn't supported here yet — a series edit keeps the existing rule. */
export async function updatePersonalEvent(
  userId: string,
  eventId: string,
  input: EventInput,
  isAdmin: boolean,
  scope: "single" | "series" = "series",
): Promise<{ error: string | null }> {
  const ev = await prisma.event.findUnique({ where: { id: eventId } });
  if (!ev) return { error: "That event is gone." };
  if (ev.externalCalendarId) return { error: "Subscribed events can't be edited here." };

  const recurring = Boolean(ev.rrule);
  const singleEdit = recurring && scope === "single";
  const seriesEdit = recurring && scope === "series";

  if ((seriesEdit || ev.kind === "BIRTHDAY") && !isAdmin) {
    return { error: "Only a parent can edit a repeating event or a birthday." };
  }
  if (!ev.isFamily && ev.userId !== userId && !isAdmin) {
    return { error: "You can only edit your own events." };
  }

  const title = input.title.trim().slice(0, 120);
  if (title.length < 2) return { error: "Give the event a name." };
  const location = (input.location ?? "").trim().slice(0, 200) || null;

  // A series edit keeps the series anchored to its original start date and only
  // changes the time of day; single / non-recurring edits use the form's date.
  const dateForRow = seriesEdit ? localParts(ev.startsAt).iso : input.date;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateForRow)) return { error: "Pick a date." };

  const t = computeTimes({ ...input, date: dateForRow, endDate: dateForRow });
  if ("error" in t) return { error: t.error };

  const fields = {
    title,
    location,
    startsAt: t.startsAt,
    endsAt: t.endsAt,
    allDay: input.allDay,
    shadeDay: input.allDay,
  };

  if (singleEdit) {
    const occ =
      input.occurrenceISO && /^\d{4}-\d{2}-\d{2}$/.test(input.occurrenceISO)
        ? input.occurrenceISO
        : input.date;
    const overrideDate = toDateColumn(occ);
    const existing = await prisma.event.findFirst({
      where: { recurrenceId: eventId, recurrenceDate: overrideDate },
      select: { id: true },
    });
    if (existing) {
      await prisma.event.update({ where: { id: existing.id }, data: fields });
    } else {
      await prisma.event.create({
        data: {
          ...fields,
          userId: ev.userId,
          isFamily: ev.isFamily,
          kind: ev.kind,
          rrule: null,
          recurrenceId: eventId,
          recurrenceDate: overrideDate,
        },
        select: { id: true },
      });
    }
  } else {
    await prisma.event.update({ where: { id: eventId }, data: fields });
  }

  revalidatePath("/calendar");
  revalidatePath("/");
  revalidatePath(`/person/${ev.userId}`);
  return { error: null };
}
