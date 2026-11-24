import "server-only";
import { prisma } from "@/lib/prisma";
import { addDays, householdTz, todayISO, toDateColumn } from "@/lib/dates";
import { dayEnd, dayStart } from "@/lib/places/day-bounds";
import { planDay, type DayPoint } from "@/lib/places/day";
import { loadWorkoutUnitSystem } from "@/lib/queries/workouts";
import { logCardio } from "@/lib/workouts/cardio-run";
import { dayOfTrip, eventDays, hoursMinutes, runOf, tripDays, tripTotals } from "@/lib/workouts/backpacking-days";
import { elevationOf } from "@/lib/places/elevation";
import { elevationNote } from "@/lib/places/elevation-calc";
import { tripDaysFor, tripEventOn, tripEvents } from "@/lib/workouts/backpacking-trips";
import { notify } from "@/lib/push";

/**
 * Backpacking trips (v0.778). A trip is a calendar event of the Backpacking
 * type (one running over several days, or a repeating one on back-to-back
 * days). Nothing has to be started: on each trip day the person's hiking is
 * read from their Family map locations (the walking between stops; driving to
 * the trailhead doesn't count, long stops are camp). The first time they're
 * seen moving on a trip day they're asked "Hiking today?"; once the day is
 * over it's logged as that day's Backpacking workout, answered or not, unless
 * they said no. Starting one from the app makes the calendar event.
 */

/** Less walking than this in a day isn't a hiking day. */
const MIN_HIKE_M = 400;
/** A walk under this is moving about camp, not hiking. */
const MIN_LEG_M = 100;
/** How far back a missed day is still logged. */
const BACK_DAYS = 21;

const SELECT = { at: true, lat: true, lng: true, accuracyM: true, speed: true, zone: true, source: true } as const;

/** The hiking in a day, from the person's locations: the walks between stops. */
export async function hikeOn(
  userId: string,
  dateISO: string,
): Promise<{ distanceM: number; seconds: number; path: [number, number][] }> {
  const tz = householdTz();
  const start = dayStart(dateISO, tz);
  const end = dayEnd(dateISO, tz);
  const [points, before] = (await Promise.all([
    prisma.locationPoint.findMany({ where: { userId, at: { gte: start, lt: end } }, orderBy: { at: "asc" }, take: 6_000, select: SELECT }),
    prisma.locationPoint.findFirst({ where: { userId, at: { lt: start } }, orderBy: { at: "desc" }, select: SELECT }),
  ])) as [DayPoint[], DayPoint | null];
  let distanceM = 0;
  let seconds = 0;
  const path: [number, number][] = [];
  for (const it of planDay(points, start, before, [], Date.now()).items) {
    if (it.kind !== "move" || it.distanceM < MIN_LEG_M) continue;
    distanceM += it.distanceM;
    seconds += (it.end.getTime() - it.start.getTime()) / 1000;
    for (const p of it.points) path.push([p.lat, p.lng]);
  }
  return { distanceM, seconds: Math.round(seconds), path };
}

async function dayRow(userId: string, dateISO: string) {
  return (await prisma.backpackDay.findUnique({
    where: { userId_date: { userId, date: toDateColumn(dateISO) } },
    select: { status: true, sessionId: true },
  })) as { status: string; sessionId: string | null } | null;
}

async function setDay(userId: string, dateISO: string, status: string, sessionId?: string | null): Promise<void> {
  const date = toDateColumn(dateISO);
  await prisma.backpackDay.upsert({
    where: { userId_date: { userId, date } },
    create: { userId, date, status, sessionId: sessionId ?? null },
    update: { status, ...(sessionId !== undefined ? { sessionId } : {}) },
  });
}

export type BackpackToday = {
  date: string;
  day: number;
  of: number;
  /** asked, hiking, skip, or null (not asked yet). */
  status: string | null;
  eventId?: string | null;
  title?: string | null;
  miles: number;
};

/** Today on a trip, for the app's Workouts page; null when not on one. */
export async function backpackToday(userId: string): Promise<BackpackToday | null> {
  const today = todayISO();
  const days = await tripDaysFor(userId, addDays(today, -30), addDays(today, 30));
  const at = dayOfTrip(days, today);
  if (!at) return null;
  const [row, hike] = await Promise.all([dayRow(userId, today), hikeOn(userId, today)]);
  return {
    date: today,
    day: at.day,
    of: at.of,
    status: row?.status ?? null,
    miles: Math.round((hike.distanceM / 1609.344) * 10) / 10,
    ...(await tripEventOn(userId, today).then((e) => ({ eventId: e?.id ?? null, title: e?.title ?? null }))),
  };
}

/**
 * Finished (v0.787): the trip ends today. A single trip event ending later
 * is cut to end today; the days after drop off. A repeating one is left
 * alone (its own event's dates say when it ends).
 */
export async function finishTrip(userId: string): Promise<void> {
  const today = todayISO();
  const e = await tripEventOn(userId, today);
  if (!e?.id || e.rrule) return;
  if (eventDays(e, today, addDays(today, 60)).length <= 1) return;
  await prisma.event.update({
    where: { id: e.id },
    data: e.allDay
      ? { endsAt: toDateColumn(addDays(today, 1)) }
      : { endsAt: new Date(Math.max(Date.now(), e.startsAt.getTime() + 60_000)) },
  });
}

/** "Hiking today?" answered: yes (logged at the day's end) or no (not logged). */
export async function answerToday(userId: string, hiking: boolean): Promise<void> {
  await setDay(userId, todayISO(), hiking ? "hiking" : "skip");
}

/**
 * Started from the app: a Backpacking event from today to `untilISO` (all
 * day), unless today is already a trip day; today counts as hiking.
 */
export async function startTrip(userId: string, untilISO: string): Promise<boolean> {
  const today = todayISO();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(untilISO) || untilISO < today || untilISO > addDays(today, 30)) return false;
  if ((await tripDaysFor(userId, today, today)).length === 0) {
    const type = (await prisma.eventType.findFirst({ where: { backpacking: true }, select: { id: true } })) as { id: string } | null;
    if (!type) return false;
    await prisma.event.create({
      data: {
        userId,
        kind: "OTHER",
        eventTypeId: type.id,
        title: "Backpacking",
        allDay: true,
        startsAt: toDateColumn(today),
        endsAt: toDateColumn(addDays(untilISO, 1)),
      },
    });
  }
  await setDay(userId, today, "hiking");
  return true;
}

/** Log one finished trip day (unless they said they weren't hiking), with
 *  its elevation gain and loss. */
async function logDay(userId: string, dateISO: string): Promise<void> {
  const hike = await hikeOn(userId, dateISO);
  const date = toDateColumn(dateISO);
  if (hike.distanceM < MIN_HIKE_M) {
    await prisma.backpackDay.upsert({
      where: { userId_date: { userId, date } },
      create: { userId, date, status: "logged", distanceM: 0, seconds: 0 },
      update: { status: "logged", sessionId: null, distanceM: 0, seconds: 0 },
    });
    return;
  }
  const elev = await elevationOf(hike.path);
  const system = await loadWorkoutUnitSystem();
  const distance = hike.distanceM / (system === "metric" ? 1000 : 1609.344);
  const sessionId = await logCardio(userId, dateISO, {
    activity: "backpack",
    distance: Math.round(distance * 100) / 100,
    seconds: Math.min(Math.max(hike.seconds, 60), 24 * 3600),
  });
  if (sessionId && elev) {
    await prisma.workoutSession.update({
      where: { id: sessionId },
      data: { notes: elevationNote(elev.gainM, elev.lossM) },
    });
  }
  const stats = {
    status: "logged",
    sessionId,
    distanceM: hike.distanceM,
    seconds: hike.seconds,
    gainM: elev?.gainM ?? null,
    lossM: elev?.lossM ?? null,
  };
  await prisma.backpackDay.upsert({ where: { userId_date: { userId, date } }, create: { userId, date, ...stats }, update: stats });
}

export type TripSummary = {
  from: string;
  to: string;
  days: number;
  miles: number;
  minutes: number;
  gainFt: number | null;
  lossFt: number | null;
};

type StatRow = { date: Date; status: string; distanceM: number | null; seconds: number | null; gainM: number | null; lossM: number | null; summarySent: boolean };

async function runRows(userId: string, run: string[]): Promise<StatRow[]> {
  return (await prisma.backpackDay.findMany({
    where: { userId, date: { in: run.map(toDateColumn) } },
    select: { date: true, status: true, distanceM: true, seconds: true, gainM: true, lossM: true, summarySent: true },
  })) as StatRow[];
}

/** A finished trip's summary once every day of it is logged (or said no to). */
function summaryOf(run: string[], rows: StatRow[]): TripSummary | null {
  if (run.length === 0 || rows.length < run.length || rows.some((r) => r.status !== "logged" && r.status !== "skip")) return null;
  return { from: run[0], to: run[run.length - 1], days: run.length, ...tripTotals(rows.filter((r) => r.status === "logged")) };
}

/** The trip's summary as a notification, once, when its last day is logged. */
async function maybeSummary(userId: string, days: string[], dateISO: string): Promise<void> {
  const run = runOf(days, dateISO);
  if (run.length === 0 || run[run.length - 1] !== dateISO) return;
  const rows = await runRows(userId, run);
  const last = rows.find((r) => r.date.toISOString().slice(0, 10) === dateISO);
  if (!last || last.summarySent) return;
  const sum = summaryOf(run, rows);
  if (!sum) return;
  await prisma.backpackDay.update({
    where: { userId_date: { userId, date: toDateColumn(dateISO) } },
    data: { summarySent: true },
  });
  const elev = sum.gainFt != null ? ` \u00b7 \u2191 ${sum.gainFt.toLocaleString("en-US")} ft \u2193 ${(sum.lossFt ?? 0).toLocaleString("en-US")} ft` : "";
  await notify(
    [userId],
    {
      kind: "backpacking",
      title: "Backpacking trip done",
      body: `${sum.miles} mi in ${sum.days} ${sum.days === 1 ? "day" : "days"} \u00b7 ${hoursMinutes(sum.minutes)} hiking${elev}`,
      link: "/exercise",
    },
    { quiet: true },
  );
}

/** The most recent finished trip in the last 14 days, for the Workouts card. */
export async function lastTrip(userId: string): Promise<TripSummary | null> {
  const today = todayISO();
  const days = await tripDaysFor(userId, addDays(today, -45), addDays(today, 1));
  const past = days.filter((d) => d < today);
  if (past.length === 0) return null;
  const lastDay = past[past.length - 1];
  if (lastDay < addDays(today, -14)) return null;
  const run = runOf(days, lastDay);
  // Still going today: not finished.
  if (run[run.length - 1] >= today) return null;
  return summaryOf(run, await runRows(userId, run));
}

/**
 * The background timer's turn (every 5 minutes): ask anyone seen hiking on a
 * trip day who hasn't been asked, and log trip days that are over.
 */
export async function backpackingTick(): Promise<void> {
  const events = await tripEvents();
  if (events.length === 0) return;
  const today = todayISO();
  const people = new Set<string>();
  for (const e of events) {
    if (e.userId) people.add(e.userId);
    for (const p of e.participants) people.add(p);
  }
  let logged = 0;
  for (const userId of people) {
    const days = tripDays(events, userId, addDays(today, -BACK_DAYS), today);
    if (days.length === 0) continue;
    if (days.includes(today) && !(await dayRow(userId, today))) {
      const hike = await hikeOn(userId, today);
      if (hike.distanceM >= MIN_HIKE_M) {
        await setDay(userId, today, "asked");
        await notify(
          [userId],
          {
            kind: "backpacking",
            title: "Hiking today?",
            body: `${(hike.distanceM / 1609.344).toFixed(1)} mi so far on your backpacking trip.`,
            link: "/exercise",
          },
          { quiet: true },
        );
      }
    }
    for (const d of days) {
      if (d >= today || logged >= 10) continue;
      const row = await dayRow(userId, d);
      if (row && (row.status === "logged" || row.status === "skip")) {
        // A last day answered no still sends the trip's summary.
        if (row.status === "skip") await maybeSummary(userId, days, d);
        continue;
      }
      await logDay(userId, d);
      await maybeSummary(userId, days, d);
      logged++;
    }
  }
}
