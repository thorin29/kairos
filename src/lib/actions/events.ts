"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { rememberEventName } from "@/lib/event-names-core";
import { requireInteractive } from "@/lib/gate";
import { EventKind } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  householdTz,
  localParts,
  toDateColumn,
  zonedToUtc,
  addDays,
  daysBetween,
} from "@/lib/dates";
import { buildRule, parseRule, alignWeeklyByday, occurrencesIn } from "@/lib/calendar/recur";
import { deleteEventCore } from "@/lib/calendar/delete-event-core";
import { isAdmin, requireAdmin } from "@/lib/session";
import { isHexColor } from "@/lib/palette";
import {
  setSetting,
  CAL_NOW_COLOR,
  CAL_RESET_SEC,
  CAL_BLOCK_MINUTES,
  CAL_SHARED_STYLE,
  TIME_24H,
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
  if (!isHexColor(color)) return { error: "Pick a color." };
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

/** Set the calendar now-line color, manual-scroll reset, block length, and how
 *  shared events combine people's colors (admin). */
export async function setCalendarPrefs(
  nowColor: string,
  scrollResetSec: number,
  blockMinutes: number,
  sharedStyle: string,
): Promise<{ error: string | null }> {
  if (!(await isAdmin())) return { error: "Only a parent can do that." };
  if (!isHexColor(nowColor)) return { error: "Pick a color." };
  const sec = Math.max(0, Math.min(3600, Math.round(scrollResetSec)));
  const block = Math.max(5, Math.min(240, Math.round(blockMinutes) || 30));
  const style = sharedStyle === "blend" ? "blend" : "bands";
  await setSetting(CAL_NOW_COLOR, nowColor);
  await setSetting(CAL_RESET_SEC, String(sec));
  await setSetting(CAL_BLOCK_MINUTES, String(block));
  await setSetting(CAL_SHARED_STYLE, style);
  revalidatePath("/calendar");
  revalidatePath("/admin/calendar");
  return { error: null };
}

/** Rename / recolor a custom event type (admin). */
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
  if (!isHexColor(color)) return { error: "Pick a color." };
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

/** Delete a custom event type; its events fall back to their kind color. */
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
/** Reminder lead-times (minutes) from the form: valid, deduped, sorted, capped. */
function readReminderMinutes(formData: FormData): number[] {
  const mins = formData
    .getAll("reminders")
    .map((v) => Number(v))
    .filter((n) => Number.isFinite(n) && n >= 0)
    .map((n) => Math.min(40320, Math.round(n)));
  return [...new Set(mins)].sort((a, b) => a - b).slice(0, 5);
}

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
  // The end can sit on a later day (an event running past midnight); it defaults
  // to the start day when the form doesn't send one.
  const endDate = String(formData.get("endDate") ?? "") || date;
  const allDay = formData.get("allDay") === "on";
  // Only all-day events shade; a timed event keeps the default so a later
  // switch to all-day still tints.
  const shadeDay = allDay ? formData.get("shadeDay") === "on" : true;
  const location = String(formData.get("location") ?? "").trim().slice(0, 200);
  const repeat = String(formData.get("repeat") ?? "NONE");
  const interval = Number(formData.get("interval") ?? 1);
  const until = String(formData.get("until") ?? "").trim();
  const count = Number(formData.get("count") ?? 0);
  const byday = String(formData.get("byday") ?? "")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);

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
    if (!/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
      return { error: "Pick an end date.", saved: false };
    }

    const tz = householdTz();
    const [y, mo, d] = date.split("-").map(Number);
    const [ey, emo, ed] = endDate.split("-").map(Number);
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);

    startsAt = zonedToUtc(y, mo, d, sh, sm, 0, tz);
    endsAt = zonedToUtc(ey, emo, ed, eh, em, 0, tz);

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
    if (count && (!Number.isInteger(count) || count < 1 || count > 999)) {
      return { error: "Repeat 1 to 999 times.", saved: false };
    }
    rrule = buildRule(
      repeat as "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY",
      interval,
      until || null,
      count > 0 ? count : null,
      byday.length > 0 ? byday : null,
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
      shadeDay,
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

  // Reminders: minute lead-times, and the recipients (bell on) among the people
  // on the event. A family event can notify anyone; otherwise only the owner
  // and participants are eligible. Default: nobody (bells start off).
  const reminders = readReminderMinutes(formData);
  const belled = new Set(
    formData.getAll("reminderBell").map(String).filter(Boolean),
  );
  const eligible = new Set<string>(participantIds);
  if (!isFamily && owner) eligible.add(owner);
  const reminderUserIds = isFamily
    ? [...belled]
    : [...belled].filter((id) => eligible.has(id));
  await prisma.event.update({
    where: { id: created.id },
    data: { reminders, reminderUserIds },
  });

  if (participantIds.length) {
    await prisma.eventParticipant.createMany({
      data: participantIds.map((userId) => ({ eventId: created.id, userId })),
      skipDuplicates: true,
    });
  }

  revalidatePath("/calendar");
  revalidatePath("/");
  if (!isFamily) revalidatePath(`/person/${owner}`);
  await rememberEventName(title);
  return { error: null, saved: true };
}

export async function updateEvent(
  _prev: EventState,
  formData: FormData,
): Promise<EventState> {
  await requireInteractive();

  const id = String(formData.get("eventId") ?? "");
  const scope = String(formData.get("scope") ?? "series");
  const occurrenceISO = String(formData.get("occurrenceISO") ?? "");

  const target = await prisma.event.findUnique({
    where: { id },
    select: {
      id: true,
      rrule: true,
      externalCalendarId: true,
      kind: true,
      startsAt: true,
      endsAt: true,
      allDay: true,
      seriesId: true,
      userId: true,
      isFamily: true,
    },
  });
  if (!target) return { error: "That event no longer exists.", saved: false };
  if (target.externalCalendarId) {
    return { error: "Subscribed events can't be edited here.", saved: false };
  }

  const recurring = Boolean(target.rrule);
  const singleEdit = recurring && scope === "single";
  const seriesEdit = recurring && scope === "series";
  const futureEdit = recurring && scope === "future";

  const rawOwner = String(formData.get("userId") ?? "");
  // Never blank the owner on an edit: if the form didn't send one, keep the
  // event's existing owner (or family) rather than orphaning it.
  const owner =
    rawOwner || (target.isFamily ? "family" : (target.userId ?? ""));
  const isFamily = owner === "family";
  const title = String(formData.get("title") ?? "").trim().slice(0, 120);
  const rawKind = String(formData.get("kind") ?? "");
  const formDate = String(formData.get("date") ?? "");
  const start = String(formData.get("start") ?? "");
  const end = String(formData.get("end") ?? "");
  const endDate = String(formData.get("endDate") ?? "") || formDate;
  const allDay = formData.get("allDay") === "on";
  const shadeDay = allDay ? formData.get("shadeDay") === "on" : true;
  const location = String(formData.get("location") ?? "").trim().slice(0, 200);

  if (!owner) return { error: "Pick whose event this is.", saved: false };
  if (title.length < 2) return { error: "Give the event a name.", saved: false };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(formDate)) {
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

  // A whole-series edit consolidates every piece of the logical series (any split
  // off by earlier "this and future" edits) and anchors to the EARLIEST
  // occurrence, so the rebuilt series covers the whole range — but it still
  // honors a start-date / weekday change by shifting the whole series by however
  // many days the user moved the start off the occurrence they opened. Single and
  // one-off edits use the form's date.
  let seriesPieces: { id: string; startsAt: Date; rrule: string | null }[] = [];
  const openedISO = localParts(target.startsAt).iso;
  let seriesStartISO = openedISO;
  if (seriesEdit) {
    const gid = target.seriesId ?? target.id;
    seriesPieces = await prisma.event.findMany({
      where: { OR: [{ id: gid }, { seriesId: gid }] },
      select: { id: true, startsAt: true, rrule: true },
    });
    for (const p of seriesPieces) {
      const pIso = localParts(p.startsAt).iso;
      if (pIso < seriesStartISO) seriesStartISO = pIso;
    }
  }
  const seriesShiftDays = seriesEdit ? daysBetween(openedISO, formDate) : 0;
  const dateForRow = seriesEdit
    ? addDays(seriesStartISO, seriesShiftDays)
    : formDate;

  let startsAt: Date;
  let endsAt: Date;
  if (allDay) {
    startsAt = toDateColumn(dateForRow);
    // Keep a multi-day span (a vacation edited from a middle day stays its full
    // length and just shifts); a single-day event keeps its one day.
    const originalMs = target.endsAt.getTime() - target.startsAt.getTime();
    const spanMs =
      target.allDay && originalMs > 86_400_000 ? originalMs : 86_400_000;
    endsAt = new Date(startsAt.getTime() + spanMs);
  } else {
    if (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end)) {
      return { error: "Set a start and end time.", saved: false };
    }
    // The end may sit on a later day. A series edit stays anchored to the
    // original start date, so carry the form's start→end day gap onto that
    // anchor rather than using the typed end date directly.
    const endGap = /^\d{4}-\d{2}-\d{2}$/.test(endDate)
      ? Math.max(daysBetween(formDate, endDate), 0)
      : 0;
    const endRowISO = seriesEdit ? addDays(dateForRow, endGap) : endDate;

    const tz = householdTz();
    const [y, mo, d] = dateForRow.split("-").map(Number);
    const [ey, emo, ed] = endRowISO.split("-").map(Number);
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    startsAt = zonedToUtc(y, mo, d, sh, sm, 0, tz);
    endsAt = zonedToUtc(ey, emo, ed, eh, em, 0, tz);
    if (endsAt <= startsAt) {
      return { error: "The end time is before the start.", saved: false };
    }
  }

  const fields = {
    userId: isFamily ? null : owner,
    isFamily,
    kind,
    eventTypeId,
    title,
    location: location || null,
    startsAt,
    endsAt,
    allDay,
    shadeDay,
  };

  // A whole-series edit may also change the repeat pattern/end rule. Rebuild the
  // rule from the form (anchored to the kept start date); "Does not repeat"
  // turns it into a one-off. Single and non-recurring edits leave the rule be.
  let newRrule: string | null | undefined = undefined;
  if (seriesEdit || futureEdit) {
    const repeat = String(formData.get("repeat") ?? "NONE");
    const interval = Number(formData.get("interval") ?? 1);
    const until = String(formData.get("until") ?? "").trim();
    const count = Number(formData.get("count") ?? 0);
    const byday = String(formData.get("byday") ?? "")
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);
    if ((FREQS as readonly string[]).includes(repeat)) {
      if (!Number.isInteger(interval) || interval < 1 || interval > 52) {
        return { error: "Repeat every 1 to 52.", saved: false };
      }
      if (until && !/^\d{4}-\d{2}-\d{2}$/.test(until)) {
        return { error: "That end date isn't valid.", saved: false };
      }
      if (until && until < dateForRow) {
        return { error: "The repeat ends before it starts.", saved: false };
      }
      if (count && (!Number.isInteger(count) || count < 1 || count > 999)) {
        return { error: "Repeat 1 to 999 times.", saved: false };
      }
      newRrule = buildRule(
        repeat as "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY",
        interval,
        until || null,
        count > 0 ? count : null,
        byday.length > 0 ? byday : null,
      );
    } else {
      newRrule = null;
    }
  }

  let targetEventId = id;
  if (singleEdit) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(occurrenceISO)) {
      return { error: "Couldn't tell which occurrence to edit.", saved: false };
    }
    const overrideDate = toDateColumn(occurrenceISO);
    // Re-editing the same occurrence updates its existing override.
    const existing = await prisma.event.findFirst({
      where: { recurrenceId: id, recurrenceDate: overrideDate },
      select: { id: true },
    });
    if (existing) {
      await prisma.event.update({ where: { id: existing.id }, data: fields });
      targetEventId = existing.id;
    } else {
      const created = await prisma.event.create({
        data: {
          ...fields,
          rrule: null,
          recurrenceId: id,
          recurrenceDate: overrideDate,
        },
        select: { id: true },
      });
      targetEventId = created.id;
    }
  } else if (futureEdit) {
    // "This and future events": consolidate every piece of this logical series
    // from this occurrence forward into one fresh series with the edits — so a
    // series that was previously split, or had occurrences moved or deleted, is
    // reconnected. Occurrences before this date keep their own settings; any
    // per-occurrence changes or deletions from this date on are reset and
    // regenerated by the new series.
    if (!/^\d{4}-\d{2}-\d{2}$/.test(occurrenceISO)) {
      return { error: "Couldn't tell which occurrence to edit.", saved: false };
    }
    const untilISO = addDays(occurrenceISO, -1);
    const sid = target.seriesId ?? target.id;
    const Dcol = toDateColumn(occurrenceISO);
    const tz = householdTz();
    const pieces = await prisma.event.findMany({
      where: { OR: [{ id: sid }, { seriesId: sid }] },
      select: { id: true, startsAt: true, rrule: true },
    });
    let pastCount = 0;
    for (const p of pieces) {
      const pStart = localParts(p.startsAt).iso;
      if (pStart >= occurrenceISO) {
        await prisma.event.deleteMany({ where: { recurrenceId: p.id } });
        await prisma.event.delete({ where: { id: p.id } });
      } else {
        const pr = parseRule(p.rrule);
        let cappedRule = p.rrule;
        if (pr) {
          const cappedUntil =
            pr.until && pr.until < untilISO ? pr.until : untilISO;
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
    // Keep a count-limited series' total intact: the forward part gets the
    // count that remains after the past occurrences, not a fresh full count.
    let futureRule = alignWeeklyByday(newRrule ?? null, dateForRow);
    const fr = parseRule(futureRule);
    if (fr && fr.count && fr.count > 0 && pastCount > 0) {
      futureRule = buildRule(
        fr.freq,
        fr.interval,
        fr.until,
        Math.max(fr.count - pastCount, 1),
        fr.byday,
      );
    }
    const created = await prisma.event.create({
      data: {
        ...fields,
        rrule: futureRule,
        seriesId: sid,
      },
      select: { id: true },
    });
    targetEventId = created.id;
  } else if (seriesEdit) {
    // "All events in the series": consolidate every piece — and clear any
    // per-occurrence changes or deletions — into one fresh series anchored at
    // the earliest occurrence, so the whole series ends up on one clean rule.
    const gid = target.seriesId ?? target.id;
    for (const p of seriesPieces) {
      await prisma.event.deleteMany({ where: { recurrenceId: p.id } });
      await prisma.event.delete({ where: { id: p.id } });
    }
    const created = await prisma.event.create({
      data: {
        ...fields,
        rrule: alignWeeklyByday(newRrule ?? null, dateForRow),
        seriesId: gid,
      },
      select: { id: true },
    });
    targetEventId = created.id;
  } else {
    // Non-recurring: update in place.
    await prisma.event.update({
      where: { id },
      data: newRrule !== undefined ? { ...fields, rrule: newRrule } : fields,
    });
  }

  // Sync the people this event is shared with (the owner is tracked separately).
  // Replace the set wholesale so unchecking someone removes them.
  const participantIds = [
    ...new Set(
      formData
        .getAll("participants")
        .map(String)
        .filter((pid) => pid && pid !== "family" && pid !== owner),
    ),
  ];
  // Reminders + recipients (bells), same rules as create.
  const reminders = readReminderMinutes(formData);
  const belled = new Set(
    formData.getAll("reminderBell").map(String).filter(Boolean),
  );
  const eligible = new Set<string>(participantIds);
  if (!isFamily && owner) eligible.add(owner);
  const reminderUserIds = isFamily
    ? [...belled]
    : [...belled].filter((id) => eligible.has(id));
  await prisma.event.update({
    where: { id: targetEventId },
    data: { reminders, reminderUserIds },
  });
  await prisma.eventParticipant.deleteMany({ where: { eventId: targetEventId } });
  if (participantIds.length) {
    await prisma.eventParticipant.createMany({
      data: participantIds.map((userId) => ({ eventId: targetEventId, userId })),
      skipDuplicates: true,
    });
  }

  revalidatePath("/calendar");
  revalidatePath("/");
  if (!isFamily) revalidatePath(`/person/${owner}`);
  await rememberEventName(title);
  return { error: null, saved: true };
}

export type EventCopyData = {
  title: string;
  userId: string;
  kind: string;
  location: string;
  allDay: boolean;
  shadeDay: boolean;
  rrule: string | null;
  start: string;
  end: string;
  date: string;
  endDayOffset: number;
  participantIds: string[];
  reminders: number[];
  reminderUserIds: string[];
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
      shadeDay: true,
      rrule: true,
      seriesId: true,
      startsAt: true,
      endsAt: true,
      reminders: true,
      reminderUserIds: true,
      participants: { select: { userId: true } },
    },
  });
  if (!e) return null;

  const s = localParts(e.startsAt);
  const en = localParts(e.endsAt);

  // A series split by "this and future" edits lives as several pieces; an older
  // piece's rule is capped to end before the split. When editing, show the
  // ongoing series' end (from the latest piece) with this occurrence's own
  // cadence, so the end date the user set is what they see — not a cap.
  let rrule = e.rrule ?? null;
  const seriesId = (e as { seriesId?: string | null }).seriesId ?? null;
  if (rrule && seriesId) {
    const latest = await prisma.event.findFirst({
      where: {
        OR: [{ id: seriesId }, { seriesId }],
        rrule: { not: null },
      },
      orderBy: { startsAt: "desc" },
      select: { rrule: true },
    });
    const clicked = parseRule(rrule);
    const latestR = parseRule(latest?.rrule ?? null);
    if (clicked && latestR) {
      rrule = buildRule(
        clicked.freq,
        clicked.interval,
        latestR.until,
        latestR.count,
        clicked.byday,
      );
    }
  }

  return {
    title: e.title,
    userId: e.isFamily ? "family" : (e.userId ?? ""),
    kind: e.eventTypeId ? `type:${e.eventTypeId}` : (e.kind as string),
    location: e.location ?? "",
    allDay: e.allDay,
    shadeDay: (e as { shadeDay?: boolean }).shadeDay ?? true,
    rrule,
    start: hhmm(s.minutes),
    end: hhmm(en.minutes),
    date: s.iso,
    // Days the end sits after the start (0 = same day), so a copy re-placed on
    // another day keeps its span.
    endDayOffset: Math.max(daysBetween(s.iso, en.iso), 0),
    participantIds:
      (e as { participants?: { userId: string }[] }).participants?.map(
        (p) => p.userId,
      ) ?? [],
    reminders: (e as { reminders?: number[] }).reminders ?? [],
    reminderUserIds: (e as { reminderUserIds?: string[] }).reminderUserIds ?? [],
  };
}

export type DeleteScope = "all" | "future" | "one";
export type DeleteState = { error: string | null };

export async function deleteEvent(
  id: string,
  scope: DeleteScope = "all",
  occurrenceISO?: string,
): Promise<DeleteState> {
  await requireInteractive();
  return deleteEventCore(id, scope, occurrenceISO, {
    isAdmin: await isAdmin(),
    callerUserId: null,
  });
}

/** Toggle 24-hour time in the picker. Stored as a setting and mirrored to a
 *  cookie the client TimeSelect reads without a round-trip. */
export async function setTime24h(on: boolean): Promise<void> {
  await requireAdmin();
  await setSetting(TIME_24H, on ? "1" : "0");
  (await cookies()).set("time24h", on ? "1" : "0", {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
}
