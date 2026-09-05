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
  /** Create only: the family calendar (needs parent/admin) vs the actor's own. */
  isFamily?: boolean;
  /** Create only: CLASS | WORK | APPOINTMENT | BIRTHDAY | OTHER. */
  kind?: string;
  /** Create only: a custom EventType id whose colour wins. */
  eventTypeId?: string;
  /** People (user ids) to share this event with, besides the owner. */
  participants?: string[];
};

const CREATE_KINDS = ["CLASS", "WORK", "APPOINTMENT", "BIRTHDAY", "OTHER"] as const;
function toKind(v: string | undefined): EventKind {
  return v && (CREATE_KINDS as readonly string[]).includes(v)
    ? (v as EventKind)
    : EventKind.APPOINTMENT;
}

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
  actorUserId: string,
  input: EventInput,
  canManageFamily: boolean,
): Promise<{ error: string | null }> {
  const isFamily = input.isFamily === true;
  if (isFamily && !canManageFamily) {
    return { error: "Only a parent can add to the family calendar." };
  }
  const kind = toKind(input.kind);

  const title = input.title.trim().slice(0, 120);
  if (title.length < 2) return { error: "Give the event a name." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) return { error: "Pick a date." };
  const location = (input.location ?? "").trim().slice(0, 200) || null;

  let eventTypeId: string | null = null;
  if (input.eventTypeId) {
    const t = await prisma.eventType.findUnique({
      where: { id: input.eventTypeId },
      select: { id: true },
    });
    eventTypeId = t?.id ?? null;
  }

  const t = computeTimes(input);
  if ("error" in t) return { error: t.error };

  const rrule =
    input.repeat && isFreq(input.repeat) ? buildRule(input.repeat, 1, null) : null;

  const created = await prisma.event.create({
    data: {
      userId: isFamily ? null : actorUserId,
      isFamily,
      kind,
      eventTypeId,
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

  await setParticipants(created.id, input.participants, isFamily ? null : actorUserId);

  revalidatePath("/calendar");
  revalidatePath("/");
  if (!isFamily) revalidatePath(`/person/${actorUserId}`);
  return { error: null };
}

/** Replace an event's shared-with people (excluding the owner), validating ids. */
async function setParticipants(
  eventId: string,
  participants: string[] | undefined,
  ownerId: string | null,
): Promise<void> {
  if (participants === undefined) return;
  const ids = [...new Set(participants)].filter((p) => p && p !== ownerId);
  await prisma.eventParticipant.deleteMany({ where: { eventId } });
  if (ids.length === 0) return;
  const valid = await prisma.user.findMany({
    where: { id: { in: ids }, isActive: true },
    select: { id: true },
  });
  if (valid.length === 0) return;
  await prisma.eventParticipant.createMany({
    data: valid.map((u) => ({ eventId, userId: u.id })),
    skipDuplicates: true,
  });
}

/** Update a personal event. For a repeating event, `scope` is "single" (edit
 *  just this occurrence as a detached override) or "series" (edit the parent,
 *  admin-only). Non-recurring events ignore scope. Changing the repeat *pattern*
 *  isn't supported here yet — a series edit keeps the existing rule. */
export async function updatePersonalEvent(
  userId: string,
  eventId: string,
  input: EventInput,
  canManageFamily: boolean,
  scope: "single" | "series" = "series",
): Promise<{ error: string | null }> {
  const ev = await prisma.event.findUnique({ where: { id: eventId } });
  if (!ev) return { error: "That event is gone." };
  if (ev.externalCalendarId) return { error: "Subscribed events can't be edited here." };

  const recurring = Boolean(ev.rrule);
  const singleEdit = recurring && scope === "single";
  const seriesEdit = recurring && scope === "series";

  if ((seriesEdit || ev.kind === "BIRTHDAY") && !canManageFamily) {
    return { error: "Only a parent can edit a repeating event or a birthday." };
  }
  if (!ev.isFamily && ev.userId !== userId && !canManageFamily) {
    return { error: "You can only edit your own events." };
  }

  const title = input.title.trim().slice(0, 120);
  if (title.length < 2) return { error: "Give the event a name." };
  const location = (input.location ?? "").trim().slice(0, 200) || null;

  // Type and owner can change on a plain (non-recurring or series) edit. Moving
  // to the family calendar needs parent/admin; birthdays likewise (already gated
  // above). Kind isn't changed on a single-occurrence override.
  const nextIsFamily = input.isFamily === true;
  if (nextIsFamily && !canManageFamily) {
    return { error: "Only a parent can move an event to the family calendar." };
  }
  const nextKind = input.kind !== undefined ? toKind(input.kind) : ev.kind;
  if (nextKind === "BIRTHDAY" && !canManageFamily) {
    return { error: "Only a parent can make an event a birthday." };
  }
  let nextTypeId: string | null | undefined = undefined;
  if (input.kind !== undefined) {
    // The app sends kind + eventTypeId together as one type selection, so a
    // built-in kind (no eventTypeId) clears any custom type.
    if (input.eventTypeId) {
      const t = await prisma.eventType.findUnique({
        where: { id: input.eventTypeId },
        select: { id: true },
      });
      nextTypeId = t?.id ?? null;
    } else {
      nextTypeId = null;
    }
  }

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
  // Owner/kind/type apply to a normal or series edit (not a single-occurrence
  // override, which stays tied to its parent's identity).
  const ownerFields = singleEdit
    ? {}
    : {
        userId: nextIsFamily ? null : ev.userId ?? userId,
        isFamily: nextIsFamily,
        kind: nextKind,
        ...(nextTypeId !== undefined ? { eventTypeId: nextTypeId } : {}),
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
    let targetId: string;
    if (existing) {
      await prisma.event.update({ where: { id: existing.id }, data: fields });
      targetId = existing.id;
    } else {
      const created = await prisma.event.create({
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
      targetId = created.id;
    }
    await setParticipants(targetId, input.participants, ev.isFamily ? null : ev.userId);
  } else {
    await prisma.event.update({ where: { id: eventId }, data: { ...fields, ...ownerFields } });
    const ownerAfter = nextIsFamily ? null : ev.userId ?? userId;
    await setParticipants(eventId, input.participants, ownerAfter);
  }

  revalidatePath("/calendar");
  revalidatePath("/");
  revalidatePath(`/person/${ev.userId}`);
  return { error: null };
}
