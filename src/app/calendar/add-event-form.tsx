"use client";

import {
  createContext,
  useActionState,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { addEvent, updateEvent, type EventState } from "@/lib/actions/events";
import { parseRule, WEEKDAY_TOKENS } from "@/lib/calendar/recur";
import { addDays, dayOfWeek, daysBetween } from "@/lib/dates";
import { PlusIcon } from "@/components/icons";
import { TimeSelect } from "@/components/time-select";
import {
  CalendarClassForm,
  type ClassFormOption,
} from "@/components/calendar-class-form";

const initial: EventState = { error: null, saved: false };

export type ClassCtx = {
  canMakeClass: boolean;
  isAdmin: boolean;
  meName: string | null;
  subjects: ClassFormOption[];
  classTypes: ClassFormOption[];
  terms: ClassFormOption[];
  people: ClassFormOption[];
};

const SUN_FIRST_TOKENS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
function weekdayToken(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return SUN_FIRST_TOKENS[d.getDay()] ?? "MO";
}

const field =
  "h-11 w-full rounded-full border border-hairline bg-surface px-5 outline-none focus:border-accent";

const KINDS = [
  { value: "APPOINTMENT", label: "Appointment" },
  { value: "CLASS", label: "Class" },
  { value: "WORK", label: "Work shift" },
  { value: "BIRTHDAY", label: "Birthday" },
];

const DAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];
const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const REPEATS = [
  { value: "NONE", label: "Does not repeat" },
  { value: "WEEKLY", label: "Weekly" },
  { value: "MONTHLY", label: "Monthly" },
  { value: "YEARLY", label: "Annually" },
  { value: "DAILY", label: "Daily" },
  { value: "CUSTOM", label: "Custom\u2026" },
];

function addHour(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  if (!Number.isFinite(h)) return "17:00";
  const nh = (h + 1) % 24;
  return `${String(nh).padStart(2, "0")}:${String(m || 0).padStart(2, "0")}`;
}

function hhmmToMin(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
}

// Minutes-from-midnight → "HH:MM", wrapping into the day (the day it spills
// onto is tracked separately by the end-date field).
function minToHHMM(total: number): string {
  const t = ((total % 1440) + 1440) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(
    t % 60,
  ).padStart(2, "0")}`;
}

// --- shared open mechanism ------------------------------------------------

type Prefill = {
  date?: string;
  start?: string;
  end?: string;
  // Days the end date sits after the start date (0 = same day). Kept as an
  // offset, not an absolute date, so a copy dropped on a new day keeps its span.
  endDayOffset?: number;
  // Copy: seed the remaining fields from an existing event so the overlay opens
  // as a duplicate the user can re-place.
  title?: string;
  userId?: string;
  kind?: string;
  location?: string;
  allDay?: boolean;
  shadeDay?: boolean;
  rrule?: string | null;
  // People the event is shared with (besides the owner), to pre-check the picker.
  participantIds?: string[];
};
export type EditTarget = {
  eventId: string;
  occurrenceISO: string;
  recurring: boolean;
  // Which way a recurring edit was opened: just the clicked occurrence, or the
  // whole series. Chosen up front (the pop-up on Edit) and pre-selects the
  // in-form radio, which can still be changed before saving.
  scope?: "single" | "series";
};

const AddEventContext = createContext<{
  openAt: (p?: Prefill) => void;
  openEdit: (p: Prefill, target: EditTarget) => void;
}>({
  openAt: () => {},
  openEdit: () => {},
});

export function useAddEvent() {
  return useContext(AddEventContext);
}

export function AddEventProvider({
  people,
  types,
  classCtx,
  defaultDate,
  children,
}: {
  people: { id: string; name: string }[];
  types: {
    id: string;
    name: string;
    color: string;
    sportWorkout: boolean;
    defaultMinutes: number | null;
  }[];
  classCtx: ClassCtx;
  defaultDate: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [prefill, setPrefill] = useState<Prefill>({});
  const [editing, setEditing] = useState<EditTarget | null>(null);
  const [openId, setOpenId] = useState(0);

  const openAt = (p?: Prefill) => {
    setPrefill(p ?? {});
    setEditing(null);
    setOpenId((n) => n + 1);
    setOpen(true);
  };

  const openEdit = (p: Prefill, target: EditTarget) => {
    setPrefill(p);
    setEditing(target);
    setOpenId((n) => n + 1);
    setOpen(true);
  };

  return (
    <AddEventContext.Provider value={{ openAt, openEdit }}>
      {children}
      {open && (
        <EventModal
          key={openId}
          people={people}
          types={types}
          classCtx={classCtx}
          editing={editing}
          date={prefill.date ?? defaultDate}
          start={prefill.start ?? "16:00"}
          end={prefill.end}
          endDayOffset={prefill.endDayOffset}
          title={prefill.title}
          userId={prefill.userId}
          kindInit={prefill.kind}
          location={prefill.location}
          allDayInit={prefill.allDay}
          shadeDayInit={prefill.shadeDay}
          rruleInit={prefill.rrule}
          participantIdsInit={prefill.participantIds}
          onClose={() => setOpen(false)}
        />
      )}
    </AddEventContext.Provider>
  );
}

/** The top-of-calendar "+" trigger. */
export function AddEventButton({ wide = false }: { wide?: boolean }) {
  const { openAt } = useAddEvent();
  if (wide) {
    return (
      <button
        type="button"
        onClick={() => openAt()}
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-accent px-4 font-semibold text-white shadow-sm transition-all hover:shadow-md hover:brightness-110"
      >
        <PlusIcon className="h-5 w-5" />
        New event
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={() => openAt()}
      aria-label="Add event"
      title="Add event"
      className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-accent text-white shadow-sm transition-all hover:shadow-md hover:brightness-110"
    >
      <PlusIcon className="h-5 w-5" />
    </button>
  );
}

// --- the overlay form -----------------------------------------------------

function EventModal({
  people,
  types,
  classCtx,
  editing,
  date,
  start,
  end,
  endDayOffset,
  title,
  userId,
  kindInit,
  location,
  allDayInit,
  shadeDayInit,
  rruleInit,
  participantIdsInit,
  onClose,
}: {
  people: { id: string; name: string }[];
  types: {
    id: string;
    name: string;
    color: string;
    sportWorkout: boolean;
    defaultMinutes: number | null;
  }[];
  classCtx: ClassCtx;
  editing?: EditTarget | null;
  date: string;
  start: string;
  end?: string;
  endDayOffset?: number;
  title?: string;
  userId?: string;
  kindInit?: string;
  location?: string;
  allDayInit?: boolean;
  shadeDayInit?: boolean;
  rruleInit?: string | null;
  participantIdsInit?: string[];
  onClose: () => void;
}) {
  const [allDay, setAllDay] = useState(allDayInit ?? false);
  const [kind, setKind] = useState(kindInit ?? "APPOINTMENT");
  // When editing a repeating event, pre-fill the repeat controls from its rule
  // so a series edit can change the pattern (ignored when adding or copying).
  const editRec = editing?.recurring ? parseRule(rruleInit ?? null) : null;
  const [repeat, setRepeat] = useState<string>(
    editRec ? (editRec.interval > 1 ? "CUSTOM" : editRec.freq) : "NONE",
  );
  const [customFreq, setCustomFreq] = useState<string>(editRec?.freq ?? "WEEKLY");
  const [endMode, setEndMode] = useState<"never" | "until" | "count">(
    editRec?.until ? "until" : editRec?.count ? "count" : "never",
  );
  // Weekly-only: which weekdays the event lands on. Defaults to the start
  // date's own weekday, so a plain weekly event behaves exactly as before.
  const [byday, setByday] = useState<string[]>(() =>
    editRec?.byday && editRec.byday.length > 0
      ? [...editRec.byday]
      : [WEEKDAY_TOKENS[dayOfWeek(date)]],
  );
  const toggleDay = (token: string) =>
    setByday((prev) =>
      prev.includes(token)
        ? // Never let the last day be turned off — a weekly event needs one.
          prev.length > 1
          ? prev.filter((d) => d !== token)
          : prev
        : [...prev, token],
    );
  // For a recurring event, an edit applies to just this occurrence or the
  // whole series. Default to the single occurrence — the safer, smaller change.
  const [scope, setScope] = useState<"single" | "series">(
    editing?.scope ?? "single",
  );

  const [startDate, setStartDate] = useState(date);
  const [endDate, setEndDate] = useState(() => addDays(date, endDayOffset ?? 0));
  const [startTime, setStartTime] = useState(start);
  const [endTime, setEndTime] = useState(end ?? addHour(start));

  // The event's length in minutes across whatever days it spans. Used to keep
  // the end in step when the start moves — drag the start later and the end
  // follows, staying exactly as long as before.
  const spanMinutes = () =>
    daysBetween(startDate, endDate) * 1440 +
    hhmmToMin(endTime) -
    hhmmToMin(startTime);

  // Put the end `endAbs` minutes after the given day's midnight, spilling onto
  // a later day when it crosses midnight.
  const placeEnd = (baseDate: string, endAbs: number) => {
    setEndDate(addDays(baseDate, Math.floor(endAbs / 1440)));
    setEndTime(minToHHMM(endAbs));
  };

  const onStartTimeChange = (v: string) => {
    const dur = Math.max(spanMinutes(), 15);
    setStartTime(v);
    placeEnd(startDate, hhmmToMin(v) + dur);
  };

  const onStartDateChange = (d: string) => {
    const dur = Math.max(spanMinutes(), 15);
    setStartDate(d);
    placeEnd(d, hhmmToMin(startTime) + dur);
  };

  const chooseKind = (value: string) => {
    setKind(value);
    if (value === "BIRTHDAY") {
      setAllDay(true);
      setRepeat("YEARLY");
    }
    if (value.startsWith("type:")) {
      const t = types.find((x) => `type:${x.id}` === value);
      if (t?.defaultMinutes) {
        placeEnd(startDate, hhmmToMin(startTime) + t.defaultMinutes);
      }
    }
  };

  const isCustomType = kind.startsWith("type:");
  const kindForSubmit = isCustomType ? "OTHER" : kind;
  const eventTypeId = isCustomType ? kind.slice(5) : "";

  // "Class" is only offered when the household allows it (admins always). When
  // it's chosen for a NEW event, the overlay becomes the full class form and
  // saves a real class instead of a bare calendar block. Editing an existing
  // class event still uses the plain editor for now.
  const kindOptions = classCtx.canMakeClass
    ? KINDS
    : KINDS.filter((k) => k.value !== "CLASS");
  const classCreate = kind === "CLASS" && !editing && classCtx.canMakeClass;
  const isSport =
    (eventTypeId ? types.find((t) => t.id === eventTypeId) : undefined)
      ?.sportWorkout ?? false;
  const effectiveRepeat = repeat === "CUSTOM" ? customFreq : repeat;

  const [state, formAction, pending] = useActionState(
    editing ? updateEvent : addEvent,
    initial,
  );

  // Close once the server confirms the save.
  useEffect(() => {
    if (!pending && state.saved && !state.error) onClose();
  }, [state, pending, onClose]);

  // Close on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (classCreate) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:items-center"
        onClick={onClose}
      >
        <div
          className="my-4 w-full max-w-lg rounded-2xl bg-surface p-5 shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">Add class</h2>
            <div className="flex items-center gap-2">
              <select
                value={kind}
                onChange={(e) => chooseKind(e.target.value)}
                className="h-8 rounded-full border border-hairline bg-surface px-3 text-sm outline-none focus:border-accent"
              >
                {kindOptions.map((k) => (
                  <option key={k.value} value={k.value}>
                    {k.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="flex h-8 w-8 items-center justify-center rounded-full text-muted hover:bg-ground"
              >
                ✕
              </button>
            </div>
          </div>
          <CalendarClassForm
            people={classCtx.people}
            subjects={classCtx.subjects}
            classTypes={classCtx.classTypes}
            terms={classCtx.terms}
            isAdmin={classCtx.isAdmin}
            meName={classCtx.meName}
            dayToken={weekdayToken(date)}
            start={start}
            end={end}
            onClose={onClose}
          />
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        className="my-4 w-full max-w-lg rounded-2xl bg-surface p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">
            {editing ? "Edit event" : "Add event"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted hover:bg-ground"
          >
            ✕
          </button>
        </div>

        <form action={formAction} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="ev-title" className="mb-1.5 block text-sm font-medium">
                Event
              </label>
              <input
                id="ev-title"
                name="title"
                required
                maxLength={120}
                autoFocus
                defaultValue={title ?? ""}
                placeholder="Orthodontist, piano lesson, shift…"
                className={field}
              />
            </div>

            <div>
              <label htmlFor="ev-user" className="mb-1.5 block text-sm font-medium">
                Whose
              </label>
              <select
                id="ev-user"
                name="userId"
                required
                defaultValue={userId ?? ""}
                className={field}
              >
                <option value="">Choose</option>
                <option value="family">Family (shared)</option>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="ev-kind" className="mb-1.5 block text-sm font-medium">
                Type
              </label>
              <select
                id="ev-kind"
                value={kind}
                onChange={(e) => chooseKind(e.target.value)}
                className={field}
              >
                {kindOptions.map((k) => (
                  <option key={k.value} value={k.value}>
                    {k.label}
                  </option>
                ))}
                {types.map((t) => (
                  <option key={t.id} value={`type:${t.id}`}>
                    {t.name}
                  </option>
                ))}
              </select>
              <input type="hidden" name="kind" value={kindForSubmit} />
              <input type="hidden" name="eventTypeId" value={eventTypeId} />
            </div>

            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-sm font-medium">
                Share with
              </label>
              <p className="mb-2 text-xs text-muted">
                {isSport
                  ? "Everyone checked also gets asked if they did it. The event shows in each person\u2019s colour."
                  : "Add other people so the event shows on their calendar too, in a blend of everyone\u2019s colours. Leave empty for just the person above."}
              </p>
              <div className="flex flex-wrap gap-2">
                {people.map((p) => (
                  <label
                    key={p.id}
                    className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-hairline px-3 py-1.5 text-sm transition-colors has-[:checked]:border-accent has-[:checked]:bg-accent/10"
                  >
                    <input
                      type="checkbox"
                      name="participants"
                      value={p.id}
                      defaultChecked={participantIdsInit?.includes(p.id) ?? false}
                      className="h-4 w-4"
                    />
                    {p.name}
                  </label>
                ))}
              </div>
            </div>

            {allDay ? (
              <div>
                <label htmlFor="ev-date" className="mb-1.5 block text-sm font-medium">
                  Date
                </label>
                <input
                  id="ev-date"
                  name="date"
                  type="date"
                  required
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className={`tabular ${field}`}
                />
              </div>
            ) : (
              <div className="space-y-3 sm:col-span-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Starts</label>
                  <div className="flex gap-2">
                    <input
                      aria-label="Start date"
                      name="date"
                      type="date"
                      required
                      value={startDate}
                      onChange={(e) => onStartDateChange(e.target.value)}
                      className={`tabular ${field} min-w-0 flex-[3]`}
                    />
                    <TimeSelect
                      name="start"
                      ariaLabel="Start time"
                      value={startTime}
                      onChange={onStartTimeChange}
                      className="min-w-0 flex-[2]"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Ends</label>
                  <div className="flex gap-2">
                    <input
                      aria-label="End date"
                      name="endDate"
                      type="date"
                      required
                      min={startDate}
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className={`tabular ${field} min-w-0 flex-[3]`}
                    />
                    <TimeSelect
                      name="end"
                      ariaLabel="End time"
                      value={endTime}
                      onChange={setEndTime}
                      className="min-w-0 flex-[2]"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className={allDay ? "" : "sm:col-span-2"}>
              <label htmlFor="ev-location" className="mb-1.5 block text-sm font-medium">
                Where
              </label>
              <input
                id="ev-location"
                name="location"
                maxLength={200}
                defaultValue={location ?? ""}
                placeholder="Optional"
                className={field}
              />
            </div>
          </div>

          {(!editing || (editing.recurring && scope === "series")) && (
            <>
              <input type="hidden" name="repeat" value={effectiveRepeat} />
              <input
                type="hidden"
                name="byday"
                value={repeat === "WEEKLY" ? byday.join(",") : ""}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="ev-repeat" className="mb-1.5 block text-sm font-medium">
                    Repeats
                  </label>
              <select
                id="ev-repeat"
                value={repeat}
                onChange={(e) => setRepeat(e.target.value)}
                className={field}
              >
                {REPEATS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>

                {repeat !== "NONE" && (
                  <div>
                    <label htmlFor="ev-endmode" className="mb-1.5 block text-sm font-medium">
                      Ends
                    </label>
                    <select
                      id="ev-endmode"
                      value={endMode}
                      onChange={(e) =>
                        setEndMode(e.target.value as "never" | "until" | "count")
                      }
                      className={field}
                    >
                      <option value="never">Never</option>
                      <option value="until">On a date</option>
                      <option value="count">After a number of times</option>
                    </select>
                    {endMode === "until" && (
                      <input
                        id="ev-until"
                        name="until"
                        type="date"
                        defaultValue={editRec?.until ?? ""}
                        aria-label="Repeat until date"
                        className={`tabular ${field} mt-2`}
                      />
                    )}
                    {endMode === "count" && (
                      <input
                        name="count"
                        type="number"
                        min={1}
                        max={999}
                        defaultValue={editRec?.count ?? 10}
                        aria-label="Number of occurrences"
                        placeholder="times"
                        className={`tabular ${field} mt-2`}
                      />
                    )}
                  </div>
                )}

            {repeat === "WEEKLY" && (
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-sm font-medium">
                  On these days
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {WEEKDAY_TOKENS.map((tok, i) => {
                    const on = byday.includes(tok);
                    return (
                      <button
                        key={tok}
                        type="button"
                        onClick={() => toggleDay(tok)}
                        aria-pressed={on}
                        aria-label={DAY_NAMES[i]}
                        title={DAY_NAMES[i]}
                        className={`h-10 w-10 rounded-full border text-sm font-medium transition-colors ${
                          on
                            ? "border-accent bg-accent text-white"
                            : "border-hairline text-muted hover:border-accent hover:text-accent"
                        }`}
                      >
                        {DAY_LETTERS[i]}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {repeat === "CUSTOM" && (
              <>
                <div>
                  <label htmlFor="ev-interval" className="mb-1.5 block text-sm font-medium">
                    Every
                  </label>
                  <input
                    id="ev-interval"
                    name="interval"
                    type="number"
                    min={1}
                    max={52}
                    defaultValue={editRec?.interval ?? 2}
                    className={`tabular ${field}`}
                  />
                </div>
                <div>
                  <label htmlFor="ev-freq" className="mb-1.5 block text-sm font-medium">
                    Unit
                  </label>
                  <select
                    id="ev-freq"
                    value={customFreq}
                    onChange={(e) => setCustomFreq(e.target.value)}
                    className={field}
                  >
                    <option value="DAILY">days</option>
                    <option value="WEEKLY">weeks</option>
                    <option value="MONTHLY">months</option>
                    <option value="YEARLY">years</option>
                  </select>
                </div>
              </>
            )}
              </div>
            </>
          )}

          {editing && (
            <>
              <input type="hidden" name="eventId" value={editing.eventId} />
              <input
                type="hidden"
                name="occurrenceISO"
                value={editing.occurrenceISO}
              />
              <input
                type="hidden"
                name="scope"
                value={editing.recurring ? scope : "series"}
              />
              {editing.recurring && (
                <div className="rounded-xl border border-hairline p-3">
                  <p className="mb-2 text-sm font-medium">Apply changes to</p>
                  <div className="flex flex-col gap-2 text-sm">
                    <label className="flex items-center gap-2.5">
                      <input
                        type="radio"
                        name="scopeChoice"
                        checked={scope === "single"}
                        onChange={() => setScope("single")}
                        className="h-4 w-4 accent-[var(--color-accent)]"
                      />
                      This event only
                    </label>
                    <label className="flex items-center gap-2.5">
                      <input
                        type="radio"
                        name="scopeChoice"
                        checked={scope === "series"}
                        onChange={() => setScope("series")}
                        className="h-4 w-4 accent-[var(--color-accent)]"
                      />
                      All events in the series
                    </label>
                  </div>
                  {scope === "series" && (
                    <p className="mt-2 text-xs text-muted">
                      Series edits keep each occurrence on its own date and change
                      the time and details.
                    </p>
                  )}
                </div>
              )}
            </>
          )}

          <label className="flex items-center gap-2.5 text-sm">
            <input
              type="checkbox"
              name="allDay"
              checked={allDay}
              onChange={(e) => setAllDay(e.target.checked)}
              className="h-5 w-5 accent-[var(--color-accent)]"
            />
            All day
          </label>

          {allDay && (
            <label className="flex items-center gap-2.5 text-sm">
              <input
                type="checkbox"
                name="shadeDay"
                defaultChecked={shadeDayInit ?? true}
                className="h-5 w-5 accent-[var(--color-accent)]"
              />
              Shade this day on the calendar
            </label>
          )}

          {state.error && (
            <p role="alert" className="text-sm font-medium text-red-700">
              {state.error}
            </p>
          )}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={pending}
              className="inline-flex h-11 items-center rounded-full bg-accent px-5 text-sm font-medium text-white shadow-sm transition-all hover:shadow-md hover:brightness-110 disabled:opacity-50"
            >
              {pending
                ? editing
                  ? "Saving\u2026"
                  : "Adding\u2026"
                : editing
                  ? "Save changes"
                  : "Add event"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-11 items-center rounded-full border border-hairline px-5 text-sm font-medium text-muted transition-colors hover:border-accent hover:text-accent"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
