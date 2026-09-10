"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { TimeSelect } from "@/components/time-select";
import { LocationCombobox } from "@/components/location-combobox";
import {
  saveClassFromCalendar,
  type SchoolActionState,
} from "@/lib/actions/school";

const FIELD =
  "mt-1.5 h-11 w-full rounded-full border border-hairline bg-surface px-5 outline-none focus:border-accent";

/** "HH:MM" plus one hour, wrapping at midnight; "" for a bad input. */
function addHour(t: string): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t);
  if (!m) return "";
  const mins = ((+m[1]) * 60 + (+m[2]) + 60) % (24 * 60);
  return `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
}

const REMINDER_PRESETS: [number, string][] = [
  [10, "10 min"],
  [15, "15 min"],
  [30, "30 min"],
  [60, "1 hour"],
  [1440, "1 day"],
];

const WEEKDAYS: [string, string][] = [
  ["MO", "Mon"],
  ["TU", "Tue"],
  ["WE", "Wed"],
  ["TH", "Thu"],
  ["FR", "Fri"],
  ["SA", "Sat"],
  ["SU", "Sun"],
];

const COLORS: [string, string][] = [
  ["", "Default"],
  ["#2563eb", "Blue"],
  ["#059669", "Green"],
  ["#dc2626", "Red"],
  ["#d97706", "Orange"],
  ["#7c3aed", "Purple"],
  ["#0d9488", "Teal"],
];

const initial: SchoolActionState = { error: null };

export type ClassFormOption = { id: string; name: string };

export type ClassEditInit = {
  id: string;
  name: string;
  ownerId: string;
  ownerName: string;
  subjectId: string | null;
  classTypeId: string | null;
  termId: string | null;
  color: string | null;
  meetingDays: string[];
  meetingStart: string;
  meetingEnd: string;
  meetingReminders: number[];
  meetingReminderUserIds: string[];
  meetingLocation: string | null;
  meetingStartDate: string | null;
  meetingEndDate: string | null;
  sharedWith: string[];
  promptHomework: boolean;
};

/**
 * The class editor as it appears inside the calendar's "Class" overlay. Same
 * fields, same field names, and same save core as the admin class form, so a
 * class made here is identical to one made in admin. Owner is a single student
 * (a non-admin can only make their own, enforced server-side).
 */
export function CalendarClassForm({
  people,
  subjects,
  classTypes,
  terms,
  isAdmin,
  meName,
  dayToken,
  start,
  end,
  editing,
  replaceEventId,
  onClose,
  kindValue,
  onKindChange,
  kindOptions,
}: {
  people: ClassFormOption[];
  subjects: ClassFormOption[];
  classTypes: ClassFormOption[];
  terms: ClassFormOption[];
  isAdmin: boolean;
  meName: string | null;
  dayToken?: string;
  start?: string;
  end?: string;
  editing?: ClassEditInit;
  replaceEventId?: string;
  onClose: () => void;
  kindValue?: string;
  onKindChange?: (v: string) => void;
  kindOptions?: { value: string; label: string }[];
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(saveClassFromCalendar, initial);
  const ref = useRef<HTMLFormElement>(null);

  const [owner, setOwner] = useState(
    editing?.ownerId ?? people[0]?.id ?? "",
  );
  const [days, setDays] = useState<string[]>(
    editing?.meetingDays ?? (dayToken ? [dayToken] : []),
  );
  const [shared, setShared] = useState<string[]>(editing?.sharedWith ?? []);
  const showKind = !editing && !!kindOptions && !!onKindChange;
  const subjectDefault = editing?.subjectId
    ? subjects.find((sub) => sub.id === editing.subjectId)?.name ?? ""
    : "";
  const [color, setColor] = useState(editing?.color ?? "");
  const startInit = editing?.meetingStart || start || "";
  const [startTime, setStartTime] = useState(startInit);
  const [endTime, setEndTime] = useState(
    editing?.meetingEnd || (startInit ? addHour(startInit) : ""),
  );
  const [reminders, setReminders] = useState<Set<number>>(
    () => new Set(editing?.meetingReminders ?? []),
  );
  const [bells, setBells] = useState<Set<string>>(
    () => new Set(editing?.meetingReminderUserIds ?? []),
  );
  const toggleReminder = (m: number) =>
    setReminders((prev) => {
      const n = new Set(prev);
      if (n.has(m)) n.delete(m);
      else n.add(m);
      return n;
    });
  const toggleBell = (id: string) =>
    setBells((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  useEffect(() => {
    if (!pending && !state.error && state !== initial) {
      onClose();
      router.refresh();
    }
  }, [state, pending, onClose, router]);

  const ownerId = editing ? editing.ownerId : isAdmin ? owner : "";
  const shareOptions = people.filter((p) => p.id !== ownerId);
  const toggleShared = (uid: string) =>
    setShared((cur) =>
      cur.includes(uid) ? cur.filter((x) => x !== uid) : [...cur, uid],
    );
  const toggleDay = (d: string) =>
    setDays((cur) =>
      cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d],
    );

  return (
    <form ref={ref} action={action} className="space-y-4">
      {editing && <input type="hidden" name="id" value={editing.id} />}
      {replaceEventId && (
        <input type="hidden" name="replaceEventId" value={replaceEventId} />
      )}
      <input type="hidden" name="byday" value={days.join(",")} />
      <input
        type="hidden"
        name="sharedWith"
        value={shared.filter((id) => id !== ownerId).join(",")}
      />
      {[...reminders].map((m) => (
        <input key={m} type="hidden" name="reminders" value={m} />
      ))}
      {[...bells].map((id) => (
        <input key={id} type="hidden" name="reminderBell" value={id} />
      ))}

      {/* Subject */}
      <div>
        <label className="block text-sm font-medium">Subject</label>
        <input
          name="newSubject"
          list="class-subjects"
          defaultValue={subjectDefault}
          required
          maxLength={60}
          placeholder="Biology, Math, Piano…"
          className={FIELD}
        />
        <datalist id="class-subjects">
          {subjects.map((sub) => (
            <option key={sub.id} value={sub.name} />
          ))}
        </datalist>
      </div>

      {/* Student | Type */}
      <div className="grid gap-3 sm:grid-cols-2">
        {isAdmin && !editing ? (
          <div>
            <label className="block text-sm font-medium">Student</label>
            <select
              name="userId"
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
              className={`${FIELD} select-caret`}
            >
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div
            className={`flex items-end text-sm text-muted ${showKind ? "" : "sm:col-span-2"}`}
          >
            {editing
              ? `${editing.ownerName}\u2019s class`
              : `Your class${meName ? ` (${meName})` : ""}`}
          </div>
        )}
        {showKind && (
          <div>
            <label className="block text-sm font-medium">Type</label>
            <select
              value={kindValue}
              onChange={(e) => onKindChange!(e.target.value)}
              className={`${FIELD} select-caret`}
            >
              {kindOptions!.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Shared with | Reminders */}
      <div className="grid gap-3 sm:grid-cols-2">
        {shareOptions.length > 0 ? (
          <div>
            <label className="block text-sm font-medium">Shared with</label>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {shareOptions.map((p) => (
                <span key={p.id} className="inline-flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => toggleShared(p.id)}
                    aria-pressed={shared.includes(p.id)}
                    className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                      shared.includes(p.id)
                        ? "border-accent bg-accent/10 text-accent"
                        : "border-hairline text-muted hover:border-accent"
                    }`}
                  >
                    {p.name}
                  </button>
                  {shared.includes(p.id) && (
                    <button
                      type="button"
                      onClick={() => toggleBell(p.id)}
                      title={
                        bells.has(p.id)
                          ? `Notifications on for ${p.name}`
                          : `Notifications off for ${p.name}`
                      }
                      aria-label="Toggle notifications"
                      className={
                        bells.has(p.id) ? "text-green-600" : "text-red-500"
                      }
                    >
                      <BellToggle on={bells.has(p.id)} />
                    </button>
                  )}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <div />
        )}

        <div>
          <label className="block text-sm font-medium">Reminders</label>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {REMINDER_PRESETS.map(([min, label]) => (
              <button
                key={min}
                type="button"
                onClick={() => toggleReminder(min)}
                aria-pressed={reminders.has(min)}
                className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                  reminders.has(min)
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-hairline text-muted hover:border-accent"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Meets on */}
      <div>
        <label className="block text-sm font-medium">Meets on</label>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {WEEKDAYS.map(([token, label]) => (
            <button
              key={token}
              type="button"
              onClick={() => toggleDay(token)}
              aria-pressed={days.includes(token)}
              className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                days.includes(token)
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-hairline text-muted hover:border-accent"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Start | End | Runs from | Runs until */}
      {days.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium">Start time</label>
            <TimeSelect
              name="start"
              ariaLabel="Start time"
              value={startTime}
              onChange={(v) => {
                setStartTime(v);
                if (!endTime) setEndTime(addHour(v));
              }}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">End time</label>
            <TimeSelect
              name="end"
              ariaLabel="End time"
              value={endTime}
              onChange={setEndTime}
            />
          </div>
          <div>
            <label className="block text-sm font-medium">
              Runs from <span className="text-muted">(opt.)</span>
            </label>
            <input
              name="meetingStartDate"
              type="date"
              defaultValue={editing?.meetingStartDate ?? ""}
              className={`tabular ${FIELD}`}
            />
          </div>
          <div>
            <label className="block text-sm font-medium">
              Runs until <span className="text-muted">(opt.)</span>
            </label>
            <input
              name="meetingEndDate"
              type="date"
              defaultValue={editing?.meetingEndDate ?? ""}
              className={`tabular ${FIELD}`}
            />
          </div>
        </div>
      )}

      {/* Where */}
      {days.length > 0 && (
        <div>
          <label className="block text-sm font-medium">Where</label>
          <LocationCombobox
            defaultValue={editing?.meetingLocation ?? ""}
            fieldClassName={FIELD}
          />
        </div>
      )}

      {/* Class type | Semester | Color */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="block text-sm font-medium">Class type</label>
          <select
            name="classTypeId"
            defaultValue={editing?.classTypeId ?? ""}
            className={`${FIELD} select-caret`}
          >
            <option value="">Choose a type…</option>
            {classTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium">Semester</label>
          {terms.length > 0 ? (
            <select
              name="termId"
              defaultValue={editing?.termId ?? ""}
              className={`${FIELD} select-caret`}
            >
              <option value="">
                {days.length > 0 ? "Repeats with no end date" : "No term"}
              </option>
              {terms.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          ) : (
            <>
              <input type="hidden" name="termId" value="" />
              <p className="mt-2.5 text-sm text-muted">No semesters yet</p>
            </>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium">Color</label>
          <div className="mt-1.5 flex items-center gap-2">
            <span
              className="h-5 w-5 shrink-0 rounded-full border border-hairline"
              style={{ backgroundColor: color || "#e2e8f0" }}
            />
            <select
              name="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-11 w-full rounded-full border border-hairline bg-surface px-5 outline-none focus:border-accent select-caret"
            >
              {COLORS.map(([hex, label]) => (
                <option key={label} value={hex}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Homework */}
      <label className="flex items-start gap-2.5 text-sm">
        <input
          type="checkbox"
          name="promptHomework"
          defaultChecked={editing?.promptHomework ?? true}
          className="mt-0.5 h-4 w-4 rounded border-hairline accent-accent"
        />
        <span>Ask about homework after class</span>
      </label>

      {state.error && (
        <p role="alert" className="text-sm font-medium text-red-700">
          {state.error}
        </p>
      )}

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="h-10 rounded-full px-4 text-sm font-medium text-muted hover:text-ink"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={pending}
          className="h-10 rounded-full bg-accent px-5 text-sm font-semibold text-on-accent disabled:opacity-50"
        >
          {pending ? "Saving…" : editing ? "Save class" : "Add class"}
        </button>
      </div>
    </form>
  );
}

function BellToggle({ on }: { on: boolean }) {
  return (
    <svg
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      {!on && <line x1="2" x2="22" y1="2" y2="22" />}
    </svg>
  );
}
