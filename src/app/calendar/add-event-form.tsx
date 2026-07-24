"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { addEvent, type EventState } from "@/lib/actions/events";
import { Card } from "@/components/ui";
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

export function AddEventForm({
  people,
  defaultDate,
}: {
  people: { id: string; name: string }[];
  defaultDate: string;
}) {
  const [open, setOpen] = useState(false);
  const [allDay, setAllDay] = useState(false);
  const [kind, setKind] = useState("APPOINTMENT");
  const [repeat, setRepeat] = useState("NONE");
  const [customFreq, setCustomFreq] = useState("WEEKLY");

  // A birthday is annual and all-day by definition, so choosing it sets
  // both rather than making you set them again.
  const chooseKind = (value: string) => {
    setKind(value);
    if (value === "BIRTHDAY") {
      setAllDay(true);
      setRepeat("YEARLY");
    }
  };

  const effectiveRepeat = repeat === "CUSTOM" ? customFreq : repeat;
  const [state, formAction, pending] = useActionState(addEvent, initial);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!pending && state.saved && !state.error) formRef.current?.reset();
  }, [state, pending]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-11 items-center gap-2 rounded-full bg-accent px-5 text-sm font-medium text-white shadow-sm transition-all hover:shadow-md hover:brightness-110"
      >
        <PlusIcon className="h-4 w-4" />
        Add event
      </button>
    );
  }

  return (
    <Card className="p-5">
      <form ref={formRef} action={formAction} className="space-y-4">
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
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="ev-kind" className="mb-1.5 block text-sm font-medium">
              Kind
            </label>
            <select
              id="ev-kind"
              name="kind"
              value={kind}
              onChange={(e) => chooseKind(e.target.value)}
              className={field}
            >
              {KINDS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="ev-date" className="mb-1.5 block text-sm font-medium">
              Date
            </label>
            <input
              id="ev-date"
              name="date"
              type="date"
              required
              defaultValue={defaultDate}
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
                  defaultValue="16:00"
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
                  defaultValue="17:00"
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
                <label
                  htmlFor="ev-interval"
                  className="mb-1.5 block text-sm font-medium"
                >
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
                <label
                  htmlFor="ev-freq"
                  className="mb-1.5 block text-sm font-medium"
                >
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
        {state.saved && !state.error && (
          <p className="text-sm font-medium text-emerald-700">Added.</p>
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
            onClick={() => setOpen(false)}
            className="inline-flex h-11 items-center rounded-full border border-hairline px-5 text-sm font-medium text-muted"
          >
            Done
          </button>
        </div>
      </form>
    </Card>
  );
}
