import "server-only";
import { revalidatePath } from "next/cache";
import { rememberEventName } from "@/lib/event-names-core";
import { EventKind } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { householdTz, localParts, toDateColumn, zonedToUtc, addDays, daysBetween } from "@/lib/dates";
import { buildRule, parseRule, alignWeeklyByday, occurrencesIn } from "@/lib/calendar/recur";
import { cleanNotes } from "@/lib/calendar/event-notes";

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
  clientId?: string | null;
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
  /** Create only: a custom EventType id whose color wins. */
  eventTypeId?: string;
  /** A short free-text note. Kept only on the kinds that take one; see
   *  `cleanNotes`. Undefined leaves an existing note untouched on an update. */
  notes?: string;
  /** Whose event this is, when that is not the person making the request — the
   *  phone's calendar picker letting a parent file a child's appointment. Only
   *  a parent/admin may send someone else's id. */
  ownerId?: string;
  /** People (user ids) to share this event with, besides the owner. */
  participants?: string[];
  /** Minutes-before reminders (e.g. [15, 60]). Undefined leaves them unchanged
   *  on an update; on create, undefined means none. */
  reminders?: number[];
  /** User ids that receive the reminders. Undefined leaves them unchanged on an
   *  update; on create, undefined means nobody. */
  reminderUserIds?: string[];
};

const CREATE_KINDS = ["CLASS", "WORK", "APPOINTMENT", "BIRTHDAY", "OTHER"] as const;
function toKind(v: string | undefined): EventKind {
  return v && (CREATE_KINDS as readonly string[]).includes(v)
    ? (v as EventKind)
    : EventKind.APPOINTMENT;
}

/** Clean a reminders list: non-negative whole minutes, capped, deduped, sorted. */
function normalizeReminders(r: number[] | undefined): number[] {
  if (!Array.isArray(r)) return [];
  const clean = r
    .filter((n) => typeof n === "number" && Number.isFinite(n) && n >= 0)
    .map((n) => Math.min(40320, Math.round(n)));
  return [...new Set(clean)].sort((a, b) => a - b).slice(0, 5);
}

/** Clean a recipient list: distinct non-empty user id strings. */
function normalizeUserIds(ids: string[] | undefined): string[] {
  if (!Array.isArray(ids)) return [];
  return [...new Set(ids.filter((x) => typeof x === "string" && x.length > 0))];
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
    // Honor a multi-day span. The all-day end date is EXCLUSIVE (the day after
    // the last covered day), matching how events read back — so a one-day
    // event's stored end lands on the next day.
    const endDate =
      input.endDate && /^\d{4}-\d{2}-\d{2}$/.test(input.endDate)
        ? input.endDate
        : input.date;
    const exclusiveEnd = toDateColumn(endDate);
    const endsAt =
      exclusiveEnd > startsAt
        ? exclusiveEnd
        : new Date(startsAt.getTime() + 86_400_000);
    return { startsAt, endsAt };
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
): Promise<{ error: string | null; id?: string }> {
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

  // Whose event this is. A parent may file one under someone else (the phone's
  // calendar picker — a child's doctor appointment, a hockey practice); anyone
  // else only ever creates their own.
  const ownerRes = await resolveOwner(input.ownerId, actorUserId, canManageFamily);
  if ("error" in ownerRes) return { error: ownerRes.error };
  const owner = ownerRes.id;

  const t = computeTimes(input);
  if ("error" in t) return { error: t.error };

  const rrule =
    input.repeat && isFreq(input.repeat) ? buildRule(input.repeat, 1, null) : null;

  // Idempotency: a retried offline create whose response was lost returns the
  // already-created event instead of duplicating it.
  const clientId = (input.clientId ?? "").trim() || null;
  if (clientId) {
    const existing = await prisma.event.findFirst({ where: { clientId }, select: { id: true } });
    if (existing) return { error: null, id: existing.id };
  }

  const created = await prisma.event.create({
    data: {
      userId: isFamily ? null : owner,
      isFamily,
      kind,
      eventTypeId,
      title,
      location,
      notes: cleanNotes(input.notes, kind, eventTypeId),
      startsAt: t.startsAt,
      endsAt: t.endsAt,
      allDay: input.allDay,
      shadeDay: input.allDay,
      rrule,
      reminders: normalizeReminders(input.reminders),
      reminderUserIds: normalizeUserIds(input.reminderUserIds),
      clientId,
    },
    select: { id: true },
  });

  await setParticipants(created.id, input.participants, isFamily ? null : owner);

  revalidatePath("/calendar");
  revalidatePath("/");
  if (!isFamily) revalidatePath(`/person/${owner}`);
  await rememberEventName(title);
  return { error: null, id: created.id };
}

/**
 * Settle whose event this is. `requested` empty, or the actor's own id, keeps
 * the actor. Anyone else is a parent-only move and the id has to be a real
 * active member — the request names it, so it is never trusted on its own.
 */
async function resolveOwner(
  requested: string | undefined,
  actorUserId: string,
  canManageFamily: boolean,
): Promise<{ id: string } | { error: string }> {
  const want = (requested ?? "").trim();
  if (!want || want === actorUserId) return { id: actorUserId };
  if (!canManageFamily) {
    return { error: "Only a parent can file an event under someone else." };
  }
  const u = await prisma.user.findFirst({
    where: { id: want, isActive: true },
    select: { id: true },
  });
  if (!u) return { error: "That person isn't in the household." };
  return { id: u.id };
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
  scope: "single" | "series" | "future" = "series",
): Promise<{ error: string | null }> {
  const ev = await prisma.event.findUnique({ where: { id: eventId } });
  if (!ev) return { error: "That event is gone." };
  if (ev.externalCalendarId) return { error: "Subscribed events can't be edited here." };

  const recurring = Boolean(ev.rrule);
  const singleEdit = recurring && scope === "single";
  const seriesEdit = recurring && scope === "series";
  const futureEdit = recurring && scope === "future";

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
  // Whose it is afterwards. Resolved ONCE: the write paths below each used to
  // re-derive the owner, which is exactly where two copies drift apart.
  const ownerRes = await resolveOwner(input.ownerId, ev.userId ?? userId, canManageFamily);
  if ("error" in ownerRes) return { error: ownerRes.error };
  const ownerAfter = nextIsFamily ? null : ownerRes.id;

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

  // A series edit keeps the series anchored to its earliest occurrence, but still
  // honors a start-date / weekday change by shifting the whole series by however
  // many days the user moved the start; single / non-recurring edits use the
  // form's date.
  let seriesPieces: { id: string; startsAt: Date; rrule: string | null }[] = [];
  const openedISO = localParts(ev.startsAt).iso;
  let seriesStartISO = openedISO;
  if (seriesEdit) {
    const gid = ev.seriesId ?? ev.id;
    seriesPieces = await prisma.event.findMany({
      where: { OR: [{ id: gid }, { seriesId: gid }] },
      select: { id: true, startsAt: true, rrule: true },
    });
    for (const p of seriesPieces) {
      const pIso = localParts(p.startsAt).iso;
      if (pIso < seriesStartISO) seriesStartISO = pIso;
    }
  }
  const seriesShiftDays = seriesEdit ? daysBetween(openedISO, input.date) : 0;
  const dateForRow = seriesEdit
    ? addDays(seriesStartISO, seriesShiftDays)
    : input.date;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateForRow)) return { error: "Pick a date." };

  // Honor the event's own start→end day gap (overnight / multi-day / a
  // midnight end that lives on the next day) instead of forcing a same-day end.
  // For a recurring occurrence the row already shifted; the gap shifts with it.
  const endOffset = input.endDate ? daysBetween(input.date, input.endDate) : 0;
  const t = computeTimes({
    ...input,
    date: dateForRow,
    endDate: addDays(dateForRow, endOffset),
  });
  if ("error" in t) return { error: t.error };

  // A note only ever lives on a kind that takes one: use what the client sent
  // when it sent anything, keep what's there when it didn't, and drop it either
  // way once the kind the event ends up with can't hold one. A single-occurrence
  // override keeps the parent's kind, so it is judged by that.
  const notesKind = singleEdit ? ev.kind : nextKind;
  const notesTypeId = singleEdit
    ? ev.eventTypeId
    : nextTypeId !== undefined
      ? nextTypeId
      : ev.eventTypeId;

  const fields = {
    title,
    location,
    notes: cleanNotes(
      input.notes !== undefined ? input.notes : ev.notes,
      notesKind,
      notesTypeId,
    ),
    startsAt: t.startsAt,
    endsAt: t.endsAt,
    allDay: input.allDay,
    shadeDay: input.allDay,
    ...(input.reminders !== undefined
      ? { reminders: normalizeReminders(input.reminders) }
      : {}),
    ...(input.reminderUserIds !== undefined
      ? { reminderUserIds: normalizeUserIds(input.reminderUserIds) }
      : {}),
  };
  // Owner/kind/type apply to a normal or series edit (not a single-occurrence
  // override, which stays tied to its parent's identity).
  const ownerFields = singleEdit
    ? {}
    : {
        userId: ownerAfter,
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
  } else if (futureEdit) {
    // "This and future events": consolidate every piece of this logical series
    // from this occurrence forward into one fresh series with the edits, so a
    // series that was split, moved, or had occurrences deleted is reconnected.
    // Occurrences before this date keep their settings; per-occurrence changes
    // and deletions from this date on are reset and regenerated.
    const occ =
      input.occurrenceISO && /^\d{4}-\d{2}-\d{2}$/.test(input.occurrenceISO)
        ? input.occurrenceISO
        : input.date;
    const untilISO = addDays(occ, -1);
    const sid = ev.seriesId ?? ev.id;
    const r = parseRule(ev.rrule);
    const Dcol = toDateColumn(occ);
    const tz = householdTz();
    const pieces = await prisma.event.findMany({
      where: { OR: [{ id: sid }, { seriesId: sid }] },
      select: { id: true, startsAt: true, rrule: true },
    });
    let pastCount = 0;
    for (const p of pieces) {
      const pStart = localParts(p.startsAt).iso;
      if (pStart >= occ) {
        await prisma.event.deleteMany({ where: { recurrenceId: p.id } });
        await prisma.event.delete({ where: { id: p.id } });
      } else {
        const pr = parseRule(p.rrule);
        let cappedRule = p.rrule;
        if (pr) {
          const cappedUntil = pr.until && pr.until < untilISO ? pr.until : untilISO;
          cappedRule = buildRule(pr.freq, pr.interval, cappedUntil, null, pr.byday);
          await prisma.event.update({
            where: { id: p.id },
            data: { rrule: cappedRule, seriesId: sid },
          });
        }
        if (cappedRule) {
          pastCount += occurrencesIn(p.startsAt, cappedRule, pStart, untilISO, tz).length;
        }
        await prisma.event.deleteMany({
          where: { recurrenceId: p.id, recurrenceDate: { gte: Dcol } },
        });
      }
    }
    // Keep a count-limited series intact: the forward part keeps the remaining
    // count (and count isn't dropped as it was before).
    const remaining = r && r.count && r.count > 0
      ? Math.max(r.count - pastCount, 1)
      : null;
    const created = await prisma.event.create({
      data: {
        ...fields,
        userId: ownerAfter,
        isFamily: nextIsFamily,
        kind: nextKind,
        ...(nextTypeId !== undefined ? { eventTypeId: nextTypeId } : {}),
        rrule: alignWeeklyByday(
          r ? buildRule(r.freq, r.interval, r.until, remaining, r.byday) : ev.rrule,
          input.date,
        ),
        seriesId: sid,
      },
      select: { id: true },
    });
    await setParticipants(created.id, input.participants, ownerAfter);
  } else if (seriesEdit) {
    // "All events": consolidate every piece into one fresh series at the earliest
    // occurrence, clearing per-occurrence changes/deletions. Use the ongoing
    // (latest) piece's rule so the real end date is kept, not a capped one.
    const gid = ev.seriesId ?? ev.id;
    const latest = seriesPieces.reduce(
      (a, b) => (localParts(b.startsAt).iso > localParts(a.startsAt).iso ? b : a),
      seriesPieces[0] ?? { id: ev.id, startsAt: ev.startsAt, rrule: ev.rrule },
    );
    const lr = parseRule(latest.rrule);
    for (const p of seriesPieces) {
      await prisma.event.deleteMany({ where: { recurrenceId: p.id } });
      await prisma.event.delete({ where: { id: p.id } });
    }
    const created = await prisma.event.create({
      data: {
        ...fields,
        userId: ownerAfter,
        isFamily: nextIsFamily,
        kind: nextKind,
        ...(nextTypeId !== undefined ? { eventTypeId: nextTypeId } : {}),
        rrule: alignWeeklyByday(
          lr ? buildRule(lr.freq, lr.interval, lr.until, lr.count, lr.byday) : ev.rrule,
          dateForRow,
        ),
        seriesId: gid,
      },
      select: { id: true },
    });
    await setParticipants(created.id, input.participants, ownerAfter);
  } else {
    await prisma.event.update({ where: { id: eventId }, data: { ...fields, ...ownerFields } });
    await setParticipants(eventId, input.participants, ownerAfter);
  }

  revalidatePath("/calendar");
  revalidatePath("/");
  revalidatePath(`/person/${ev.userId}`);
  await rememberEventName(title);
  return { error: null };
}
