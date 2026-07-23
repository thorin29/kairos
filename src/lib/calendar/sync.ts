import "server-only";
import { EventKind } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { householdTz } from "@/lib/dates";
import { parseIcs } from "./ics";

/** Feeds are re-fetched at most this often, however many times a page loads. */
const STALE_AFTER_MS = 15 * 60 * 1000;

/** How far back imported events are kept. Older ones are pruned on sync. */
const KEEP_PAST_DAYS = 60;

export type SyncResult = {
  name: string;
  imported: number;
  error: string | null;
};

/**
 * Pulls one feed and replaces its events.
 *
 * Feeds are the source of truth for their own events: a game that moved or
 * was cancelled must disappear, so anything no longer in the feed is
 * removed. Only events from that one subscription are touched.
 */
export async function syncCalendar(id: string): Promise<SyncResult> {
  const calendar = await prisma.externalCalendar.findUnique({
    where: { id },
  });
  if (!calendar) return { name: "Unknown", imported: 0, error: "Not found" };

  try {
    // webcal:// is just http(s) with a different scheme.
    const url = calendar.url.replace(/^webcal:\/\//i, "https://");

    const response = await fetch(url, {
      headers: { Accept: "text/calendar, text/plain" },
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });

    if (!response.ok) {
      throw new Error(`Feed returned ${response.status}`);
    }

    const body = await response.text();
    if (!body.includes("BEGIN:VCALENDAR")) {
      throw new Error("That URL didn't return a calendar feed");
    }

    const parsed = parseIcs(body, householdTz());

    const cutoff = new Date(Date.now() - KEEP_PAST_DAYS * 86_400_000);
    const fresh = parsed.filter((e) => e.endsAt >= cutoff);

    await prisma.$transaction(async (tx) => {
      // Drop what this feed no longer lists, plus anything aged out.
      const keepUids = fresh.map((e) => e.uid);
      await tx.event.deleteMany({
        where: {
          externalCalendarId: calendar.id,
          ...(keepUids.length > 0
            ? { externalUid: { notIn: keepUids } }
            : {}),
        },
      });

      for (const e of fresh) {
        const data = {
          userId: calendar.userId,
          kind: EventKind.EXTERNAL,
          title: e.summary,
          location: e.location,
          notes: e.description,
          startsAt: e.startsAt,
          endsAt: e.endsAt,
          allDay: e.allDay,
          rrule: e.rrule,
          externalCalendarId: calendar.id,
          externalUid: e.uid,
        };

        await tx.event.upsert({
          where: {
            externalCalendarId_externalUid: {
              externalCalendarId: calendar.id,
              externalUid: e.uid,
            },
          },
          update: data,
          create: data,
        });
      }
    });

    await prisma.externalCalendar.update({
      where: { id: calendar.id },
      data: { lastFetchedAt: new Date(), lastError: null },
    });

    return { name: calendar.name, imported: fresh.length, error: null };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not read the feed";

    await prisma.externalCalendar.update({
      where: { id: calendar.id },
      data: { lastFetchedAt: new Date(), lastError: message.slice(0, 300) },
    });

    return { name: calendar.name, imported: 0, error: message };
  }
}

/**
 * Refreshes any subscription that hasn't been checked recently. Called on
 * calendar page loads, so feeds stay current without a scheduler. Failures
 * are recorded against the subscription rather than thrown, so one dead feed
 * can't blank the calendar.
 */
export async function syncStaleCalendars(force = false): Promise<SyncResult[]> {
  const cutoff = new Date(Date.now() - STALE_AFTER_MS);

  const due = await prisma.externalCalendar.findMany({
    where: {
      isActive: true,
      ...(force
        ? {}
        : {
            OR: [{ lastFetchedAt: null }, { lastFetchedAt: { lt: cutoff } }],
          }),
    },
    select: { id: true },
  });

  const results: SyncResult[] = [];
  for (const c of due) {
    results.push(await syncCalendar(c.id));
  }
  return results;
}
