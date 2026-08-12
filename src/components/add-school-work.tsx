"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  addSchoolWork,
  type SchoolActionState,
} from "@/lib/actions/school";
import { SCHOOL_TYPES, SCHOOL_TYPE_LABEL } from "@/lib/school";

const initial: SchoolActionState = { error: null };

const FIELD =
  "mt-1.5 w-full rounded-md border border-hairline bg-surface px-3 py-2 outline-none focus:border-accent";

export function AddSchoolWork({
  userId,
  people,
  classesByUser,
  subjects = [],
  defaultDate,
}: {
  userId?: string;
  people?: { id: string; name: string }[];
  classesByUser?: Record<string, { id: string; name: string }[]>;
  subjects?: string[];
  defaultDate: string;
}) {
  const [open, setOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(
    userId ?? people?.[0]?.id ?? "",
  );
  const [dateSpecific, setDateSpecific] = useState(false);
  // Subject comes from the pool; "__other__" reveals a free-text box for a
  // one-off not in the pool.
  const [subject, setSubject] = useState("");
  const [subjectOther, setSubjectOther] = useState(false);
  const [state, formAction, pending] = useActionState(addSchoolWork, initial);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!pending && state !== initial && !state.error) {
      formRef.current?.reset();
      setDateSpecific(false);
      setSubject("");
      setSubjectOther(false);
    }
  }, [state, pending]);

  const classOpts =
    classesByUser?.[people ? selectedUser : (userId ?? "")] ?? [];

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-hairline px-4 py-2 text-sm font-medium text-muted transition-colors hover:border-accent hover:text-accent"
      >
        Add assignment or test
      </button>
    );
  }

  return (
    <form
      ref={formRef}
      action={formAction}
      className="w-full rounded-xl border border-hairline bg-surface p-5"
    >
      {people ? null : <input type="hidden" name="userId" value={userId} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="sw-title" className="block text-sm font-medium">
            Assignment or test
          </label>
          <input
            id="sw-title"
            name="title"
            required
            maxLength={120}
            autoFocus
            placeholder="e.g. Chapter 4 problems, Unit test"
            className={FIELD}
          />
        </div>

        {people && (
          <div>
            <label htmlFor="sw-user" className="block text-sm font-medium">
              For
            </label>
            <select
              id="sw-user"
              name="userId"
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className={FIELD}
            >
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {classOpts.length > 0 && (
          <div>
            <label htmlFor="sw-class" className="block text-sm font-medium">
              Class
            </label>
            <select
              key={selectedUser}
              id="sw-class"
              name="classId"
              defaultValue=""
              className={FIELD}
            >
              <option value="">No class</option>
              {classOpts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label htmlFor="sw-subject" className="block text-sm font-medium">
            Subject
          </label>
          {/* The submitted value: whichever the pool select or the Other box holds. */}
          <input type="hidden" name="subject" value={subject} />
          {subjects.length > 0 && !subjectOther ? (
            <select
              id="sw-subject"
              value={subject}
              onChange={(e) => {
                if (e.target.value === "__other__") {
                  setSubjectOther(true);
                  setSubject("");
                } else {
                  setSubject(e.target.value);
                }
              }}
              className={FIELD}
            >
              <option value="">No subject</option>
              {subjects.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
              <option value="__other__">Other…</option>
            </select>
          ) : (
            <input
              id="sw-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value.slice(0, 60))}
              maxLength={60}
              placeholder="Math, History…"
              className={FIELD}
            />
          )}
        </div>

        <div>
          <label htmlFor="sw-type" className="block text-sm font-medium">
            Type
          </label>
          <select
            id="sw-type"
            name="type"
            defaultValue="HOMEWORK"
            className={FIELD}
          >
            {SCHOOL_TYPES.map((t) => (
              <option key={t} value={t}>
                {SCHOOL_TYPE_LABEL[t]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="sw-due" className="block text-sm font-medium">
            Due
          </label>
          <input
            id="sw-due"
            name="dueDate"
            type="date"
            defaultValue={defaultDate}
            className={`tabular ${FIELD}`}
          />
        </div>

        <div>
          <label htmlFor="sw-due-time" className="block text-sm font-medium">
            Due time <span className="text-muted">(optional)</span>
          </label>
          <input
            id="sw-due-time"
            name="dueTime"
            type="time"
            className={`tabular ${FIELD}`}
          />
          <p className="mt-1 text-xs text-muted">
            Sets where it sits on the calendar; leave blank for all-day.
          </p>
        </div>
      </div>

      <label className="mt-4 flex items-start gap-2.5 text-sm">
        <input
          type="checkbox"
          name="dateSpecific"
          checked={dateSpecific}
          onChange={(e) => setDateSpecific(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-hairline accent-accent"
        />
        <span>
          Show only on the due date
          <span className="mt-0.5 block text-xs text-muted">
            {dateSpecific
              ? "On \u2014 for a one-off like a test: it appears just on its due date."
              : "Off \u2014 for ongoing work (homework, projects): it appears every day from its start date until you mark it done."}
          </span>
        </span>
      </label>

      {!dateSpecific && (
        <div className="mt-3 max-w-[12rem]">
          <label htmlFor="sw-start" className="block text-sm font-medium">
            Starts
          </label>
          <input
            id="sw-start"
            name="startDate"
            type="date"
            defaultValue={defaultDate}
            className={`tabular ${FIELD}`}
          />
          <p className="mt-1 text-xs text-muted">
            Today for most; set ahead for work assigned early.
          </p>
        </div>
      )}

      {state.error && (
        <p role="alert" className="mt-3 text-sm font-medium text-red-700">
          {state.error}
        </p>
      )}

      <div className="mt-4 flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {pending ? "Adding\u2026" : "Add"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-md border border-hairline px-4 py-2 text-sm font-medium text-muted transition-colors hover:border-accent hover:text-accent"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
