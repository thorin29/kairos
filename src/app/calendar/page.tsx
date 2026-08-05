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
import { AddEventProvider, AddEventButton } from "./add-event-form";
import { PersonFilterBadge, FamilyFilterBadge } from "@/components/person-filter";
import { getFamilyColor } from "@/lib/settings";
import { getCalendarPrefs } from "@/lib/settings";

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
  searchParams: Promise<{ view?: string; date?: string; who?: string }>;
}) {
  const { view: rawView, date: rawDate, who } = await searchParams;

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

  const [range, people] = await Promise.all([
    loadRange(days, filterIds),
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

  const link = (p: { view?: View; date?: string; who?: string }) => {
    const q = new URLSearchParams();
    if (p.view && p.view !== "week") q.set("view", p.view);
    if (p.date) q.set("date", p.date);
    if (p.who) q.set("who", p.who);
    const s = q.toString();
    return s ? `/calendar?${s}` : "/calendar";
  };

  // Resolve the current selection against the real roster, and build helpers to
  // toggle people in and out of it via the URL.
  const familyColor = await getFamilyColor();
  const calPrefs = await getCalendarPrefs();
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
  const noneSelected = orderedSelected.length === 0;

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

  const selectedNames = people
    .filter((p) => selectedSet.has(p.id))
    .map((p) => p.displayName ?? p.name);
  const joinNames = (names: string[]): string =>
    names.length <= 1
      ? (names[0] ?? "")
      : names.length === 2
        ? `${names[0]} and ${names[1]}`
        : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
  const caption = noneSelected
    ? "No calendars are selected."
    : allSelected
      ? "The whole family's schedules."
      : `${joinNames(selectedNames)}'s ${selectedNames.length > 1 ? "schedules" : "schedule"}.`;

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
        defaultDate={view === "month" ? today : date}
      >
      <main className="mx-auto max-w-6xl px-6 py-6">


      <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
        <AddEventButton />
        <div className="flex flex-wrap items-center gap-2">
          <div className="mr-1 inline-flex rounded-full border border-hairline p-0.5">
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
      </div>

      <div className="mb-4">
        <p className="text-xs text-muted">{caption}</p>
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
        />
      )}

      {view === "month" && (
        <MonthGrid
          days={days}
          monthISO={startOfMonth(date)}
          events={[...range.allDay, ...range.timed]}
          todayISO={today}
          hrefForDay={(iso) => link({ view: "day", date: iso, who: whoEncoded })}
        />
      )}

      <div className="mt-4">
        <div className="flex flex-wrap items-start gap-x-1 gap-y-2">
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
}: {
  date: string;
  range: { timed: GridEvent[]; allDay: GridEvent[] };
  todayISO: string;
  nowColor: string;
  resetSec: number;
  blockMinutes: number;
}) {
  return (
    <WeekGrid
      days={[date]}
      timed={range.timed}
      allDay={range.allDay}
      todayISO={todayISO}
      nowColor={nowColor}
      resetSec={resetSec}
      blockMinutes={blockMinutes}
    />
  );
}
