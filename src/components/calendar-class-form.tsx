"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  saveClassFromCalendar,
  type SchoolActionState,
} from "@/lib/actions/school";

const FIELD =
  "mt-1.5 w-full rounded-md border border-hairline bg-surface px-3 py-2 text-sm outline-none focus:border-accent";

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
  const [subjectId, setSubjectId] = useState<string>(editing?.subjectId ?? "");

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

      <div className="grid gap-3 sm:grid-cols-2">
        {/* Owner: a student. Admins pick; a non-admin's class is their own. */}
        {isAdmin && !editing ? (
          <div>
            <label className="block text-sm font-medium">Student</label>
            <select
              name="userId"
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
              className={FIELD}
            >
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="sm:col-span-2 text-sm text-muted">
            {editing
              ? `${editing.ownerName}\u2019s class`
              : `Your class${meName ? ` (${meName})` : ""}`}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium">Subject</label>
          <select
            name="subjectId"
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
            className={FIELD}
          >
            <option value="">+ Add a new subject…</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          {subjectId === "" && (
            <input
              name="newSubject"
              required
              maxLength={60}
              autoFocus
              placeholder="New subject name (e.g. Biology)"
              className={`${FIELD} mt-2`}
            />
          )}
        </div>

        <div>
          <label className="block text-sm font-medium">Type</label>
          <select
            name="classTypeId"
            defaultValue={editing?.classTypeId ?? ""}
            className={FIELD}
          >
            <option value="">No type</option>
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
              className={FIELD}
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
            <input type="hidden" name="termId" value="" />
          )}
        </div>

        <div>
          <label className="block text-sm font-medium">Colour</label>
          <select
            name="color"
            defaultValue={editing?.color ?? ""}
            className={FIELD}
          >
            {COLORS.map(([hex, label]) => (
              <option key={label} value={hex}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium">Meets on</label>
        <p className="mb-1.5 text-xs text-muted">
          Prefilled from the time you picked. Leave blank for independent work
          with no calendar time.
        </p>
        <div className="flex flex-wrap gap-1.5">
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

      {days.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium">Start time</label>
            <input
              name="start"
              type="time"
              defaultValue={editing?.meetingStart || start || ""}
              className={`tabular ${FIELD}`}
            />
          </div>
          <div>
            <label className="block text-sm font-medium">End time</label>
            <input
              name="end"
              type="time"
              defaultValue={editing?.meetingEnd || end || ""}
              className={`tabular ${FIELD}`}
            />
          </div>
        </div>
      )}

      {days.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium">
              Runs from <span className="text-muted">(optional)</span>
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
              Runs until <span className="text-muted">(optional)</span>
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

      {shareOptions.length > 0 && (
        <div>
          <label className="block text-sm font-medium">Shared with</label>
          <p className="mb-1.5 text-xs text-muted">
            Other students in this class. If it meets, the block shows on their
            calendars too.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {shareOptions.map((p) => (
              <button
                key={p.id}
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
            ))}
          </div>
        </div>
      )}

      <label className="flex items-start gap-2.5 text-sm">
        <input
          type="checkbox"
          name="promptHomework"
          defaultChecked={editing?.promptHomework ?? true}
          className="mt-0.5 h-4 w-4 rounded border-hairline accent-accent"
        />
        <span>
          Ask about homework after class
          <span className="mt-0.5 block text-xs text-muted">
            After a meeting ends, each student gets a quick attendance and
            “work assigned?” check on their dashboard.
          </span>
        </span>
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
          className="h-10 rounded-full bg-accent px-5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {pending ? "Saving…" : editing ? "Save class" : "Add class"}
        </button>
      </div>
    </form>
  );
}
