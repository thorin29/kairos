"use client";

import {
  createContext,
  useActionState,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { addEvent, type EventState } from "@/lib/actions/events";
import { PlusIcon } from "@/components/icons";

const initial: EventState = { error: null, saved: false };

const field =
  "h-11 w-full rounded-full border border-hairline bg-surface px-5 outline-none focus:border-accent";

const KINDS = [
  { value: "APPOINTMENT", label: "Appointment" },
  { value: "CLASS", label: "Class" },
  { value: "WORK", label: "Work shift" },
  { value: "BIRTHDAY", label: "Birthday" },
  { value: "OTHER", label: "Other" },
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

// --- shared open mechanism ------------------------------------------------

type Prefill = { date?: string; start?: string; end?: string };
const AddEventContext = createContext<{ openAt: (p?: Prefill) => void }>({
  openAt: () => {},
});

export function useAddEvent() {
  return useContext(AddEventContext);
}

export function AddEventProvider({
  people,
  types,
  defaultDate,
  children,
}: {
  people: { id: string; name: string }[];
  types: { id: string; name: string; color: string; sportWorkout: boolean }[];
  defaultDate: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [prefill, setPrefill] = useState<Prefill>({});
  const [openId, setOpenId] = useState(0);

  const openAt = (p?: Prefill) => {
    setPrefill(p ?? {});
    setOpenId((n) => n + 1);
    setOpen(true);
  };

  return (
    <AddEventContext.Provider value={{ openAt }}>
      {children}
      {open && (
        <EventModal
          key={openId}
          people={people}
          types={types}
          date={prefill.date ?? defaultDate}
          start={prefill.start ?? "16:00"}
          end={prefill.end}
          onClose={() => setOpen(false)}
        />
      )}
    </AddEventContext.Provider>
  );
}

/** The top-of-calendar "+" trigger. */
export function AddEventButton() {
  const { openAt } = useAddEvent();
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
  date,
  start,
  end,
  onClose,
}: {
  people: { id: string; name: string }[];
  types: { id: string; name: string; color: string; sportWorkout: boolean }[];
  date: string;
  start: string;
  end?: string;
  onClose: () => void;
}) {
  const [allDay, setAllDay] = useState(false);
  const [kind, setKind] = useState("APPOINTMENT");
  const [repeat, setRepeat] = useState("NONE");
  const [customFreq, setCustomFreq] = useState("WEEKLY");

  const chooseKind = (value: string) => {
    setKind(value);
    if (value === "BIRTHDAY") {
      setAllDay(true);
      setRepeat("YEARLY");
    }
  };

  const isCustomType = kind.startsWith("type:");
  const kindForSubmit = isCustomType ? "OTHER" : kind;
  const eventTypeId = isCustomType ? kind.slice(5) : "";
  const isSport =
    (eventTypeId ? types.find((t) => t.id === eventTypeId) : undefined)
      ?.sportWorkout ?? false;
  const effectiveRepeat = repeat === "CUSTOM" ? customFreq : repeat;

  const [state, formAction, pending] = useActionState(addEvent, initial);

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
          <h2 className="font-display text-lg font-semibold">Add event</h2>
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
                placeholder="Orthodontist, piano lesson, shift…"
                className={field}
              />
            </div>

            <div>
              <label htmlFor="ev-user" className="mb-1.5 block text-sm font-medium">
                Whose
              </label>
              <select id="ev-user" name="userId" required className={field}>
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
                {KINDS.map((k) => (
                  <option key={k.value} value={k.value}>
                    {k.label}
                  </option>
                ))}
                {types.length > 0 && (
                  <optgroup label="Custom">
                    {types.map((t) => (
                      <option key={t.id} value={`type:${t.id}`}>
                        {t.name}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
              <input type="hidden" name="kind" value={kindForSubmit} />
              <input type="hidden" name="eventTypeId" value={eventTypeId} />
            </div>

            {isSport && (
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-sm font-medium">
                  Who&rsquo;s going?
                </label>
                <p className="mb-2 text-xs text-muted">
                  Everyone checked gets asked if they did it. Leave empty to just
                  ask whoever it&rsquo;s for.
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
                        className="h-4 w-4"
                      />
                      {p.name}
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label htmlFor="ev-date" className="mb-1.5 block text-sm font-medium">
                Date
              </label>
              <input
                id="ev-date"
                name="date"
                type="date"
                required
                defaultValue={date}
                className={`tabular ${field}`}
              />
            </div>

            <div>
              <label htmlFor="ev-location" className="mb-1.5 block text-sm font-medium">
                Where
              </label>
              <input
                id="ev-location"
                name="location"
                maxLength={200}
                placeholder="Optional"
                className={field}
              />
            </div>

            {!allDay && (
              <>
                <div>
                  <label htmlFor="ev-start" className="mb-1.5 block text-sm font-medium">
                    Starts
                  </label>
                  <input
                    id="ev-start"
                    name="start"
                    type="time"
                    defaultValue={start}
                    className={`tabular ${field}`}
                  />
                </div>
                <div>
                  <label htmlFor="ev-end" className="mb-1.5 block text-sm font-medium">
                    Ends
                  </label>
                  <input
                    id="ev-end"
                    name="end"
                    type="time"
                    defaultValue={end ?? addHour(start)}
                    className={`tabular ${field}`}
                  />
                </div>
              </>
            )}
          </div>

          <input type="hidden" name="repeat" value={effectiveRepeat} />

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
                <label htmlFor="ev-until" className="mb-1.5 block text-sm font-medium">
                  Repeat until
                </label>
                <input
                  id="ev-until"
                  name="until"
                  type="date"
                  className={`tabular ${field}`}
                />
                <p className="mt-1.5 text-xs text-muted">
                  Leave empty to repeat indefinitely.
                </p>
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
                    defaultValue={2}
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
              {pending ? "Adding\u2026" : "Add event"}
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
