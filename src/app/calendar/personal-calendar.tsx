import Link from "next/link";
import { prisma } from "@/lib/prisma";
import {
  loadRange,
  loadEventTypes,
  type GridEvent,
} from "@/lib/queries/calendar";
import { syncStaleCalendars } from "@/lib/calendar/sync";
import {
  addDays,
  addMonths,
  formatMonth,
  monthGridDays,
  startOfMonth,
  startOfWeek,
  todayISO,
  weekDays,
} from "@/lib/dates";
import { CalendarView } from "@/components/calendar-view";
import { MonthGrid } from "@/components/month-grid";
import { DaySchedule } from "@/components/day-schedule";
import { AddEventProvider, AddEventButton } from "./add-event-form";
import { CalendarOptionsDrawer } from "./calendar-options-drawer";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/icons";
import { getFamilyColor, getCalendarPrefs } from "@/lib/settings";
import { getHolidayColor } from "@/lib/holidays";
import { loadClassCtx } from "@/lib/queries/class-ctx";
import { loadCalendarPrefs, type CalView } from "@/lib/calendar/prefs";
import { recolorForPersonal } from "@/lib/calendar/colors";

/** Heading for a two-ISO span: one month, a cross-month range, or cross-year. */
function spanHeading(startISO: string, endISO: string): string {
  const sY = startISO.slice(0, 4);
  const eY = endISO.slice(0, 4);
  const sM = startISO.slice(5, 7);
  const eM = endISO.slice(5, 7);
  const abbr = (iso: string) =>
    new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short" }).format(
      new Date(`${iso}T00:00:00Z`),
    );
  if (sY === eY && sM === eM) return formatMonth(startISO);
  if (sY === eY) return `${abbr(startISO)} \u2013 ${abbr(endISO)} ${sY}`;
  return `${abbr(startISO)} ${sY} \u2013 ${abbr(endISO)} ${eY}`;
}

export async function PersonalCalendar({
  me,
  rawView,
  rawDate,
}: {
  me: { id: string; name: string; displayName: string | null; color: string };
  rawView?: string;
  rawDate?: string;
}) {
  const today = todayISO();
  const prefs = await loadCalendarPrefs(me.id);

  // View comes from the URL when drilling in (e.g. tapping a month day opens
  // Day), else the saved preference. The drawer writes the preference.
  const valid = (v?: string): v is CalView =>
    v === "month" ||
    v === "week" ||
    v === "three_day" ||
    v === "day" ||
    v === "agenda";
  const view: CalView = valid(rawView) ? rawView : prefs.view;
  const date = rawDate && /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : today;

  const [people, subsRaw, familyColor, calPrefs, holidaySystem, classCtx, eventTypes] =
    await Promise.all([
      prisma.user.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          name: true,
          displayName: true,
          color: true,
          avatarPath: true,
          avatarPosition: true,
        },
      }),
      prisma.externalCalendar.findMany({
        where: { isActive: true },
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          color: true,
          isFamily: true,
          userId: true,
          user: { select: { displayName: true, name: true, color: true } },
        },
      }),
      getFamilyColor(),
      getCalendarPrefs(),
      getHolidayColor(),
      loadClassCtx(),
      loadEventTypes(),
    ]);

  const subs = subsRaw.map((s) => ({
    id: s.id,
    name: s.name,
    ownerName: s.isFamily
      ? "Family"
      : (s.user?.displayName ?? s.user?.name ?? null),
    color: s.color ?? s.user?.color ?? familyColor,
    userId: s.userId,
  }));

  // Defaults resolve here: unset people → just me; unset subscriptions → the
  // ones I own. An explicit empty list means "show none".
  const shownPeople = prefs.shownPeople ?? [me.id];
  const shownSubs =
    prefs.shownSubs ?? subs.filter((s) => s.userId === me.id).map((s) => s.id);
  const subsSet = new Set(shownSubs);

  const days =
    view === "month"
      ? monthGridDays(date)
      : view === "week"
        ? weekDays(date)
        : view === "three_day"
          ? [date, addDays(date, 1), addDays(date, 2)]
          : [date];

  const step = (n: number) =>
    view === "month"
      ? addMonths(startOfMonth(date), n)
      : view === "week"
        ? addDays(startOfWeek(date), n * 7)
        : view === "three_day"
          ? addDays(date, n * 3)
          : addDays(date, n);

  await syncStaleCalendars();

  const rawRange = await loadRange(days, shownPeople, prefs.showSchoolWork);
  const keep = (e: GridEvent) =>
    (!e.isFamily || prefs.showFamily) &&
    (!e.external ||
      (e.externalCalendarId ? subsSet.has(e.externalCalendarId) : true));
  const colorPrefs = {
    personalizeColors: prefs.personalizeColors,
    othersMode: prefs.othersMode,
    othersColor: prefs.othersColor,
    holidayColor: prefs.holidayColor,
    kindColors: prefs.kindColors,
    eventTypeColors: prefs.eventTypeColors,
    subColors: prefs.subColors,
  };
  const recolor = (e: GridEvent) => recolorForPersonal(e, colorPrefs, me.id);
  const timed = rawRange.timed.filter(keep).map(recolor);
  const allDay = rawRange.allDay.filter(keep).map(recolor);

  // The now-line follows the admin colour unless the person has overridden it
  // (and only while personalisation is on).
  const nowColor =
    prefs.personalizeColors && prefs.nowColor
      ? prefs.nowColor
      : calPrefs.nowColor;

  const link = (p: { view?: CalView; date?: string }) => {
    const q = new URLSearchParams();
    q.set("view", p.view ?? view);
    q.set("date", p.date ?? date);
    return `/calendar?${q.toString()}`;
  };

  const heading =
    view === "month"
      ? formatMonth(date)
      : view === "week"
        ? spanHeading(days[0], days[6])
        : view === "three_day"
          ? spanHeading(days[0], days[2])
          : formatMonth(date);

  const chip =
    "inline-flex h-10 items-center gap-2 rounded-full border border-hairline px-3.5 text-sm font-medium transition-colors hover:border-accent hover:text-accent";

  return (
    <AddEventProvider
      people={people.map((p) => ({ id: p.id, name: p.displayName ?? p.name }))}
      types={eventTypes}
      classCtx={classCtx}
      defaultDate={view === "month" ? today : date}
    >
      <main className="mx-auto max-w-[92rem] px-4 pb-6 pt-4">
        <div className="mb-3 flex items-center gap-2">
          <Link href={link({ date: today })} className={`${chip}`}>
            Today
          </Link>
          <Link
            href={link({ date: step(-1) })}
            aria-label="Previous"
            className={`${chip} px-2.5`}
          >
            <ChevronLeftIcon className="h-5 w-5" />
          </Link>
          <Link
            href={link({ date: step(1) })}
            aria-label="Next"
            className={`${chip} px-2.5`}
          >
            <ChevronRightIcon className="h-5 w-5" />
          </Link>
          <span className="font-display ml-1 min-w-0 flex-1 truncate text-xl font-semibold tracking-tight">
            {heading}
          </span>
          <AddEventButton />
          <CalendarOptionsDrawer
            view={view}
            people={people.map((p) => ({
              id: p.id,
              name: p.displayName ?? p.name,
              color: p.color,
            }))}
            selectedPeople={shownPeople}
            showFamily={prefs.showFamily}
            showSchoolWork={prefs.showSchoolWork}
            subscriptions={subs.map((s) => ({
              id: s.id,
              name: s.name,
              ownerName: s.ownerName,
              color: s.color,
            }))}
            selectedSubs={shownSubs}
            personalizeColors={prefs.personalizeColors}
            othersMode={prefs.othersMode}
            othersColor={prefs.othersColor}
            nowColor={prefs.nowColor}
            nowSystem={calPrefs.nowColor}
            holidayColor={prefs.holidayColor}
            holidaySystem={holidaySystem}
            kindColors={prefs.kindColors}
            meColor={me.color}
          />
        </div>

        {view === "month" && (
          <MonthGrid
            days={days}
            monthISO={startOfMonth(date)}
            events={[...allDay, ...timed]}
            todayISO={today}
            hrefForDay={(iso) => link({ view: "day", date: iso })}
            sharedStyle={calPrefs.sharedStyle}
          />
        )}

        {(view === "week" || view === "three_day" || view === "day") && (
          <CalendarView
            days={days}
            timed={timed}
            allDay={allDay}
            todayISO={today}
            nowColor={nowColor}
            resetSec={calPrefs.scrollResetSec}
            blockMinutes={calPrefs.blockMinutes}
            sharedStyle={calPrefs.sharedStyle}
          />
        )}

        {view === "agenda" && (
          <DaySchedule
            events={[...allDay, ...timed].filter((e) => e.dayISO === date)}
            emptyText="Nothing scheduled."
            nav={{
              prevHref: link({ date: step(-1) }),
              todayHref: link({ date: today }),
              nextHref: link({ date: step(1) }),
            }}
          />
        )}
      </main>
    </AddEventProvider>
  );
}
