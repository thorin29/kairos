import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { AppHeader } from "@/components/app-header";
import {
  loadRange,
  loadEventTypes,
  type GridEvent,
} from "@/lib/queries/calendar";
import { syncStaleCalendars } from "@/lib/calendar/sync";
import {
  addDays,
  addMonths,
  formatLong,
  formatMonth,
  formatShort,
  monthGridDays,
  startOfMonth,
  startOfWeek,
  todayISO,
  weekDays,
} from "@/lib/dates";
import { CalendarView } from "@/components/calendar-view";
import { WeekGrid } from "@/components/week-grid";
import { DaySchedule } from "@/components/day-schedule";
import { MonthGrid } from "@/components/month-grid";
import { MiniMonth } from "@/components/mini-month";
import { AddEventProvider, AddEventButton } from "./add-event-form";
import { PersonFilterBadge, FamilyFilterBadge } from "@/components/person-filter";
import { SchoolIcon } from "@/components/icons";
import { CATEGORY_COLORS } from "@/lib/colors";
import { getFamilyColor } from "@/lib/settings";
import { getCalendarPrefs, type SharedStyle } from "@/lib/settings";
import { getClassFromCalendarMode } from "@/lib/settings";
import { loadSchoolStructure } from "@/lib/queries/school";
import { isAdmin } from "@/lib/session";
import { currentUser } from "@/lib/user-session";

export const dynamic = "force-dynamic";

type View = "day" | "week" | "month";

const VIEWS: { key: View; label: string }[] = [
  { key: "day", label: "Day" },
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
];

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{
    view?: string;
    date?: string;
    who?: string;
    sw?: string;
  }>;
}) {
  const { view: rawView, date: rawDate, who, sw } = await searchParams;
  const showSchoolWork = sw === "1";

  const today = todayISO();
  const view: View =
    rawView === "day" || rawView === "month" ? rawView : "week";
  const date =
    rawDate && /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : today;
  // The filter is a comma-separated list of user ids, "none", or absent/"all"
  // for everyone. filterIds drives the queries: undefined = everyone, [] =
  // nobody, [ids] = those people.
  const filterIds: string[] | undefined =
    !who || who === "all"
      ? undefined
      : who === "none"
        ? []
        : who.split(",").filter(Boolean);

  // The span each view covers, and how far the arrows move.
  const days =
    view === "day"
      ? [date]
      : view === "week"
        ? weekDays(date)
        : monthGridDays(date);

  const step = (n: number) =>
    view === "day"
      ? addDays(date, n)
      : view === "week"
        ? addDays(startOfWeek(date), n * 7)
        : addMonths(startOfMonth(date), n);

  await syncStaleCalendars();

  // Every view respects the person/family filter. In the day view the filter
  // decides which person columns appear, so you can line two people up to
  // compare; loadRange is filtered to match so a person's column only pulls
  // their own (and shared) events.
  const [range, people] = await Promise.all([
    loadRange(days, filterIds, showSchoolWork),
    prisma.user.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        name: true,
        displayName: true,
        color: true,
        avatarPath: true,
      },
    }),
  ]);

  const link = (p: {
    view?: View;
    date?: string;
    who?: string;
    sw?: string;
  }) => {
    const q = new URLSearchParams();
    if (p.view && p.view !== "week") q.set("view", p.view);
    if (p.date) q.set("date", p.date);
    if (p.who) q.set("who", p.who);
    // Preserve the School-work filter across navigation; an explicit sw on the
    // call overrides (the toggle passes "0" to turn it off).
    const swVal = p.sw !== undefined ? p.sw : showSchoolWork ? "1" : undefined;
    if (swVal === "1") q.set("sw", "1");
    const s = q.toString();
    return s ? `/calendar?${s}` : "/calendar";
  };

  // Resolve the current selection against the real roster, and build helpers to
  // toggle people in and out of it via the URL.
  const familyColor = await getFamilyColor();
  const calPrefs = await getCalendarPrefs();

  // Everything the "Class" event type needs: the pools to pick from, and who's
  // allowed to create a class from here (admins always; anyone when the
  // household setting is switched on).
  const [classMode, meAdmin, me, structure] = await Promise.all([
    getClassFromCalendarMode(),
    isAdmin(),
    currentUser(),
    loadSchoolStructure(),
  ]);
  const classCtx = {
    canMakeClass: meAdmin || classMode === "anyone",
    isAdmin: meAdmin,
    meName: me?.displayName ?? me?.name ?? null,
    subjects: structure.subjects.map((s) => ({ id: s.id, name: s.name })),
    classTypes: structure.classTypes.map((t) => ({ id: t.id, name: t.name })),
    terms: structure.terms.map((t) => ({ id: t.id, name: t.name })),
    people: structure.people.map((p) => ({ id: p.id, name: p.name })),
  };
  const allIds = people.map((p) => p.id);
  const selectedSet = new Set<string>(
    !who || who === "all"
      ? allIds
      : who === "none"
        ? []
        : who.split(",").filter((id) => allIds.includes(id)),
  );
  const orderedSelected = allIds.filter((id) => selectedSet.has(id));
  const allSelected = allIds.length > 0 && orderedSelected.length === allIds.length;

  const encodeWho = (ids: string[]): string | undefined =>
    ids.length === allIds.length ? undefined : ids.length === 0 ? "none" : ids.join(",");
  const whoEncoded = encodeWho(orderedSelected);
  const toggleWho = (id: string): string | undefined => {
    const next = new Set(selectedSet);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return encodeWho(allIds.filter((i) => next.has(i)));
  };
  const everyoneWho = allSelected ? "none" : undefined;

  const heading =
    view === "day"
      ? formatLong(date)
      : view === "month"
        ? formatMonth(date)
        : `${formatShort(days[0])} – ${formatShort(days[6])}`;

  const chip =
    "inline-flex h-10 items-center gap-2 rounded-full border px-3.5 text-sm font-medium transition-colors";
  const idle = "border-hairline hover:border-accent hover:text-accent";

  return (
    <>
      <AppHeader title="Calendar" subtitle={heading} active="calendar" />

      <AddEventProvider
        people={people.map((p) => ({ id: p.id, name: p.displayName ?? p.name }))}
        types={await loadEventTypes()}
        classCtx={classCtx}
        defaultDate={view === "month" ? today : date}
      >
      <main className="mx-auto max-w-[92rem] px-6 py-6">
        <div className="flex flex-col gap-6 lg:flex-row">
          <aside className="flex flex-col gap-5 lg:w-60 lg:shrink-0">
            <AddEventButton wide />

            <MiniMonth
              monthISO={startOfMonth(date)}
              todayISO={today}
              selectedDays={days}
              dayHref={(iso) => link({ view, date: iso, who: whoEncoded })}
              prevHref={link({
                view,
                date: addMonths(startOfMonth(date), -1),
                who: whoEncoded,
              })}
              nextHref={link({
                view,
                date: addMonths(startOfMonth(date), 1),
                who: whoEncoded,
              })}
            />

            <div className="flex flex-wrap gap-x-1 gap-y-2 lg:border-t lg:border-hairline lg:pt-4">
              {people.map((p) => (
                <PersonFilterBadge
                  key={p.id}
                  href={link({ view, date, who: toggleWho(p.id) })}
                  name={p.displayName ?? p.name}
                  color={p.color}
                  avatarPath={p.avatarPath}
                  selected={selectedSet.has(p.id)}
                  compact
                />
              ))}
              <FamilyFilterBadge
                href={link({ view, date, who: everyoneWho })}
                selected={allSelected}
                count={people.length}
                color={familyColor}
                compact
              />
            </div>

            <Link
              href={link({
                view,
                date,
                who: whoEncoded,
                sw: showSchoolWork ? "0" : "1",
              })}
              className={`inline-flex h-9 items-center gap-2 self-start rounded-full border px-3.5 text-sm font-medium transition-colors ${
                showSchoolWork
                  ? "border-transparent text-white"
                  : "border-hairline text-muted hover:border-accent hover:text-accent"
              }`}
              style={
                showSchoolWork
                  ? { backgroundColor: CATEGORY_COLORS.SCHOOL }
                  : undefined
              }
              aria-pressed={showSchoolWork}
              title="Show assignments and tests by due date"
            >
              <SchoolIcon className="h-4 w-4" />
              School work
            </Link>
          </aside>

          <div className="min-w-0 flex-1">
            <div className="mb-4 flex flex-wrap items-center justify-end gap-2">
              <div className="mr-auto inline-flex rounded-full border border-hairline p-0.5">
                {VIEWS.map((v) => (
                  <Link
                    key={v.key}
                    href={link({ view: v.key, date, who: whoEncoded })}
                    className={`inline-flex h-9 items-center rounded-full px-4 text-sm font-medium transition-colors ${
                      view === v.key
                        ? "bg-accent text-white"
                        : "text-muted hover:text-accent"
                    }`}
                  >
                    {v.label}
                  </Link>
                ))}
              </div>

              <Link
                href={link({ view, date: step(-1), who: whoEncoded })}
                className={`${chip} ${idle}`}
              >
                &larr;
              </Link>
              <Link href={link({ view, who: whoEncoded })} className={`${chip} ${idle}`}>
                Today
              </Link>
              <Link
                href={link({ view, date: step(1), who: whoEncoded })}
                className={`${chip} ${idle}`}
              >
                &rarr;
              </Link>
            </div>

            {view === "week" && (
              <CalendarView
                days={days}
                timed={range.timed}
                allDay={range.allDay}
                todayISO={today}
                nowColor={calPrefs.nowColor}
                resetSec={calPrefs.scrollResetSec}
                blockMinutes={calPrefs.blockMinutes}
                sharedStyle={calPrefs.sharedStyle}
              />
            )}

            {view === "day" && (
              <DayPanel
                date={date}
                range={range}
                todayISO={today}
                nowColor={calPrefs.nowColor}
                resetSec={calPrefs.scrollResetSec}
                blockMinutes={calPrefs.blockMinutes}
                sharedStyle={calPrefs.sharedStyle}
                people={people
                  .filter((p) => selectedSet.has(p.id))
                  .map((p) => ({
                    id: p.id,
                    name: p.displayName ?? p.name,
                    color: p.color,
                  }))}
              />
            )}

            {view === "month" && (
              <MonthGrid
                days={days}
                monthISO={startOfMonth(date)}
                events={[...range.allDay, ...range.timed]}
                todayISO={today}
                hrefForDay={(iso) =>
                  link({ view: "day", date: iso, who: whoEncoded })
                }
                sharedStyle={calPrefs.sharedStyle}
              />
            )}
          </div>
        </div>
      </main>
      </AddEventProvider>
    </>
  );
}

function DayPanel({
  date,
  range,
  todayISO,
  nowColor,
  resetSec,
  blockMinutes,
  sharedStyle,
  people,
}: {
  date: string;
  range: { timed: GridEvent[]; allDay: GridEvent[] };
  todayISO: string;
  nowColor: string;
  resetSec: number;
  blockMinutes: number;
  sharedStyle: SharedStyle;
  people: { id: string; name: string; color: string }[];
}) {
  if (people.length === 0) {
    return (
      <div className="rounded-xl border border-hairline px-5 py-10 text-center text-sm text-muted">
        Select at least one person to see the day.
      </div>
    );
  }

  return (
    <WeekGrid
      days={[date]}
      timed={range.timed}
      allDay={range.allDay}
      todayISO={todayISO}
      nowColor={nowColor}
      resetSec={resetSec}
      blockMinutes={blockMinutes}
      sharedStyle={sharedStyle}
      personColumns={people}
    />
  );
}
